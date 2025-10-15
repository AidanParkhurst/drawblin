import p5 from "p5";
p5.disableFriendlyErrors = true; // Disable friendly errors for performance

import Goblin from "./goblin.js";
import Portal from "./portal.js";
import Line from "./line.js";
import Chat from "./chat.js";
import PlayerList from "./players.js";
import Toolbelt from "./toolbelt.js";
import { drawHeader, drawWaitingWithScoreboard } from './header.js';
import { ws, connect, sendMessage } from "./network.js";
import { mountHouseControls, updateHouseControlsVisibility, onHouseModeSelected, setHouseMode } from './house_controls.js';
import { assets } from "./assets.js";
import { playThud, playDragGrain, stopDragImmediate } from './audio.js';
import { calculateUIColor, randomPaletteColor } from "./colors.js";
import { ready as authReady, isAuthConfigured, getUser, getProfileName, upsertProfileName } from './auth.js';
import { generateGoblinName } from './names.js';
import { spawnBurst, updateBursts } from './burst.js';
import Pet from './pets.js';
import { fetchEntitlements, hasPetPack, hasPremium } from './entitlements.js';

// -- Game State Initialization --
let you;
let chat;
let playerList;
let toolbelt;
let goblins = [];
let header = "";
let lobby_type = 'freedraw'; // Default lobby type
let house_owner_uid = null; // If present, we're in a house lobby
let game_state = 'lobby';

// Gamemode dependent variables
let prompt = "";
let prompt_length = -1; // legacy single-word length (still used for quickdraw underscore fallback)
// QuickDraw winner tracking (now supports ties & persistence through next full round)
let last_winners = new Set(); // ids of winners from most recent finished state
let timer = 0;
let current_artist = -1; // id of the artist who drew the art being voted on (legacy single)
let current_artists = []; // team variant: array of artist ids currently being voted on
let results = [];
let teammates = []; // for quickdraw team mode: ids of your current round teammates (excluding you)
// Persistent winner sets per mode (QuickDraw & Guessing Game)
let quickdrawWinners = new Set();
let guessingWinners = new Set();
let quickdrawPrimaryWinner = null; // single winner whose drawing persists (even if tie)
// UI overlay queue to ensure overlays render above world
let _pendingHeader = null; // { text, time, color, options }
let _pendingScoreboard = null; // { time, results, goblinsRef, color }

// drawing vars
let drawing = false;
let dragAccumDist = 0; // accumulate distance since last drag grain
let lastDragX = null, lastDragY = null;
let last_mouse = { x: 0, y: 0 };
let line_granularity = 1; // How many pixels between each line point
let last_line_count = 0;

// networking
let heartbeat = 150; 
let heartbeat_timer = 0;
let portals = [];
let joined = false; // Track if the user has joined a game
// Dedicated reference for the signed-in user's Home portal (house lobby)
let homePortal = null;


let hasInput = false;
let pets = [];

// Keep a handle to Free Draw portal for mobile messaging
let freedrawPortalRef = null;

// Line packing config
const DEFAULT_WEIGHT = 5;               // common brush weight
const USE_COMPACT_LINES = true;         // feature flag for compact wire format
let __newPlayersSinceLastSend = 0;      // count newcomers observed since our last line send

// Environment: lightweight mobile detection
function isMobileDevice() {
    try {
        const ua = (navigator.userAgent || navigator.vendor || window.opera || '').toLowerCase();
        const uaHit = /(android|iphone|ipad|ipod|blackberry|iemobile|opera mini)/i.test(ua);
        const coarse = (window.matchMedia && matchMedia('(pointer:coarse)').matches) || (navigator.maxTouchPoints || 0) > 1;
        return !!(uaHit || coarse);
    } catch { return false; }
}
const __isMobile = isMobileDevice();

// Helpers: tiny base64 <-> bytes (Uint8Array)
function __bytesToBase64(bytes) {
    let binary = '';
    const len = bytes.length;
    for (let i = 0; i < len; i++) binary += String.fromCharCode(bytes[i]);
    return btoa(binary);
}
function __base64ToBytes(b64) {
    if (!b64 || typeof b64 !== 'string') return new Uint8Array(0);
    const binary = atob(b64);
    const len = binary.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) bytes[i] = binary.charCodeAt(i) & 0xFF;
    return bytes;
}

// Helpers: color equality and safe rounding for points
function __colorsEq(a, b) {
    if (!Array.isArray(a) || !Array.isArray(b)) return false;
    return a.length === 3 && b.length === 3 && a[0] === b[0] && a[1] === b[1] && a[2] === b[2];
}
function __ptEq(ax, ay, bx, by) { return ax === bx && ay === by; }

// Pack lines into a compact byte stream (base64) grouped as polylines by shared style and connectivity
// Format per group:
//   flags: 1 byte (bit0=hasColor, bit1=hasWeight)
//   [r,g,b]: 3 bytes if hasColor
//   [w]: 1 byte if hasWeight
//   count: 1 byte (number of points in this polyline, 2..255)
//   points: count * (x:uint16 LE, y:uint16 LE)
function encodeLinesCompact(lines, ownerColor) {
    if (!Array.isArray(lines) || lines.length === 0) return '';
    const out = [];
    let curColor = null, curWeight = null;
    let points = [];

    const flush = () => {
        if (points.length < 2) { points.length = 0; return; }
        // If too many points for one group, chunk into 255 max per group; repeat flags/style for each chunk
        let idx = 0;
        while (idx < points.length) {
            const hasColor = !__colorsEq(curColor, ownerColor);
            const hasWeight = (curWeight|0) !== (DEFAULT_WEIGHT|0);
            let flags = 0;
            if (hasColor) flags |= 1;
            if (hasWeight) flags |= 2;
            out.push(flags & 0xFF);
            if (hasColor) { out.push(curColor[0]&0xFF, curColor[1]&0xFF, curColor[2]&0xFF); }
            if (hasWeight) { out.push((curWeight|0) & 0xFF); }
            const remaining = points.length - idx;
            const take = Math.min(255, remaining);
            out.push(take & 0xFF);
            for (let i = 0; i < take; i++) {
                const p = points[idx + i];
                const x = Math.max(0, Math.min(65535, Math.round(p.x)));
                const y = Math.max(0, Math.min(65535, Math.round(p.y)));
                out.push(x & 0xFF, (x>>>8) & 0xFF, y & 0xFF, (y>>>8) & 0xFF);
            }
            idx += take;
        }
        points.length = 0;
    };

    for (let i = 0; i < lines.length; i++) {
        const seg = lines[i];
        if (!seg) continue;
        const col = Array.isArray(seg.color) ? seg.color : (Array.isArray(ownerColor) ? ownerColor : [0,0,0]);
        const w = typeof seg.weight === 'number' ? (seg.weight|0) : DEFAULT_WEIGHT;
        const sx = Array.isArray(seg.start?._values) ? seg.start._values[0] : (seg.start?.x ?? 0);
        const sy = Array.isArray(seg.start?._values) ? seg.start._values[1] : (seg.start?.y ?? 0);
        const ex = Array.isArray(seg.end?._values) ? seg.end._values[0] : (seg.end?.x ?? sx);
        const ey = Array.isArray(seg.end?._values) ? seg.end._values[1] : (seg.end?.y ?? sy);

        const sameStyle = curColor && __colorsEq(col, curColor) && (w === curWeight);
        const continues = sameStyle && points.length > 0 && __ptEq(points[points.length-1].x, points[points.length-1].y, Math.round(sx), Math.round(sy));

        if (!sameStyle || !continues) {
            // Flush previous polyline
            flush();
            curColor = [col[0]|0, col[1]|0, col[2]|0];
            curWeight = w;
            points.push({ x: Math.round(sx), y: Math.round(sy) });
        }
        points.push({ x: Math.round(ex), y: Math.round(ey) });
        // If point list is getting very large, proactively flush to keep count within 255 when next segment doesn't continue
        if (points.length >= 255) {
            flush();
        }
    }
    flush();
    return __bytesToBase64(Uint8Array.from(out));
}

