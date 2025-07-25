import { onopen, onmessage } from './index.js'; // Import handlers from index.js
// Network configuration
// const BASE_URL = "ws://localhost:3000"; // Change to server URL
const BASE_URL = "https://backend-wmm9.onrender.com"; // Production URL

let ws = null;

function connect(gameType = 'freedraw') {
    // Close existing connection if any
    if (ws && ws.readyState !== WebSocket.CLOSED) {
        ws.close();
    }

    // Validate game type and construct endpoint
    const validGameTypes = ['freedraw', 'quickdraw', 'guessinggame'];
    if (!validGameTypes.includes(gameType)) {
        console.error(`Invalid game type: ${gameType}. Valid types are: ${validGameTypes.join(', ')}`);
        gameType = 'freedraw'; // Default fallback
    }

    const endpoint = `${BASE_URL}/${gameType}`;
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