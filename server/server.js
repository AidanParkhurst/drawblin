// server/server.js
import { WebSocketServer } from 'ws';
import http from 'http';
import express from 'express';
import Stripe from 'stripe';
import { STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET, summarizeEnv } from './env.js';
import { recordCheckoutSessionIdentity, markPaymentIntentSucceeded, markSubscriptionCanceledOrUpdated } from './payments.js';
import url from 'url';
import FreeDrawLobby from './lobbies/FreeDrawLobby.js';
import QuickDrawLobby from './lobbies/QuickDrawLobby.js';
import GuessingGameLobby from './lobbies/GuessingGameLobby.js';

const PORT = process.env.PORT || 3000; 
const HOST = process.env.HOST || '0.0.0.0'; // Bind to all interfaces by default (helps on Ubuntu/cloud)

// Express app for HTTP routes (Stripe webhook + status page)
const app = express();

// Stripe requires the raw body to validate signatures.
app.use((req, res, next) => {
    if (req.originalUrl === '/webhook/stripe') {
        // Collect raw body manually
        let data = [];
        req.on('data', chunk => data.push(chunk));
        req.on('end', () => {
            req.rawBody = Buffer.concat(data);
            next();
        });
    } else {
        express.json()(req, res, next);
    }
});

app.get('/', (req, res) => {
    res.setHeader('Content-Type', 'text/html');
    res.end(`
        <h1>Drawblin Server</h1>
        <p>WebSocket paths: /freedraw, /quickdraw, /guessinggame, /house?u=OWNER_SLUG</p>
        <p>Webhook: POST /webhook/stripe</p>
        <pre>Env: ${JSON.stringify(summarizeEnv(), null, 2)}</pre>
    `);
});

let stripe = null;
if (STRIPE_SECRET_KEY) {
    stripe = new Stripe(STRIPE_SECRET_KEY, { apiVersion: '2024-06-20' });
} else {
    console.warn('Stripe secret key missing - payment webhook disabled.');
}

app.post('/webhook/stripe', async (req, res) => {
    if (!stripe) {
        return res.status(500).json({ error: 'Stripe not configured' });
    }
    let event;
    try {
        const sig = req.headers['stripe-signature'];
        event = stripe.webhooks.constructEvent(req.rawBody, sig, STRIPE_WEBHOOK_SECRET);
    } catch (err) {
        console.error('Stripe signature verification failed:', err?.message || err);
        return res.status(400).json({ error: `Webhook signature verification failed: ${err.message}` });
    }

    try {
        switch (event.type) {
            case 'checkout.session.completed':
                await recordCheckoutSessionIdentity(event);
                console.log(`Stripe: checkout.session.completed handled (session ${event.data?.object?.id})`);
                break;
            case 'payment_intent.succeeded':
                await markPaymentIntentSucceeded(event);
                console.log(`Stripe: payment_intent.succeeded handled (intent ${event.data?.object?.id})`);
                break;
            case 'customer.subscription.deleted':
            case 'customer.subscription.updated':
                await markSubscriptionCanceledOrUpdated(event);
                console.log(`Stripe: subscription ${event.type} processed (${event.data?.object?.id})`);
                break;
            default:
                // Intentionally ignore unhandled Stripe event types in production
                // console.debug('Unhandled Stripe event type:', event.type);
        }
    } catch (e) {
        console.error('Error processing Stripe event:', e?.message || e);
        return res.status(500).json({ status: 'error', message: e.message });
    }
    res.json({ received: true });
});

// Create HTTP server from Express (so WebSocket can share the port)
const server = http.createServer(app);

const wss = new WebSocketServer({ 
    server,
    verifyClient: (info) => {
        // Parse the URL to get the path
        const pathname = url.parse(info.req.url).pathname;
        const validPaths = ['/freedraw', '/quickdraw', '/guessinggame', '/house'];
        
        if (!validPaths.includes(pathname)) {
            console.warn(`Rejected connection to invalid path: ${pathname}`);
            return false;
        }
        
        return true;
    }
});

const lobbies = new Map(); // lobbyId -> Lobby
const socketToLobby = new Map(); // socket -> lobbyId
let nextLobbyId = 1;

// ---------------- Security: Sanitization + Rate Limits ----------------
// HTML-escape to prevent XSS in any DOM-rendered strings on clients
function escapeHtml(str) {
    return str.replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
}
function sanitizeText(input, maxLen = 240) {
    if (typeof input !== 'string') return '';
    // Remove control characters, cap length, then escape HTML entities
    const cleaned = input.replace(/[\u0000-\u001F\u007F]/g, '');
    const truncated = cleaned.slice(0, Math.max(0, maxLen));
    return escapeHtml(truncated);
}
function sanitizeName(input) {
    // More conservative cap for names; allow common punctuation; escape HTML anyway
    return sanitizeText(input, 40);
}