// Unpack compact base64 back into a list of Line objects
function decodeLinesCompact(b64, ownerColor) {
    const bytes = __base64ToBytes(b64);
    const res = [];
    if (!bytes.length) return res;
    let i = 0;
    let curColor = Array.isArray(ownerColor) ? ownerColor.slice(0,3) : [0,0,0];
    let curWeight = DEFAULT_WEIGHT;
    while (i < bytes.length) {
        const flags = bytes[i++];
        const hasColor = (flags & 1) !== 0;
        const hasWeight = (flags & 2) !== 0;
        if (hasColor) { curColor = [bytes[i++]|0, bytes[i++]|0, bytes[i++]|0]; }
        if (hasWeight) { curWeight = bytes[i++]|0; }
        // One or more count blocks can follow for this style. We stop when next byte looks like a flags start (heuristic is hard),
        // so we instead read exactly one block per style emission as encoded above. Our encoder repeats flags per style chunk, so read one block here.
        const count = bytes[i++]|0;
        const pts = [];
        for (let k = 0; k < count; k++) {
            if (i + 3 >= bytes.length) { i = bytes.length; break; }
            const x = bytes[i++] | (bytes[i++] << 8);
            const y = bytes[i++] | (bytes[i++] << 8);
            pts.push({ x, y });
        }
        for (let p = 1; p < pts.length; p++) {
            const s = createVector(pts[p-1].x, pts[p-1].y);
            const e = createVector(pts[p].x, pts[p].y);
            res.push(new Line(s, e, curColor, curWeight));
        }
    }
    return res;
}

// --- Global line ordering (for collaborative drawing) ---
// We keep a global append-only list of line segments in the order they were first seen.
// Each segment gets a stable key per owner so we can de-duplicate across network heartbeats
// and mark removals efficiently without reshuffling.
let __lineSeq = 1; // monotonically increasing
const __globalLines = []; // { sx,sy,ex,ey,color,weight,seq,ownerId, removed }
const __knownLineKeys = new Map(); // key -> entry
const __perOwnerKeys = new Map(); // ownerId -> Set(keys)

function __colorKey(c){ return Array.isArray(c) ? c.join(',') : String(c); }
function __idEq(a, b) { return String(a) === String(b); }
function __normPt(pt){
    if (!pt) return { x: 0, y: 0 };
    if (Array.isArray(pt._values) && pt._values.length >= 2) return { x: pt._values[0], y: pt._values[1] };
    if (typeof pt.x === 'number' && typeof pt.y === 'number') return { x: pt.x, y: pt.y };
    return { x: 0, y: 0 };
}
function __lineKey(ownerId, seg){
    // Build a stable signature for a line segment; support both {start,end} and {sx,sy,ex,ey}
    let sx, sy, ex, ey;
    if (seg.start || seg.sx != null) {
        const s = seg.start ? __normPt(seg.start) : { x: seg.sx, y: seg.sy };
        sx = s.x; sy = s.y;
    } else { sx = 0; sy = 0; }
    if (seg.end || seg.ex != null) {
        const e = seg.end ? __normPt(seg.end) : { x: seg.ex, y: seg.ey };
        ex = e.x; ey = e.y;
    } else { ex = sx; ey = sy; }
    const col = seg.color || seg.col || you?.color || [0,0,0];
    const w = seg.weight || seg.w || 0;
    return `${ownerId}:${sx},${sy}|${ex},${ey}|${__colorKey(col)}|${w}`;
}
function __ensureOwnerSet(ownerId){
    let set = __perOwnerKeys.get(ownerId);
    if (!set) { set = new Set(); __perOwnerKeys.set(ownerId, set); }
    return set;
}
function __registerLine(ownerId, seg){
    const key = __lineKey(ownerId, seg);
    if (__knownLineKeys.has(key)) return; // already tracked
    const s = seg.start ? __normPt(seg.start) : { x: seg.sx ?? 0, y: seg.sy ?? 0 };
    const e = seg.end ? __normPt(seg.end)   : { x: seg.ex ?? s.x, y: seg.ey ?? s.y };
    const entry = {
        sx: s.x,
        sy: s.y,
        ex: e.x,
        ey: e.y,
        color: Array.isArray(seg.color) ? seg.color.slice() : seg.color,
        weight: seg.weight,
        seq: __lineSeq++,
        ownerId: ownerId,
        removed: false,
    };
    __globalLines.push(entry);
    __knownLineKeys.set(key, entry);
    __ensureOwnerSet(ownerId).add(key);
}
function __removeOwnerLineByKey(ownerId, key){
    const entry = __knownLineKeys.get(key);
    if (entry) { entry.removed = true; __knownLineKeys.delete(key); }
    const set = __perOwnerKeys.get(ownerId);
    if (set) set.delete(key);
}
function __syncOwnerLines(ownerId, segs){
    // Register any new segments and mark removed those no longer present
    const newKeys = new Set();
    for (const seg of segs){
        const key = __lineKey(ownerId, seg);
        newKeys.add(key);
        if (!__knownLineKeys.has(key)) __registerLine(ownerId, seg);
    }
    const set = __ensureOwnerSet(ownerId);
    for (const key of Array.from(set)){
        if (!newKeys.has(key)) __removeOwnerLineByKey(ownerId, key);
    }
}

function __clearOwnerLines(ownerId){
    // Convenience to mark all of an owner's lines removed
    __syncOwnerLines(ownerId, []);
}

function __drawGlobalLines(){
    // Render in seq order; skip removed; cache style to minimize state changes
    if (__globalLines.length === 0) return;

    // Quick Draw: enforce per-phase visibility of lines
    // - drawing: only your own lines
    // - pre-voting: no lines
    // - voting: only current artist's lines
    // - finished: only primary winner's lines
    let allowOwner = null;
    if (lobby_type === 'quickdraw') {
        if (game_state === 'drawing') {
            const myId = you?.id;
            const mates = Array.isArray(teammates) ? teammates.slice() : [];
            allowOwner = (ownerId) => __idEq(ownerId, myId) || mates.some(id => __idEq(id, ownerId));
        } else if (game_state === 'pre-voting') {
            allowOwner = () => false; // hide all
        } else if (game_state === 'voting') {
            const ids = Array.isArray(current_artists) && current_artists.length ? current_artists : (current_artist != null ? [current_artist] : []);
            allowOwner = (ownerId) => ids.some(id => __idEq(ownerId, id));
        } else if (game_state === 'finished') {
            // Prefer the deterministic primary winner; fallback to any from last_winners
            const primary = (typeof quickdrawPrimaryWinner === 'number' || typeof quickdrawPrimaryWinner === 'string')
                ? quickdrawPrimaryWinner
                : null;
            if (primary != null) {
                allowOwner = (ownerId) => __idEq(ownerId, primary);
            } else if (last_winners && typeof last_winners.has === 'function') {
                allowOwner = (ownerId) => {
                    for (const w of last_winners) { if (__idEq(ownerId, w)) return true; }
                    return false;
                };
            } else {
                allowOwner = () => false;
            }
        }
    }
    push();
    strokeJoin(ROUND); strokeCap(ROUND); noFill();
    let lastColorKey = null; let lastWeight = -1;
    for (const seg of __globalLines){
        if (seg.removed) continue;
        if (allowOwner && !allowOwner(seg.ownerId)) continue;
        const ckey = __colorKey(seg.color);
        if (ckey !== lastColorKey){ stroke(seg.color); lastColorKey = ckey; }
        if (seg.weight !== lastWeight){ strokeWeight(seg.weight); lastWeight = seg.weight; }
        line(seg.sx, seg.sy, seg.ex, seg.ey);
    }
    pop();
}

