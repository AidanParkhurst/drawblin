import p5 from "p5";

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
let current_artist = -1; // id of the artist who drew the art being voted on
let results = [];
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
    let quickdraw_portal = new Portal(width / 2 + 400, height / 2 - 200, 150, you.ui_color, "Stand here to join\nQuick Draw", () => {
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

    ensureHomePortal();

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
            sendMessage({ type: 'update', goblin: you });
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
            sendMessage({ type: 'update', goblin: you });
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

    // Render pass 1: lines (beneath goblins)
    for (let g of goblins) {
        if (g && g._visibleThisFrame && g._linesVisibleThisFrame && typeof g.display_lines === 'function') {
            g.display_lines(g.lines || []);
        }
    }

    // Render pass 2: goblins (sprites and names)
    for (let g of goblins) {
        if (g && g._visibleThisFrame && typeof g.display === 'function') {
            g.display(!!g._drawNameThisFrame);
        }
    }

    // Render pets after goblins so they appear in front of lines and mixed with characters
    for (let p of pets) { if (p && typeof p.display === 'function') p.display(); }

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
            for (let i = you.lines.length - 1; i >= 0; i--) {
                const line = you.lines[i];
                const d = segmentSegmentDistance(eraserLine.start, eraserLine.end, line.start, line.end);
                if (d <= radius) you.lines.splice(i, 1);
            }
        } else {
            // For drawing, throttle additions if we haven't moved enough
            if (dist(you.cursor.x, you.cursor.y, last_mouse.x, last_mouse.y) < line_granularity) return; // Skip if the mouse hasn't moved enough
            // Regular brush/drawing logic
            var l = new Line(createVector(last_mouse.x, last_mouse.y), createVector(you.cursor.x, you.cursor.y), you.color, 5);
            you.lines.push(l); // Store the line in the goblin's lines array
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
        // Send the updated goblin state to the server
        // Shallow clone to avoid sending large circular references; include lines & petKey explicitly
        const outbound = { 
            id: you.id,
            x: you.x,
            y: you.y,
            cursor: you.cursor,
            lines: you.lines,
            color: you.color,
            name: you.name,
            shape: you.shape,
            ui_color: you.ui_color,
            tool: you.tool,
            petKey: you.petKey || null
        };
        sendMessage({
            type: "update",
            goblin: outbound
        });
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
        }
        you.update(delta);
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
            if (goblin.id === current_artist) goblin.update(delta); else goblin.update(delta, false);
        }
        headerText = `Rate this drawing 1-5`;
    } else if (game_state === 'finished') {
        // Determine winners (tie-aware) using highest averageVote
        let winners = [];
        if (Array.isArray(results) && results.length) {
            const maxAvg = results.reduce((m,r)=> r.averageVote>m? r.averageVote : m, -Infinity);
            winners = results.filter(r => r.averageVote === maxAvg && maxAvg >= 0).map(r => r.artistId);
        }
        quickdrawWinners = new Set(winners); // persist through entire next round
        last_winners = new Set(winners);
        // Deterministically pick primary winner whose drawing will persist into next round
        quickdrawPrimaryWinner = winners.length ? winners[0] : null;
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
        else if (names.length === 1) headerText = `Winner: ${names[0]}!`;
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
            // Update the goblin's position and state based on the received data
            const goblin = goblins.find(g => g.id === data.goblin.id);
            if (!goblin) {
                // If the goblin doesn't exist, create a new one
                const color = Array.isArray(data.goblin.color) && data.goblin.color.length===3 ? data.goblin.color : randomPaletteColor();
                const newcomer = new Goblin(data.goblin.x, data.goblin.y, color, false, data.goblin.id, data.goblin.shape, data.goblin.name || '');
                try { newcomer.triggerAppear?.(); } catch {}
                goblins.push(newcomer);
                // Attach pet if provided and valid
                if (data.goblin.petKey && typeof data.goblin.petKey === 'string') {
                    try { const p = new Pet(newcomer, data.goblin.petKey); pets.push(p); newcomer.petKey = data.goblin.petKey; } catch {}
                }
                return;
            }
            if (goblin) {
                // TODO: Prob shouldn't be accessing _values, but otherwise it doesnt work
                goblin.x = data.goblin.x;
                goblin.y = data.goblin.y;
                if (data.goblin.cursor && Array.isArray(data.goblin.cursor._values)) {
                    goblin.cursor = createVector(data.goblin.cursor._values[0], data.goblin.cursor._values[1]);
                } else if (data.goblin.cursor && typeof data.goblin.cursor.x === 'number' && typeof data.goblin.cursor.y === 'number') {
                    goblin.cursor = createVector(data.goblin.cursor.x, data.goblin.cursor.y);
                }
                goblin.color = (Array.isArray(data.goblin.color) && data.goblin.color.length===3) ? data.goblin.color : goblin.color;
                goblin.ui_color = data.goblin.ui_color;
                goblin.tool = data.goblin.tool || 'brush'; // Update tool, default to brush if not provided
                goblin.name = data.goblin.name || goblin.name || '';
                goblin.shape = data.goblin.shape || goblin.shape || 'manny';
                goblin.setSize();
                // Handle pet changes (create/update/remove)
                const incomingPet = data.goblin.petKey || null;
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
                if (goblin.lines.length !== data.goblin.lines.length) {
                    goblin.lines = [];
                    for (let i = 0; i < data.goblin.lines.length; i++) {
                        goblin.lines.push(new Line(
                            createVector(data.goblin.lines[i].start._values[0], data.goblin.lines[i].start._values[1]),
                            createVector(data.goblin.lines[i].end._values[0], data.goblin.lines[i].end._values[1]),
                            data.goblin.lines[i].color,
                            data.goblin.lines[i].weight));
                    }
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
                            if (game_state === 'finished' && last_winners.size > 0) { // game restarted
                                if (lobby_type === 'quickdraw') {
                                    // Keep only primary winner's drawing (avoid overlapping multiple winning drawings)
                                    for (let goblin of goblins) {
                                        if (quickdrawPrimaryWinner == null || goblin.id !== quickdrawPrimaryWinner) {
                                            goblin.lines = [];
                                        }
                                    }
                                } else {
                                    // Other modes may keep all winners (currently none use this branch)
                                    for (let goblin of goblins) {
                                        if (!last_winners.has(goblin.id)) goblin.lines = [];
                                    }
                                }
                            }
                    timer = data.time;

                } else if (data.state === 'drawing') {
                    if (game_state !== 'drawing') { // just entered the drawing state, clear previous drawings
                        for (let goblin of goblins) {
                            goblin.lines = [];
                        }
                    }
                    prompt = data.prompt;
                    timer = data.time;

                } else if (data.state === 'pre-voting') {
                    timer = data.time;

                } else if (data.state === 'voting') {
                    current_artist = data.artistId; // Set the current artist for voting
                    timer = data.time;

                } else if (data.state === 'finished') {
                    timer = data.time;
                    results = data.results;
                }

                game_state = data.state;
            }
            else if (lobby_type === 'guessinggame') {
                if (data.state === 'waiting') {
                    // Entering scoreboard/waiting: clear all drawings so text isn't overlapped
                    for (let g of goblins) { g.lines = []; }
                    timer = data.time;
                } else if (data.state === 'drawing') {
                    current_artist = data.artistId;
                    // if you are the artist, you received the prompt
                    if (you.id === current_artist) {
                        if (game_state !== 'drawing') { // just entered the drawing state, clear previous drawings
                            you.lines = []; // Clear previous lines for the new drawing
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