// Token bucket rate limiting (per-socket and coarse per-IP)
const RATE = {
    chat: { refillPerSec: 3, capacity: 6 },     // typical users unaffected
    update: { refillPerSec: 12, capacity: 24 }, // normal ~6-7/s fits comfortably
};
const IP_RATE = {
    chat: { refillPerSec: 10, capacity: 20 },
    update: { refillPerSec: 50, capacity: 100 },
};

const ipBuckets = new Map(); // ip -> { chat:{tokens,last}, update:{tokens,last} }
const socketBuckets = new WeakMap(); // socket -> { chat:{tokens,last}, update:{tokens,last}, ip }

function nowSec() { return Date.now() / 1000; }
function getOrInitBucket(holder, key, cfg) {
    let b = holder.get(key);
    if (!b) {
        b = { chat: { tokens: RATE.chat.capacity, last: nowSec() }, update: { tokens: RATE.update.capacity, last: nowSec() } };
        holder.set(key, b);
    }
    return b;
}
function refill(bucket, cfg) {
    const t = nowSec();
    const elapsed = Math.max(0, t - bucket.last);
    bucket.tokens = Math.min(cfg.capacity, bucket.tokens + elapsed * cfg.refillPerSec);
    bucket.last = t;
}
function consume(type, socket) {
    if (!(type === 'chat' || type === 'update')) return true; // don't rate-limit other controls
    const sMeta = socketBuckets.get(socket);
    if (!sMeta) return true;
    const { ip } = sMeta;
    // Per-socket
    const sb = sMeta[type];
    refill(sb, RATE[type]);
    if (sb.tokens < 1) return false;
    sb.tokens -= 1;
    // Per-IP
    const ipbAll = getOrInitBucket(ipBuckets, ip, IP_RATE);
    const ipb = ipbAll[type];
    refill(ipb, IP_RATE[type]);
    if (ipb.tokens < 1) {
        // rollback socket token consumption to be fair
        sb.tokens = Math.min(RATE[type].capacity, sb.tokens + 1);
        return false;
    }
    ipb.tokens -= 1;
    return true;
}

// House lobby ownership maps (keyed by short owner slug)
const houseOwnerToLobbyId = new Map(); // ownerSlug -> lobbyId
const lobbyIdToHouseOwner = new Map(); // lobbyId -> ownerSlug
// Track whether the owner is currently connected to a given house lobby
const ownerSocketsByLobby = new Map(); // lobbyId -> Set<WebSocket>
const socketIsHouseOwner = new WeakMap(); // socket -> boolean

// Deterministically abbreviate a Supabase UUID to a short slug (lowercase hex, no dashes)
function shortUid(uid, len = 12) {
    if (!uid || typeof uid !== 'string') return '';
    const hex = uid.toLowerCase().replace(/-/g, '');
    return hex.slice(0, Math.max(1, Math.min(len, hex.length)));
}

function findOrCreateLobby(lobbyType = 'freedraw') {
    // Find first non-full lobby of the specified type
    for (const lobby of lobbies.values()) {
        if (!lobby.isFull() && lobby.constructor.name.toLowerCase().includes(lobbyType.replace(/\s+/g, ''))) {
            return lobby;
        }
    }
    
    // All lobbies are full or no lobbies of this type exist, create a new one
    let newLobby;
    switch (lobbyType) {
        case 'quickdraw':
        case 'quick draw':
            newLobby = new QuickDrawLobby(nextLobbyId++);
            break;
        case 'guessinggame':
        case 'guessing game':
            newLobby = new GuessingGameLobby(nextLobbyId++);
            break;
        case 'freedraw':
        case 'free draw':
        default:
            newLobby = new FreeDrawLobby(nextLobbyId++);
            break;
    }
    
    lobbies.set(newLobby.id, newLobby);
    return newLobby;
}