// Line intersection utility function for eraser
function lineIntersect(line1Start, line1End, line2Start, line2End) {
    const x1 = line1Start.x, y1 = line1Start.y;
    const x2 = line1End.x, y2 = line1End.y;
    const x3 = line2Start.x, y3 = line2Start.y;
    const x4 = line2End.x, y4 = line2End.y;
    
    const denom = (x1 - x2) * (y3 - y4) - (y1 - y2) * (x3 - x4);
    if (denom === 0) return false; // Lines are parallel
    
    const t = ((x1 - x3) * (y3 - y4) - (y1 - y3) * (x3 - x4)) / denom;
    const u = -((x1 - x2) * (y1 - y3) - (y1 - y2) * (x1 - x3)) / denom;
    
    return t >= 0 && t <= 1 && u >= 0 && u <= 1;
}

// Distance utilities for radius-based eraser
function _clamp(v, min, max) { return Math.max(min, Math.min(max, v)); }
function _dist2(a, b) { const dx = a.x - b.x, dy = a.y - b.y; return dx*dx + dy*dy; }
function pointSegmentDistance(p, v, w) {
    // Return the distance from point p to segment vw
    const l2 = _dist2(v, w);
    if (l2 === 0) return Math.sqrt(_dist2(p, v)); // v == w
    const t = _clamp(((p.x - v.x)*(w.x - v.x) + (p.y - v.y)*(w.y - v.y)) / l2, 0, 1);
    const proj = { x: v.x + t * (w.x - v.x), y: v.y + t * (w.y - v.y) };
    return Math.sqrt(_dist2(p, proj));
}
function segmentSegmentDistance(p1, q1, p2, q2) {
    // If segments intersect, distance is zero
    if (lineIntersect(p1, q1, p2, q2)) return 0;
    // Otherwise, min of endpoint-to-segment distances
    return Math.min(
        pointSegmentDistance(p1, p2, q2),
        pointSegmentDistance(q1, p2, q2),
        pointSegmentDistance(p2, p1, q1),
        pointSegmentDistance(q2, p1, q1)
    );
}

async function start() {
    // Determine name: account name if available; otherwise generate; if account exists but has no name, set a random name in DB
    let name = '';
    if (isAuthConfigured()) {
        await authReady();
        const user = getUser();
        if (user) {
            const existing = await getProfileName();
            if (existing && existing.trim()) {
                name = existing.trim();
            } else {
                // Account without name yet: generate and save
                name = generateGoblinName();
                await upsertProfileName(name);
            }
        }
    }
    if (!name) {
        // Guest or no auth configured
        name = generateGoblinName();
    }

    you = new Goblin(
        width / 2,
        height / 2,
        randomPaletteColor(),
        true,
        -1,
        random(['manny', 'stanley', 'ricky', 'blimp', 'hippo', 'grubby']),
        name
    ); // Create the local goblin
    try { you.triggerAppear?.(); } catch {}

    // Pet entitlement gating: only signed-in users with pet pack or premium get a pet (selected later via profile UI)
    try {
        await fetchEntitlements();
        if (hasPetPack() || hasPremium()) {
            // We'll spawn an empty placeholder; actual sprite chosen when user picks in profile UI.
            // Keep petKey null until selection to avoid random assignment.
            // (If we later persist selection server-side, initialize here.)
        }
    } catch (e) { console.warn('Pet entitlement check failed:', e?.message || e); }

    // Calculate UI color based on contrast against background (240, 240, 240)
    you.ui_color = calculateUIColor(you.color, [240, 240, 240]);
    
    goblins.push(you);
    chat = new Chat(); 
    playerList = new PlayerList(50, 20); // Create the player list with default circle size and spacing
    toolbelt = new Toolbelt(); // Create the toolbelt

    let freedraw_portal = new Portal(width / 2, height / 2 - 200, 150, you.ui_color, "Stand here to join\nFree Draw", () => {
        you.lines = [];
        connect('freedraw'); // Connect to the freedraw game type
        joined = true;
        lobby_type = 'freedraw'; // Set the lobby type to freedraw
    });
    // Record reference and hide Free Draw portal on mobile
    freedrawPortalRef = freedraw_portal;
    if (__isMobile && freedraw_portal) {
        freedraw_portal.active = false;
    }
    let quickdraw_portal = new Portal(width / 2 + 400, height / 2 - 200, 150, you.ui_color, "Stand here to join\nTeam Draw", () => {
        you.lines = [];
        // game_state = 'waiting'; // Set game state to waiting
        connect('quickdraw'); // Connect to the quickdraw game type
        joined = true;
        lobby_type = 'quickdraw'; // Set the lobby type to quickdraw
        timer = 20;
    });
    let guessinggame_portal = new Portal(width / 2 - 400, height / 2 - 200, 150, you.ui_color, "Stand here to join\nGuessing Game", () => {
        you.lines = [];
        connect('guessinggame'); // Connect to the guessing game type
        joined = true;
        lobby_type = 'guessinggame'; // Set the lobby type to guessinggame
        timer = 20;
    });
    portals.push(freedraw_portal, quickdraw_portal, guessinggame_portal);


    // If URL indicates a house lobby (supports /house and /house.html for static hosting), auto-join and mount controls
    try {
        const urlParams = new URLSearchParams(window.location.search);
        const housePath = /\/house(?:\.html)?$/i.test(window.location.pathname);
        if (housePath && urlParams.get('u')) {
            house_owner_uid = urlParams.get('u'); // now a short slug
            let me = '';
            try { await authReady(); me = getUser()?.id || ''; } catch {}
            connect('house', { u: house_owner_uid, me });
            joined = true;
            lobby_type = 'freedraw'; // server will send house_mode to refine
            // Mount host controls and set visibility based on ownership
            await authReady();
            mountHouseControls();
            const user = getUser();
            const isOwner = Boolean(user && (user.id || '').toLowerCase().replaceAll('-', '').slice(0,12) === house_owner_uid);
            updateHouseControlsVisibility(isOwner);
            // If server hasn't sent the mode yet, default to freedraw title/buttons
            setHouseMode('freedraw');
            // Update visibility on auth changes
            window.addEventListener('auth:user-changed', (evt) => {
                const u = evt.detail?.user || null;
                const isOwnerNow = Boolean(u && (u.id || '').toLowerCase().replaceAll('-', '').slice(0,12) === house_owner_uid);
                updateHouseControlsVisibility(isOwnerNow);
            });
            // Handle mode selection callbacks
            onHouseModeSelected((mode) => {
                const u = getUser();
                const fullId = u?.id || '';
                if (!fullId) return;
                const shortId = fullId.toLowerCase().replaceAll('-', '').slice(0,12);
                // Only allow if this client is the owner
                if (shortId !== house_owner_uid) return;
                sendMessage({ type: 'house_switch_mode', mode, requesterUid: fullId });
            });
        } else {
            // Not in house path: ensure controls unmounted/hidden
            mountHouseControls();
            updateHouseControlsVisibility(false);
        }
    } catch (e) {
        console.warn('House autoconnect skipped:', e?.message || e);
    }

    return;
}

