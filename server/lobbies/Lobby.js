// Base Lobby class
class Lobby {
    constructor(id, maxPlayers = 4) {
        this.id = id;
        this.maxPlayers = maxPlayers;
        this.clients = new Set();
        this.users = new Map(); // socket -> user data
    }

    addClient(socket) {
        this.clients.add(socket);
        console.log(`Client added to lobby ${this.id}. Lobby size: ${this.clients.size}/${this.maxPlayers}`);
    }

    removeClient(socket) {
        if (this.users.has(socket)) {
            this.broadcast({ type: "user_left", userId: this.users.get(socket).id });
        }
        this.clients.delete(socket);
        this.users.delete(socket);
        console.log(`Client removed from lobby ${this.id}. Lobby size: ${this.clients.size}/${this.maxPlayers}`);
        if (this.onClientRemoved) {
            try { this.onClientRemoved(socket); } catch(e){ console.error(e); }
        }
    }

    isFull() {
        return this.clients.size >= this.maxPlayers;
    }

    broadcast(message, excludeSocket = null) {
        const json = JSON.stringify(message);
        for (const client of this.clients) {
            if (client === excludeSocket) continue;
            try {
                // ws: OPEN === 1
                if (client.readyState === 1 || client.readyState === client.OPEN) {
                    client.send(json);
                }
            } catch (e) {
                // Guard against crashes from stale sockets; they'll be cleaned up on 'close'
                console.error(`Broadcast send failed in lobby ${this.id}:`, e?.message || e);
            }
        }
    }

    sendTo(socket, message) {
        try {
            if (socket && (socket.readyState === 1 || socket.readyState === socket.OPEN)) {
                socket.send(JSON.stringify(message));
            } else {
                console.error("Socket is not open. Unable to send message.");
            }
        } catch (e) {
            console.error(`sendTo failed in lobby ${this.id}:`, e?.message || e);
        }
    }

    // Handle incoming messages - can be overridden by subclasses
    handleMessage(socket, message) {
        // Handle different message types
        if (message.type === "update") {
            // Defensive sanitation for goblin name if present (length/cntl chars only; HTML escaping handled in server.js)
            if (message.goblin && typeof message.goblin.name === 'string') {
                try {
                    message.goblin.name = message.goblin.name.replace(/[\u0000-\u001F\u007F]/g, '').slice(0, 40);
                } catch(_) {}
            }
            this.users.set(socket, { id: message.goblin.id });
            // Broadcast updates to everyone else (exclude sender for position updates)
            this.broadcast(message, socket);
            return;
        } else if (message.type === "chat") {
            if (this.users.has(socket)) {
                const user = this.users.get(socket);
                message.userId = user.id;
            } else {
                message.userId = "unknown";
            }
            // Defensive sanitation for chat content (length/cntl chars only; HTML escaping handled in server.js)
            if (typeof message.content === 'string') {
                try { message.content = message.content.replace(/[\u0000-\u001F\u007F]/g, '').slice(0, 240); } catch(_) {}
            } else { message.content = ''; }
            console.log(`Received chat message from ${message.userId} in lobby ${this.id}: ${message.content}`);
            // Broadcast chat to ALL including sender
            this.broadcast(message, null);
            return;
        }
        // Default: broadcast to all others
        this.broadcast(message, socket);
    }
}

// Convenience for subclasses: safely get a user's id from a socket
Lobby.prototype.getUserId = function(socket) {
    try {
        return this.users.get(socket)?.id ?? null;
    } catch (_) {
        return null;
    }
};

export default Lobby;