wss.on('connection', (socket, request) => {
    // Parse the URL to determine lobby type
    const parsed = url.parse(request.url, true);
    const pathname = parsed.pathname;
    let lobbyType;
    
    switch (pathname) {
        case '/freedraw':
            lobbyType = 'freedraw';
            break;
        case '/quickdraw':
            lobbyType = 'quickdraw';
            break;
        case '/guessinggame':
            lobbyType = 'guessinggame';
            break;
        case '/house':
            lobbyType = 'house';
            break;
        default:
            // This shouldn't happen due to verifyClient, but just in case
            lobbyType = 'freedraw';
            break;
    }

    // Assign client to a lobby of the specified type
    let lobby;
    if (lobbyType === 'house') {
            const ownerSlug = (parsed.query && typeof parsed.query.u === 'string') ? parsed.query.u.trim() : '';
        const requesterUid = (parsed.query && typeof parsed.query.me === 'string') ? parsed.query.me.trim() : '';
        if (!ownerSlug) {
            try { socket.close(1008, 'Missing owner uid'); } catch {}
            return;
        }
        // Determine if this connecting client is the house owner (match short slug of requester)
            const isOwner = requesterUid && shortUid(requesterUid) === ownerSlug;

        // Existing lobby for this owner?
    const existingId = houseOwnerToLobbyId.get(ownerSlug);
        if (isOwner) {
            // Owner can create or join their own lobby
            if (existingId && lobbies.has(existingId)) {
                lobby = lobbies.get(existingId);
            } else {
                lobby = new FreeDrawLobby(nextLobbyId++);
                // Annotate as a house lobby
                lobby.houseOwnerUid = ownerSlug;
                lobbies.set(lobby.id, lobby);
                houseOwnerToLobbyId.set(ownerSlug, lobby.id);
                lobbyIdToHouseOwner.set(lobby.id, ownerSlug);
                // House lobby created for owner; no verbose log in production
            }
        } else {
            // Guest can only join if the lobby exists AND owner is present
            if (!existingId || !lobbies.has(existingId)) {
                try { socket.send(JSON.stringify({ type: 'house_unavailable', reason: 'not_found' })); } catch {}
                try { socket.close(1008, 'House not available'); } catch {}
                return;
            }
            lobby = lobbies.get(existingId);
            const owners = ownerSocketsByLobby.get(existingId);
            if (!owners || owners.size === 0) {
                try { socket.send(JSON.stringify({ type: 'house_unavailable', reason: 'owner_not_home' })); } catch {}
                try { socket.close(1008, 'Owner not present'); } catch {}
                return;
            }
        }
    } else {
        lobby = findOrCreateLobby(lobbyType);
    }

    lobby.addClient(socket);
    socketToLobby.set(socket, lobby.id);

    // Attach security meta (rate limiting)
    const ip = (request.headers['x-forwarded-for']?.split(',')[0].trim()) || request.socket?.remoteAddress || 'unknown';
    const init = { chat: { tokens: RATE.chat.capacity, last: nowSec() }, update: { tokens: RATE.update.capacity, last: nowSec() }, ip };
    socketBuckets.set(socket, init);
    if (!ipBuckets.has(ip)) {
        ipBuckets.set(ip, { chat: { tokens: IP_RATE.chat.capacity, last: nowSec() }, update: { tokens: IP_RATE.update.capacity, last: nowSec() } });
    }

    // If this is a house lobby, mark owner presence if applicable
    if (lobbyType === 'house') {
        const ownerSlug = lobbyIdToHouseOwner.get(lobby.id);
        const requesterUid = (parsed.query && typeof parsed.query.me === 'string') ? parsed.query.me.trim() : '';
        const isOwner = ownerSlug && requesterUid && shortUid(requesterUid) === ownerSlug;
        if (isOwner) {
            let set = ownerSocketsByLobby.get(lobby.id);
            if (!set) {
                set = new Set();
                ownerSocketsByLobby.set(lobby.id, set);
            }
            set.add(socket);
            socketIsHouseOwner.set(socket, true);
        } else {
            socketIsHouseOwner.set(socket, false);
        }
    }

    // Connection accepted; omit per-connection logs for production performance

    // If this is a house lobby, immediately inform the client of the current mode
    if (lobbyType === 'house') {
        let mode = 'freedraw';
        if (lobby instanceof QuickDrawLobby) mode = 'quickdraw';
        else if (lobby instanceof GuessingGameLobby) mode = 'guessinggame';
        try {
            if (socket.readyState === 1 || socket.readyState === socket.OPEN) {
                socket.send(JSON.stringify({ type: 'house_mode', mode }));
            }
        } catch (e) {
            console.error('Failed to send initial house_mode:', e?.message || e);
        }
    }

    socket.on('message', data => {
        const currentLobby = lobbies.get(socketToLobby.get(socket));
        if (!currentLobby) {
            console.error('Socket not found in any lobby');
            return;
        }

        let message;
        try {
            message = JSON.parse(data);
        } catch (error) {
            console.error('Invalid JSON received:', error);
            return;
        }

        // Server-side input validation/sanitization and rate limiting
        const type = message?.type;
        if (type === 'chat') {
            if (!consume('chat', socket)) return; // drop if rate-limited
            const content = sanitizeText(message.content ?? '', 240);
            if (!content) return; // drop empty after sanitize
            message.content = content;
        } else if (type === 'update') {
            if (!consume('update', socket)) return; // drop if rate-limited
            // Sanitize goblin.name if present
            if (message.goblin && typeof message.goblin.name === 'string') {
                message.goblin.name = sanitizeName(message.goblin.name);
            } else if (message.g && typeof message.g.n === 'string') {
                message.g.n = sanitizeName(message.g.n);
            }
        }

        // House-only: allow owner to switch the lobby mode between freedraw/quickdraw/guessinggame
        if (message && message.type === 'house_switch_mode') {
            const target = (message.mode || '').toString().toLowerCase();
            const allowed = ['freedraw', 'quickdraw', 'guessinggame'];
            if (!allowed.includes(target)) return;
            const ownerSlug = lobbyIdToHouseOwner.get(currentLobby.id);
            if (!ownerSlug) return; // not a house lobby
            const requesterUid = (message.requesterUid || '').toString();
            const requesterShort = shortUid(requesterUid);
            if (!requesterShort || requesterShort !== ownerSlug) {
                console.warn(`Rejected house_switch_mode by non-owner in lobby ${currentLobby.id}`);
                return;
            }
            try {
                switchHouseLobbyType(currentLobby, target);
            } catch (e) {
                console.error('Failed to switch house lobby type:', e?.stack || e);
            }
            return; // do not forward this control message to game handlers
        }

        // Delegate message handling to the lobby safely
        try {
            currentLobby.handleMessage(socket, message);
        } catch (e) {
            console.error(`Error in lobby ${currentLobby.id} handleMessage:`, e?.stack || e);
        }
    });

    socket.on('close', () => {
        const lobbyId = socketToLobby.get(socket);
        if (lobbyId) {
            const lobby = lobbies.get(lobbyId);
            if (lobby) {
                lobby.removeClient(socket);
                // Track owner presence for house lobbies
                const ownerSlug = lobbyIdToHouseOwner.get(lobbyId);
                if (ownerSlug) {
                    if (socketIsHouseOwner.get(socket) === true) {
                        const set = ownerSocketsByLobby.get(lobbyId);
                        if (set) {
                            set.delete(socket);
                            if (set.size === 0) ownerSocketsByLobby.delete(lobbyId);
                        }
                    }
                    socketIsHouseOwner.delete(socket);
                }
                
                // Clean up empty lobbies (optional - you might want to keep them for a while)
                if (lobby.clients.size === 0) {
                    if (typeof lobby.stopGameLoop === 'function' && lobby.gameTimer) {
                        lobby.stopGameLoop(); // Stop any ongoing game loop
                    }
                    // If it's a house lobby, clear mappings
                    const ownerSlug2 = lobbyIdToHouseOwner.get(lobbyId);
                    if (ownerSlug2) {
                        houseOwnerToLobbyId.delete(ownerSlug2);
                        lobbyIdToHouseOwner.delete(lobbyId);
                        ownerSocketsByLobby.delete(lobbyId);
                    }
                    lobbies.delete(lobbyId);
                    // Removed empty lobby; omit frequent log noise in production
                }
            }
            socketToLobby.delete(socket);
        }
        // Omit per-disconnect logs to reduce noise
    });
});