// Creates or removes the home portal based on current auth user state.
function ensureHomePortal() {
    const user = isAuthConfigured() ? getUser() : null;
    const hasUser = Boolean(user && user.id);
    const inHouse = /\/house(?:\.html)?$/i.test(window.location.pathname);

    // Remove if shouldn't exist
    if ((!hasUser || inHouse) && homePortal) {
        const idx = portals.indexOf(homePortal);
        if (idx !== -1) portals.splice(idx, 1);
        homePortal = null;
    }

    // Create if needed
    if (hasUser && !homePortal && !inHouse) {
        let redirecting = false;
        const slug = (user.id || '').toLowerCase().replaceAll('-', '').slice(0, 12);
        homePortal = new Portal(
            width / 2 + 400,
            height / 2 + 150,
            150,
            you?.ui_color || [0,0,0],
            "Stand here to go to\nYour House",
            () => {
                if (redirecting) return;
                redirecting = true;
                const basePath = window.location.pathname.replace(/\/[^/]*$/, '/');
                // Use clean URL /house?u=... (server or static host should serve house.html for /house request)
                const url = `${window.location.origin}${basePath}house?u=${encodeURIComponent(slug)}`;
                window.location.assign(url);
            },
            { oneshot: true }
        );
        portals.push(homePortal);
    }

    if (homePortal && you && Array.isArray(you.ui_color)) {
        homePortal.color = [...you.ui_color];
    }
}


// -- P5 Initialization --

window.setup = async() => {
    await assets.preloadAssets(); // Preload all assets
    let canvas = createCanvas(windowWidth, windowHeight);
    
    // Disable default drag behavior on canvas
    canvas.elt.addEventListener('dragstart', (e) => e.preventDefault());
    
    ellipseMode(CENTER);
    textFont(assets.font);
    textSize(16);
    // No auth UI logic here; button is bound by auth.js module
    await start();

    // React to auth changes: update goblin name accordingly
    window.addEventListener('auth:user-changed', async (evt) => {
        const user = evt.detail?.user || null;
        if (!you) return;
        let name = '';
        if (user) {
            const existing = await getProfileName();
            if (existing && existing.trim()) {
                name = existing.trim();
            } else {
                name = generateGoblinName();
                await upsertProfileName(name);
            }
        } else {
            name = generateGoblinName();
        }
        if (name && name !== you.name) {
            you.name = name;
            // Send compact update (name only)
            sendMessage({ type: 'update', g: { i: you.id, n: you.name } });
        }
        // Auth changed could add/remove home portal
        ensureHomePortal();
    });

    // React to profile display-name saves from the account menu
    window.addEventListener('profile:name-updated', (evt) => {
        const newName = (evt.detail?.name || '').trim();
        if (!you || !newName) return;
        if (newName !== you.name) {
            you.name = newName;
            sendMessage({ type: 'update', g: { i: you.id, n: you.name } });
        }
    });

    // When UI color changes (e.g., via profile color picker), update any visible portals
    window.addEventListener('ui:color-changed', (evt) => {
        if (!Array.isArray(you?.ui_color)) return;
        for (const p of portals) {
            if (p && Array.isArray(p.color)) p.color = [...you.ui_color];
        }
        if (homePortal && Array.isArray(you.ui_color)) homePortal.color = [...you.ui_color];
    });
}
window.windowResized = () => { 
    resizeCanvas(windowWidth, windowHeight);
    // Move portals to new positions based on the new window size
    // The first three portals are game-mode portals (creation order stable)
    if (portals[0]) { portals[0].x = width / 2; portals[0].y = height / 2 - 200; }
    if (portals[1]) { portals[1].x = width / 2 + 400; portals[1].y = height / 2 - 200; }
    if (portals[2]) { portals[2].x = width / 2 - 400; portals[2].y = height / 2 - 200; }
    if (homePortal) { homePortal.x = width / 2 + 400; homePortal.y = height / 2 + 150; }
    // Keep our Free Draw portal ref in sync, if present
    if (freedrawPortalRef) { freedrawPortalRef.x = width / 2; freedrawPortalRef.y = height / 2 - 200; }
    // no-op with HTML chat; kept for compatibility
}

