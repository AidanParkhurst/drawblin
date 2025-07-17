// server/server.js
import { WebSocketServer } from 'ws';
import http from 'http';
import url from 'url';
import FreeDrawLobby from './lobbies/FreeDrawLobby.js';
import QuickDrawLobby from './lobbies/QuickDrawLobby.js';
import GuessingGameLobby from './lobbies/GuessingGameLobby.js';

const PORT = process.env.PORT || 3000; 

// Optional: create an HTTP server (required by some platforms like Railway)
const server = http.createServer((req, res) => {
    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.end(`
        <h1>Drawblin WebSocket Server</h1>
        <p>Available endpoints:</p>
        <ul>
            <li><strong>/freedraw</strong> - Free drawing lobbies</li>
            <li><strong>/quickdraw</strong> - Quick draw challenge lobbies</li>
            <li><strong>/guessinggame</strong> - Guessing game lobbies</li>
        </ul>
    `);
});

const wss = new WebSocketServer({ 
    server,
    verifyClient: (info) => {
        // Parse the URL to get the path
        const pathname = url.parse(info.req.url).pathname;
        const validPaths = ['/freedraw', '/quickdraw', '/guessinggame'];
        
        if (!validPaths.includes(pathname)) {
            console.log(`Rejected connection to invalid path: ${pathname}`);
            return false;
        }
        
        return true;
    }
});

const lobbies = new Map(); // lobbyId -> Lobby
const socketToLobby = new Map(); // socket -> lobbyId
let nextLobbyId = 1;

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
    console.log(`Created new ${lobbyType} lobby ${newLobby.id}`);
    return newLobby;
}

wss.on('connection', (socket, request) => {
    // Parse the URL to determine lobby type
    const pathname = url.parse(request.url).pathname;
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
        default:
            // This shouldn't happen due to verifyClient, but just in case
            lobbyType = 'freedraw';
            break;
    }

    // Assign client to a lobby of the specified type
    const lobby = findOrCreateLobby(lobbyType);
    lobby.addClient(socket);
    socketToLobby.set(socket, lobby.id);

    console.log(`New client connected to ${lobbyType} lobby ${lobby.id} via ${pathname}`);

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

        // Delegate message handling to the lobby
        currentLobby.handleMessage(socket, message);
    });

    socket.on('close', () => {
        const lobbyId = socketToLobby.get(socket);
        if (lobbyId) {
            const lobby = lobbies.get(lobbyId);
            if (lobby) {
                lobby.removeClient(socket);
                
                // Clean up empty lobbies (optional - you might want to keep them for a while)
                if (lobby.clients.size === 0) {
                    lobby.stopGameLoop(); // Stop any ongoing game loop
                    lobbies.delete(lobbyId);
                    console.log(`Removed empty lobby ${lobbyId}`);
                }
            }
            socketToLobby.delete(socket);
        }
        console.log('Client disconnected');
    });
});

server.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
