const ws = new WebSocket("https://backend-wmm9.onrender.com"); // Change to server URL
// const ws = new WebSocket("ws://localhost:3000");

// ws.onopen and ws.onmessage handled in index.js

function sendMessage(message) {
    if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify(message));
    } else {
        console.error("WebSocket is not open. Unable to send message.");
    }
}

export { ws, sendMessage };