window.draw = () => {
    background(240);
    cursor(ARROW); // Set default cursor at the beginning of each frame
    // Reset per-frame render flags for all goblins
    for (let g of goblins) { if (g && typeof g.beginFrame === 'function') g.beginFrame(); }
    
    if (!hasInput) {
        drawTitle();
    } else if (!joined) {
        for (let portal of portals) {
            portal.update(deltaTime);
        }
        // Mobile-only: show a friendly message in place of the Free Draw portal
        if (__isMobile && freedrawPortalRef) {
            push();
            translate(freedrawPortalRef.x, freedrawPortalRef.y);
            textAlign(CENTER, CENTER);
            noStroke();
            // semitransparent rgb(30)
            fill(30, 30, 30, 170);
            textSize(18);
            const msg = "Thanks for visiting Drawblins!\nUnfortunately, this game won't work on a phone,\nbecause you need a keyboard to move.\nSorry about that. -Aidan";
            text(msg, 0, 0);
            pop();
        }
    }


    if (lobby_type === 'freedraw') {
        freedraw_update(deltaTime);
    } else if (lobby_type === 'quickdraw') {
        quickdraw_update(deltaTime);
    } else if (lobby_type === 'guessinggame') {
        guessinggame_update(deltaTime);
    }

    // Update pets after goblin state is updated (they follow owners)
    for (let p of pets) { if (p && typeof p.update === 'function') p.update(deltaTime); }

    // Render pass 1: lines (beneath goblins), in global draw order
    __drawGlobalLines();

    // Render pets before goblins so they appear behind players but above lines
    for (let p of pets) {
        if (!p) continue;
        // Only show pet if its owner is visible this frame
        const ownerVisible = p.owner && p.owner._visibleThisFrame;
        if (ownerVisible && typeof p.display === 'function') p.display();
    }

    // Render pass 2: goblins (sprites and names) on top of pets
    for (let g of goblins) {
        if (g && g._visibleThisFrame && typeof g.display === 'function') {
            g.display(!!g._drawNameThisFrame);
        }
    }

    // Render pass 3: overlays (cursor range, cursor dot, speech), always above goblins
    for (let g of goblins) {
        if (!g || !g._visibleThisFrame) continue;
        if (typeof g.display_range === 'function') g.display_range();
        if (typeof g.display_cursor === 'function') g.display_cursor();
        if (g.speech && typeof g.display_speech === 'function') g.display_speech();
    }

    // Render any active particle bursts above world elements, before UI overlays
    updateBursts();

    // Now render queued UI overlays so they appear above gameplay
    if (_pendingScoreboard) {
        try { drawWaitingWithScoreboard(_pendingScoreboard.time, _pendingScoreboard.results, _pendingScoreboard.goblinsRef, _pendingScoreboard.color); } catch (e) { console.warn('Scoreboard render failed', e); }
        _pendingScoreboard = null;
    }
    if (_pendingHeader) {
        try { drawHeader(_pendingHeader.text, _pendingHeader.time, _pendingHeader.color, _pendingHeader.options || {}); } catch (e) { console.warn('Header render failed', e); }
        _pendingHeader = null;
    }

    // HTML chat doesn't need per-frame drawing, but keep call for compatibility
    chat.update();
    playerList.update();
    toolbelt.update();

    if (drawing && mouseIsPressed) {
        if (you.tool === 'eraser') {
            // Eraser logic: remove lines that are within a radius of the eraser path
            const eraserLine = {
                start: createVector(last_mouse.x, last_mouse.y),
                end: createVector(you.cursor.x, you.cursor.y)
            };
            
            const radius = typeof you.eraserRadius === 'number' ? you.eraserRadius : 15;
            // Check each line for proximity to the eraser path
            let removedAny = false;
            for (let i = you.lines.length - 1; i >= 0; i--) {
                const line = you.lines[i];
                const d = segmentSegmentDistance(eraserLine.start, eraserLine.end, line.start, line.end);
                if (d <= radius) {
                    // Remove from local list; we'll reconcile global registry after the loop
                    you.lines.splice(i, 1);
                    removedAny = true;
                }
            }
            // After mutating local lines, resync the global registry for this owner
            if (removedAny && typeof __syncOwnerLines === 'function') {
                try { __syncOwnerLines(you.id, you.lines); } catch {}
            }
        } else {
            // For drawing, throttle additions if we haven't moved enough
            if (dist(you.cursor.x, you.cursor.y, last_mouse.x, last_mouse.y) < line_granularity) return; // Skip if the mouse hasn't moved enough
            // Regular brush/drawing logic
            var l = new Line(createVector(last_mouse.x, last_mouse.y), createVector(you.cursor.x, you.cursor.y), you.color, 5);
            you.lines.push(l); // Store the line in the goblin's lines array
            try { __registerLine(you.id, l); } catch {}
            // Grain-based drag SFX using segment distance
            if (lastDragX == null) { lastDragX = last_mouse.x; lastDragY = last_mouse.y; }
            const segDx = you.cursor.x - lastDragX;
            const segDy = you.cursor.y - lastDragY;
            const segDist = Math.sqrt(segDx*segDx + segDy*segDy);
            dragAccumDist += segDist;
            lastDragX = you.cursor.x; lastDragY = you.cursor.y;
            // Trigger small grain every ~32px of cumulative stroke distance
            const threshold = 32;
            if (dragAccumDist >= threshold) {
                // Scale intensity with how much over threshold (cap 2x)
                const factor = Math.min(1, (dragAccumDist / threshold));
                playDragGrain(factor);
                dragAccumDist = 0; // reset accumulator
            }
        }
    }

    last_mouse = createVector(you.cursor.x, you.cursor.y);


    heartbeat_timer += deltaTime;
    if (heartbeat_timer >= heartbeat && ws && ws.readyState === WebSocket.OPEN) {
        // Compact, sparse updates: send only necessary fields using short keys.
        // Schema g: { i:id, x, y, c:{x,y}, l:[{sx,sy,ex,ey,w,co:[r,g,b]}], co:[r,g,b], n, s, ui:[r,g,b], t, p:petKey|null }
        // Only include arrays/objects if present to keep JSON small.
        const g = { i: you.id, x: you.x, y: you.y };
        if (you && you.cursor && typeof you.cursor.x === 'number' && typeof you.cursor.y === 'number') g.c = { x: you.cursor.x, y: you.cursor.y };
        if (Array.isArray(you.color)) g.co = [you.color[0]|0, you.color[1]|0, you.color[2]|0];
        if (Array.isArray(you.ui_color)) g.ui = [you.ui_color[0]|0, you.ui_color[1]|0, you.ui_color[2]|0];
        if (you.tool) g.t = you.tool;
        if (you.name) g.n = you.name;
        if (you.shape) g.s = you.shape;
        if (you.petKey) g.p = you.petKey;
        // Lines: send when changed since last send (length changed) OR a newcomer joined since last send
        let didIncludeLines = false;
        const needResendForJoin = (__newPlayersSinceLastSend > 0) && you.lines && you.lines.length > 0;
        if (!window.__lastLineLen || window.__lastLineLen !== you.lines.length || needResendForJoin) {
            if (USE_COMPACT_LINES) {
                const packed = encodeLinesCompact(you.lines, you.color);
                g.lc = packed; // compact base64 payload
                didIncludeLines = true;
            } else {
                const ls = [];
                for (let i = 0; i < you.lines.length; i++) {
                    const seg = you.lines[i];
                    if (!seg) continue;
                    const sx = Array.isArray(seg.start?._values) ? seg.start._values[0] : (seg.start?.x ?? 0);
                    const sy = Array.isArray(seg.start?._values) ? seg.start._values[1] : (seg.start?.y ?? 0);
                    const ex = Array.isArray(seg.end?._values) ? seg.end._values[0] : (seg.end?.x ?? sx);
                    const ey = Array.isArray(seg.end?._values) ? seg.end._values[1] : (seg.end?.y ?? sy);
                    const item = { sx, sy, ex, ey };
                    if (typeof seg.weight === 'number') item.w = seg.weight|0;
                    if (Array.isArray(seg.color)) item.co = [seg.color[0]|0, seg.color[1]|0, seg.color[2]|0];
                    ls.push(item);
                }
                g.l = ls; // legacy verbose
                didIncludeLines = true;
            }
            window.__lastLineLen = you.lines.length;
        }
        sendMessage({ type: 'update', g });
        if (didIncludeLines && __newPlayersSinceLastSend > 0) {
            __newPlayersSinceLastSend = 0; // we've satisfied the resend requirement for late joiners
        }
        heartbeat_timer = 0;
    }
}

function freedraw_update(delta) {
    for (let goblin of goblins) {
        goblin.update(delta);
    }
}

