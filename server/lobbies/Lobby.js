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
        for (const client of this.clients) {
            if (client !== excludeSocket && client.readyState === client.OPEN) {
                client.send(JSON.stringify(message));
            }
        }
    }

    sendTo(socket, message) {
        if (socket.readyState === socket.OPEN) {
            socket.send(JSON.stringify(message));
        } else {
            console.error("Socket is not open. Unable to send message.");
        }
    }

    // Handle incoming messages - can be overridden by subclasses
    handleMessage(socket, message) {
        // Handle different message types
        if (message.type === "update") {
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
            console.log(`Received chat message from ${message.userId} in lobby ${this.id}: ${message.content}`);
            // Broadcast chat to ALL including sender
            this.broadcast(message, null);
            return;
        }
        // Default: broadcast to all others
        this.broadcast(message, socket);
    }
}

export default Lobby;
