import { onopen, onmessage } from './index.js'; // Import handlers from index.js
// Network configuration
// const BASE_URL = "ws://localhost:3000"; // Change to server URL
const BASE_URL = "wss://api.drawbl.in"; // Production URL

// Resolve HTTP API base for REST calls (MOTD, etc.)
function getApiBase() {
    try {
        const { hostname } = window.location;
        const isLocal = hostname === 'localhost' || hostname === '127.0.0.1' || hostname.endsWith('.local');
        if (isLocal) return 'http://localhost:3000';
    } catch (_) { /* no window */ }
    return 'https://api.drawbl.in';
}

let ws = null;

// Lightweight mobile detection (kept local to avoid importing index.js and creating a cycle)
function isMobileDevice() {
    try {
        const ua = (navigator.userAgent || navigator.vendor || window.opera || '').toLowerCase();
        const uaHit = /(android|iphone|ipad|ipod|blackberry|iemobile|opera mini)/i.test(ua);
        const coarse = (window.matchMedia && matchMedia('(pointer:coarse)').matches) || (navigator.maxTouchPoints || 0) > 1;
        return !!(uaHit || coarse);
    } catch (e) { return false; }
}

function connect(gameType = 'freedraw', query = null) {
    // Close existing connection if any
    if (ws && ws.readyState !== WebSocket.CLOSED) {
        ws.close();
    }

    // Validate game type and construct endpoint
    const validGameTypes = ['freedraw', 'quickdraw', 'guessinggame', 'house'];
    if (!validGameTypes.includes(gameType)) {
        console.error(`Invalid game type: ${gameType}. Valid types are: ${validGameTypes.join(', ')}`);
        gameType = 'freedraw'; // Default fallback
    }

    // If on mobile, map main game types to their mobile endpoints (except house which remains the same)
    try {
        if (isMobileDevice() && gameType !== 'house') {
            const mobileSuffix = '_mobile';
            const mobileCandidate = `${gameType}${mobileSuffix}`;
            // Use the mobile endpoint name; server accepts these paths (e.g., /freedraw_mobile)
            gameType = mobileCandidate;
        }
    } catch (e) { /* ignore detection failures and keep default gameType */ }

    // Build optional query string
    let qs = '';
    if (query && typeof query === 'object') {
        const parts = Object.entries(query)
            .filter(([k, v]) => v !== undefined && v !== null && v !== '')
            .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`);
        if (parts.length) qs = `?${parts.join('&')}`;
    }

    const endpoint = `${BASE_URL}/${gameType}${qs}`;
    console.log(`Connecting to ${gameType} lobby at ${endpoint}`);
    
    ws = new WebSocket(endpoint);
    
    ws.onopen = onopen; // Set up the onopen handler
    ws.onmessage = onmessage; // Set up the onmessage handler
    return ws;
}

function sendMessage(message) {
    if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify(message));
    } else {
        console.error("WebSocket is not open. Unable to send message.");
    }
}

export { ws, connect, sendMessage };
export { getApiBase };