function quickdraw_update(delta) {
    timer -= delta / 1000; // Convert delta to seconds
    timer = Math.max(0, timer); // Ensure timer doesn't go negative

    let headerText = '';
    if (game_state === 'waiting') {
        // Maintain previous winners' bling during the whole next round
        for (let goblin of goblins) {
            goblin.hasBling = quickdrawWinners.has(goblin.id);
            goblin.update(delta, true, true);
        }
        headerText = `Waiting for players...`;
    } else if (game_state === 'drawing') {
        for (let g of goblins) {
            // Keep bling if they are previous winners
            g.hasBling = quickdrawWinners.has(g.id);
            // Only render local player and teammates during drawing
            const isSelf = __idEq(g.id, you.id);
            const isMate = Array.isArray(teammates) && teammates.some(tid => __idEq(tid, g.id));
            if (isSelf || isMate) {
                g.update(delta);
            } else {
                // Do not call update() so this goblin remains invisible this frame
                // (beginFrame() already cleared flags at the start of draw())
            }
        }
        headerText = `Draw [${prompt}]`;
    } else if (game_state === 'pre-voting') {
        for (let goblin of goblins) {
            goblin.hasBling = quickdrawWinners.has(goblin.id);
            goblin.update(delta, false);
        }
        headerText = `Time's up! Get ready to vote.`;
    } else if (game_state === 'voting') {
        for (let goblin of goblins) {
            goblin.hasBling = quickdrawWinners.has(goblin.id);
            const onDeck = (Array.isArray(current_artists) && current_artists.some(id => __idEq(id, goblin.id))) || __idEq(goblin.id, current_artist);
            if (onDeck) goblin.update(delta); else goblin.update(delta, false);
        }
        // In team mode, if you're on the featured team, show the show-off message
        const onTeam = (Array.isArray(current_artists) && current_artists.some(id => __idEq(id, you.id))) || __idEq(you.id, current_artist);
        headerText = onTeam ? 'Show off your team\'s drawing!' : 'Rate this team 1-5';
    } else if (game_state === 'finished') {
        // Determine winners (tie-aware) using highest averageVote
        let winners = [];
        if (Array.isArray(results) && results.length) {
            const maxAvg = results.reduce((m,r)=> r.averageVote>m? r.averageVote : m, -Infinity);
            winners = results.filter(r => r.averageVote === maxAvg && maxAvg >= 0).map(r => r.artistId);
        }
        quickdrawWinners = new Set(winners); // persist through entire next round
        last_winners = new Set(winners);
        // Deterministically pick primary winner only if a team-based top-N wasn't specified in the state-change handler
        if (!last_winners || last_winners.size === 0) {
            quickdrawPrimaryWinner = winners.length ? winners[0] : null;
        }
        let names = [];
        for (let goblin of goblins) {
            if (quickdrawWinners.has(goblin.id)) {
                goblin.hasBling = true;
                if (!goblin.blingType) {
                    const pool = ['crown','halo','chain','shades'];
                    goblin.blingType = pool[Math.floor(Math.random()*pool.length)];
                }
                names.push(goblin.name);
                goblin.update(delta, true, true);
            } else {
                goblin.hasBling = false;
                goblin.update(delta, false, true);
            }
        }
        if (names.length === 0) headerText = 'No winner';
        else if (names.length === 1) headerText = `Winners: ${names[0]} (team)`;
        else headerText = `Winners: ${names.join(', ')}`;
    }
    if (headerText) _pendingHeader = { text: headerText, time: int(timer), color: you.ui_color, options: { revealBursts: (lobby_type === 'guessinggame') } };
}

function guessinggame_update(delta) {
    timer -= delta / 1000; // Convert delta to seconds
    timer = Math.max(0, timer); // Ensure timer doesn't go negative
    var header = "";
    if (game_state === 'waiting') { // See all players, all lines, countdown
        // Compute tie-aware leaders (all highest scores)
        let leaders = [];
        if (results && results.length) {
            const maxScore = results.reduce((m,r)=> r.score>m? r.score : m, -Infinity);
            leaders = results.filter(r => r.score === maxScore && maxScore >= 0).map(r => r.userId);
        }
        guessingWinners = new Set(leaders);
        for (let goblin of goblins) {
            if (guessingWinners.has(goblin.id)) {
                goblin.hasBling = true;
                if (!goblin.blingType) {
                    const pool = ['crown','halo','chain','shades'];
                    goblin.blingType = pool[Math.floor(Math.random()*pool.length)];
                }
            } else {
                goblin.hasBling = false;
            }
            goblin.update(delta, true, true);
        }
        if (results && results.length) {
            _pendingScoreboard = { time: timer, results: results.slice(), goblinsRef: goblins, color: you.ui_color };
        } else {
            header = `Waiting for players...`;
        }
    }
    else if (game_state === 'drawing') { // See current artist's lines, header with underscores of the prompt length, and timer
        for (let goblin of goblins) {
            goblin.hasBling = guessingWinners.has(goblin.id);
            if (goblin.id === current_artist) goblin.update(delta); else goblin.update(delta, false);
        }
        if (you.id === current_artist) {
            header = `Draw a ${prompt}`;
        } else {
            header = prompt;
        }
    }
    else if (game_state === 'reveal') { // See all players, current artist's lines, and a header with the prompt
        for (let goblin of goblins) {
            goblin.hasBling = guessingWinners.has(goblin.id);
            if (goblin.id === current_artist) goblin.update(delta, true); else goblin.update(delta, false);
        }
    // Server sends fully bracketed phrase on reveal; display colored without timer
        header = "It was a " + prompt;
    }

    if (header) _pendingHeader = { text: header, time: int(timer), color: you.ui_color, options: { revealBursts: (lobby_type === 'guessinggame') } };
}

function drawTitle() {
    push();
    translate(0, -100);
    textAlign(CENTER);
    fill(you.ui_color[0], you.ui_color[1], you.ui_color[2]);
    textSize(16);
    text("Click to Draw, WASD or Arrows to Move", width / 2, height / 2 + 50);
    textSize(32);
    textStyle(BOLD);
    text("Drawblins!", width / 2, height / 2);
    pop();
}

window.mousePressed = () => {
    hasInput = true; // Set hasInput to true when the user clicks
    
    // Check if mouse is interacting with any UI elements
    if (chat.isMouseInteracting() || playerList.isMouseInteracting() || toolbelt.isMouseInteracting()) {
        return; // Don't start drawing if interacting with UI
    }
    
    if (game_state === 'voting' || game_state === 'pre-voting') {
        return;
    }
    drawing = true;
    last_mouse = createVector(you.cursor.x, you.cursor.y);
    last_line_count = you.lines.length; // Store the initial line count
    // Thud on initial press (low latency)
    try { playThud(); } catch {}
}

window.mouseReleased = () => {
    if (drawing && you.lines.length === last_line_count && you.tool !== 'eraser') { // If no new line was added and not using eraser
        var l = new Line(createVector(you.cursor.x, you.cursor.y), createVector(you.cursor.x, you.cursor.y), you.color, 5);
        you.lines.push(l); // Store the line in the goblin's lines array
        try { __registerLine(you.id, l); } catch {}
    }
    // Sample visual pop on mouse release (quick, small). Easy to remove later.
    if (drawing && you.tool !== 'eraser') {
        spawnBurst(you.cursor.x, you.cursor.y, you.color, { count: 6 });
    }
    drawing = false;
    // Stop drag sound (fade out quickly by pausing)
    // Reset drag accum tracking & cut residual drag audio
    dragAccumDist = 0; lastDragX = lastDragY = null; stopDragImmediate();
    // Thud on release
    try { playThud(); } catch {}
    // add a dot line to the goblin's lines
}

window.keyPressed = () => {
    hasInput = true; // Set hasInput to true when the user presses a key
    // With HTML chat, Enter is handled via DOM listeners in chat.js
}