// Create a new lobby of desired type with the SAME id and migrate clients
function switchHouseLobbyType(oldLobby, targetType) {
    const id = oldLobby.id;
    let newLobby;
    if (targetType === 'quickdraw') {
        newLobby = new QuickDrawLobby(id);
    } else if (targetType === 'guessinggame') {
        newLobby = new GuessingGameLobby(id);
    } else {
        newLobby = new FreeDrawLobby(id);
    }
    // Preserve house ownership
    const ownerSlug = lobbyIdToHouseOwner.get(id);
    if (ownerSlug) newLobby.houseOwnerUid = ownerSlug;

    // Replace in registry BEFORE migrating to ensure lookups resolve
    lobbies.set(id, newLobby);

    // Migrate clients
    for (const client of oldLobby.clients) {
        newLobby.addClient(client);
        socketToLobby.set(client, id);
    }
    // Old timers off
    if (typeof oldLobby.stopGameLoop === 'function' && oldLobby.gameTimer) {
        oldLobby.stopGameLoop();
    }
    // Announce mode change to clients so UI can adapt
    newLobby.broadcast({ type: 'house_mode', mode: targetType });
    // House lobby mode switched; avoid chatty logs in production
}

server.listen(PORT, HOST, () => {
    console.log(`Server is running on http://${HOST}:${PORT}`);
});
