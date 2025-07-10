// server/server.js
import { WebSocketServer } from 'ws';
import http from 'http';

const PORT = process.env.PORT || 3000;

// Optional: create an HTTP server (required by some platforms like Railway)
const server = http.createServer((req, res) => {
    res.writeHead(200);
    res.end("WebSocket server running");
});

const wss = new WebSocketServer({ server });

const clients = new Set();
const users = new Map(); // To store user data

wss.on('connection', socket => {
    clients.add(socket);

    socket.on('message', data => {
        var message = JSON.parse(data);
        if (message.type === "update") {
            users.set(socket, {id: message.goblin.id});
        }
        if (message.type === "chat") {
            // Handle chat messages
            console.log("Received chat message:", message);
            if (users.has(socket)) {
                const user = users.get(socket);
                message.userId = user.id; // Attach user ID to the message
            } else {
                message.userId = "unknown"; // Default if no user ID is set
            }
            console.log(`Received chat message from ${message.userId}: ${message.content}`);
        }
        // Broadcast received message to all other clients
        for (const client of clients) {
            if (client !== socket && client.readyState === socket.OPEN) {
                client.send(JSON.stringify(message));
            }
        }
    });

    socket.on('close', () => {
        clients.delete(socket);
    });
});

server.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