window.addEventListener('keydown', (event) => {
    const t = event.target;
    const tag = t && t.tagName ? t.tagName.toLowerCase() : '';
    const typing = tag === 'input' || tag === 'textarea' || (t && t.isContentEditable);
    if (typing) return; // do not capture WASD when typing in chat/input
    // Hotkeys: tool selection (only when not typing)
    if (event.code === 'Digit1') { you.tool = 'brush'; }
    else if (event.code === 'Digit2') { you.tool = 'eraser'; }
    you.keyStates[event.key] = true;
});
window.addEventListener('keyup', (event) => {
    const t = event.target;
    const tag = t && t.tagName ? t.tagName.toLowerCase() : '';
    const typing = tag === 'input' || tag === 'textarea' || (t && t.isContentEditable);
    if (typing) return; // ignore keyup from typing contexts
    you.keyStates[event.key] = false; // Reset the key state when the key is
});

window.addEventListener('blur', () => {
    // Reset the key states when the window loses focus
    for (let k in you.keyStates) {
        you.keyStates[k] = false;
    }
    you.input.x = 0; // Reset input to prevent movement when focus is regained
    you.input.y = 0; // Reset input to prevent movement when focus is regained
});

// -- Networking Setup --
function onopen() {
    console.log("WebSocket connection established");
    // TODO: maybe useful to send an introductory message, once the goblin is loaded
    // Clear any existing local drawing lines upon joining a (new) lobby
    // This ensures previous lobby's drawings don't persist across lobby boundaries.
    if (you && Array.isArray(you.lines)) {
        you.lines = [];
        try { __clearOwnerLines(you.id); } catch {}
    }
}
function onmessage(event) {
    let data;
    try {
        data = JSON.parse(event.data);
    } catch (e) {
        console.error('Invalid JSON from server:', e);
        return;
    }
    // print(data);
    // Handle incoming messages from the server
    if (!data || !data.type) {
        console.error("Invalid data received:", data);
        return;
    }

    switch (data.type) {
        case 'house_unavailable':
            // Redirect back to homepage if the requested house is unavailable
            try {
                const base = new URL(window.location.href);
                // Go to the app root (index.html) by stripping path after last slash
                const home = `${base.origin}${base.pathname.replace(/\/(house|login)(?:\.html)?$/i, '/')}`;
                window.location.replace(home);
            } catch {
                window.location.replace('/');
            }
            return;
        case 'house_mode':
            // Server announcing mode change for house
            if (typeof data.mode === 'string') {
                const prev = lobby_type;
                lobby_type = data.mode;
                try { setHouseMode(lobby_type); } catch {}
                // Reset local state when switching between fundamentally different modes
                if (lobby_type === 'freedraw') {
                    game_state = 'lobby';
                    prompt = '';
                    results = [];
                    current_artist = -1;
                } else if (lobby_type === 'quickdraw') {
                    game_state = 'waiting';
                    prompt = '';
                    results = [];
                    current_artist = -1;
                } else if (lobby_type === 'guessinggame') {
                    game_state = 'waiting';
                    prompt = '';
                    results = [];
                    current_artist = -1;
                }
                // If mode changed, consider clearing drawings when leaving drawing/voting phases
                if (prev !== lobby_type) {
                    for (let g of goblins) g.lines = g.lines || [];
                }
            }
            return; // consume
        case "chat":
            // Handle chat messages
            if (data.userId) {
                let chatUser = goblins.find(g => g.id === data.userId);
                if (chatUser && typeof chatUser.say === 'function') {
                    chatUser.say(data.content);
                    if (chat && typeof chat.addMessage === 'function') chat.addMessage({ user: chatUser, content: data.content });
                } else {
                    if (chat && typeof chat.addMessage === 'function') chat.addMessage({ user: null, content: data.content });
                }
                if (data.guessed && Array.isArray(data.guessed) && typeof guessed_words !== 'undefined' && guessed_words && typeof guessed_words.add === 'function') {
                    for (const g of data.guessed) {
                        if (g.guessed) guessed_words.add(g.word);
                    }
                }
            } else {
                if (chat && typeof chat.addMessage === 'function') chat.addMessage({ user: null, content: data.content });
                if (data.guessed && Array.isArray(data.guessed) && typeof guessed_words !== 'undefined' && guessed_words && typeof guessed_words.add === 'function') {
                    for (const g of data.guessed) {
                        if (g.guessed) guessed_words.add(g.word);
                    }
                }
            }
            break;
        case "update":
            // Support both legacy full shape (goblin) and compact shape (g)
            const payload = data.goblin ? data.goblin : (data.g ? {
                id: data.g.i,
                x: data.g.x, y: data.g.y,
                cursor: data.g.c,
                lines: data.g.l,
                color: data.g.co,
                name: data.g.n,
                shape: data.g.s,
                ui_color: data.g.ui,
                tool: data.g.t,
                petKey: data.g.p
            } : null);
            if (!payload || payload.id == null) break;
            // Detect whether the original message explicitly contained lines
            const __hadLines = (data.goblin && Object.prototype.hasOwnProperty.call(data.goblin, 'lines'))
                || (data.g && (Object.prototype.hasOwnProperty.call(data.g, 'l') || Object.prototype.hasOwnProperty.call(data.g, 'lc')));
            let goblin = goblins.find(g => g.id === payload.id);
            if (!goblin) {
                // If the goblin doesn't exist, create a new one
                const color = Array.isArray(payload.color) && payload.color.length===3 ? payload.color : randomPaletteColor();
                const newcomer = new Goblin(payload.x, payload.y, color, false, payload.id, payload.shape, payload.name || '');
                try { newcomer.triggerAppear?.(); } catch {}
                goblins.push(newcomer);
                // A new player joined; request that we resend our lines on next heartbeat so they see existing drawings
                if (you && you.id !== newcomer.id && you.lines && you.lines.length > 0) {
                    __newPlayersSinceLastSend += 1;
                }
                // Attach pet if provided and valid
                if (payload.petKey && typeof payload.petKey === 'string') {
                    try { const p = new Pet(newcomer, payload.petKey); pets.push(p); newcomer.petKey = payload.petKey; } catch {}
                }
                // Continue into the normal goblin update path by assigning
                // so we apply cursor, lines, etc.
                goblin = newcomer;
            }
            if (goblin) {
                goblin.x = payload.x;
                goblin.y = payload.y;
                if (payload.cursor && Array.isArray(payload.cursor._values)) {
                    goblin.cursor = createVector(payload.cursor._values[0], payload.cursor._values[1]);
                } else if (payload.cursor && typeof payload.cursor.x === 'number' && typeof payload.cursor.y === 'number') {
                    goblin.cursor = createVector(payload.cursor.x, payload.cursor.y);
                }
                goblin.color = (Array.isArray(payload.color) && payload.color.length===3) ? payload.color : goblin.color;
                if (Array.isArray(payload.ui_color)) goblin.ui_color = payload.ui_color; else if (Array.isArray(payload.ui)) goblin.ui_color = payload.ui;
                goblin.tool = payload.tool || payload.t || 'brush';
                goblin.name = payload.name || payload.n || goblin.name || '';
                goblin.shape = payload.shape || payload.s || goblin.shape || 'manny';
                goblin.setSize();
                // Handle pet changes (create/update/remove)
                const incomingPet = payload.petKey || payload.p || null;
                if (incomingPet && typeof incomingPet === 'string') {
                    if (!goblin.petKey || goblin.petKey !== incomingPet) {
                        // Replace or create
                        let existingPet = pets.find(p => p.owner === goblin);
                        if (!existingPet) {
                            try { existingPet = new Pet(goblin, incomingPet); pets.push(existingPet); } catch {}
                        } else {
                            existingPet.spriteKey = incomingPet;
                            if (typeof existingPet.setSize === 'function') existingPet.setSize();
                        }
                        goblin.petKey = incomingPet;
                    }
                } else if (!incomingPet && goblin.petKey) {
                    // Remove existing pet if entitlement revoked or cleared
                    const idx = pets.findIndex(p => p.owner === goblin);
                    if (idx !== -1) pets.splice(idx, 1);
                    goblin.petKey = null;
                }
                // Rebuild remote user's lines only if the update explicitly included them; otherwise preserve existing.
                if (__hadLines) {
                    let rebuilt = [];
                    // Prefer compact lc if present
                    if (data.g && typeof data.g.lc === 'string' && data.g.lc.length) {
                        const ownerColor = Array.isArray(payload.color) ? payload.color : goblin.color;
                        try { rebuilt = decodeLinesCompact(data.g.lc, ownerColor); } catch (e) { console.warn('Failed to decode compact lines:', e); rebuilt = []; }
                    } else {
                        const incomingLines = Array.isArray(payload.lines) ? payload.lines : (Array.isArray(payload.l) ? payload.l : []);
                        for (let i = 0; i < incomingLines.length; i++) {
                            const seg = incomingLines[i];
                            const sx = seg.sx != null ? seg.sx : ((seg.start && Array.isArray(seg.start._values)) ? seg.start._values[0] : (seg.start && typeof seg.start.x === 'number' ? seg.start.x : 0));
                            const sy = seg.sy != null ? seg.sy : ((seg.start && Array.isArray(seg.start._values)) ? seg.start._values[1] : (seg.start && typeof seg.start.y === 'number' ? seg.start.y : 0));
                            const ex = seg.ex != null ? seg.ex : ((seg.end && Array.isArray(seg.end._values)) ? seg.end._values[0] : (seg.end && typeof seg.end.x === 'number' ? seg.end.x : sx));
                            const ey = seg.ey != null ? seg.ey : ((seg.end && Array.isArray(seg.end._values)) ? seg.end._values[1] : (seg.end && typeof seg.end.y === 'number' ? seg.end.y : sy));
                            const col = Array.isArray(seg.co) ? seg.co : seg.color;
                            const w = seg.w != null ? seg.w : seg.weight;
                            rebuilt.push(new Line(createVector(sx, sy), createVector(ex, ey), col, w));
                        }
                    }
                    goblin.lines = rebuilt;
                    try { __syncOwnerLines(goblin.id, rebuilt); } catch {}
                }
            }
            break;
        case "user_left":
            // Handle user leaving the game
            const index = goblins.findIndex(g => g.id === data.userId);
            if (index !== -1) {
                const leavingGoblin = goblins[index];
                // Remove any pet(s) owned by this goblin
                for (let i = pets.length - 1; i >= 0; i--) {
                    const owner = pets[i]?.owner;
                    if (owner && (owner === leavingGoblin || owner.id === data.userId)) {
                        pets.splice(i, 1);
                    }
                }
                goblins.splice(index, 1); // Remove the goblin from the list
                try { __clearOwnerLines(data.userId); } catch {}
                console.log(`User ${data.userId} has left the game.`);
            } else {
                console.warn(`User ${data.userId} not found in goblins.`);
            }
            break;

    case "game_state":
            // Remember previous state to detect visibility transitions
            const prev_state = game_state;
            if (lobby_type === 'quickdraw') {
                if (data.state === 'waiting') {
                    // After finished phase, clear all drawings before waiting
                    for (let goblin of goblins) { goblin.lines = []; try { __clearOwnerLines(goblin.id); } catch {} }
                    timer = data.time;
                    teammates = [];
                    current_artists = [];

                } else if (data.state === 'drawing') {
                    if (game_state !== 'drawing') { // just entered the drawing state, clear previous drawings
                        for (let goblin of goblins) { goblin.lines = []; try { __clearOwnerLines(goblin.id); } catch {} }
                    }
                    prompt = data.prompt;
                    timer = data.time;
                    // Track your teammates for this round
                    teammates = Array.isArray(data.teammates) ? data.teammates.slice() : [];
                    current_artists = [];

                } else if (data.state === 'pre-voting') {
                    timer = data.time;

                } else if (data.state === 'voting') {
                    // Accept both legacy single and new team list
                    current_artist = typeof data.artistId !== 'undefined' ? data.artistId : -1;
                    current_artists = Array.isArray(data.artistIds) ? data.artistIds.slice() : (current_artist != null && current_artist !== -1 ? [current_artist] : []);
                    timer = data.time;

                } else if (data.state === 'finished') {
                    timer = data.time;
                    results = data.results;
                    // Optionally limit visible winning drawings to firstPlaceTeamSize
                    const n = typeof data.firstPlaceTeamSize === 'number' ? Math.max(0, data.firstPlaceTeamSize|0) : 0;
                    if (n > 0 && Array.isArray(results) && results.length >= n) {
                        // Keep only first N entries' artistIds as the primary winners for line rendering
                        const topIds = results.slice(0, n).map(r => r.artistId);
                        last_winners = new Set(topIds);
                        // Show all team members' drawings during finished phase
                        quickdrawPrimaryWinner = null;
                    }
                }

                game_state = data.state;
            }
            else if (lobby_type === 'guessinggame') {
                if (data.state === 'waiting') {
                    // Entering scoreboard/waiting: clear all drawings so text isn't overlapped
                    for (let g of goblins) { g.lines = []; try { __clearOwnerLines(g.id); } catch {} }
                    timer = data.time;
                } else if (data.state === 'drawing') {
                    current_artist = data.artistId;
                    // if you are the artist, you received the prompt
                    if (you.id === current_artist) {
                        if (game_state !== 'drawing') { // just entered the drawing state, clear previous drawings
                            you.lines = []; // Clear previous lines for the new drawing
                            try { __clearOwnerLines(you.id); } catch {}
                        }
                        prompt = data.prompt;
                    } else {
                        // otherwise you just receive masked prompt already in data.prompt
                        prompt = data.prompt;
                    }
                    timer = data.time;
                } else if (data.state === 'reveal') {
                    prompt = data.prompt;
                    current_artist = data.artistId;
                    timer = data.time;
                }
                // Always update results if scores provided (waiting phase or other states)
                if (data.scores && Array.isArray(data.scores)) {
                    results = data.scores;
                }
                game_state = data.state;
            }

            // Removed blanket pop-in triggers on state change; goblins now pop only on first render

            break;
        case 'prompt_update':
            if (lobby_type === 'guessinggame' && game_state === 'drawing' && you.id !== current_artist) {
                prompt = data.prompt; // updated masked prompt with newly revealed words for this player only
            }
            break;
        case 'point_scored':
            // Update local scoreboard cache if we have it
            if (lobby_type === 'guessinggame') {
                const { userId, points } = data;
                if (userId != null && typeof points === 'number') {
                    let entry = results.find(r => r.userId === userId);
                    if (!entry) {
                        entry = { userId, score: 0 };
                        results.push(entry);
                    }
                    entry.score += points;
                    // Show floating burst in player list
                    if (playerList && typeof playerList.addPointBurst === 'function') {
                        playerList.addPointBurst(userId, points);
                    }
                }
            }
            break;
    }
}

export { you, goblins, chat, onopen, onmessage, pets };