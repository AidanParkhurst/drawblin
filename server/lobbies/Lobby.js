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

    // Handle incoming messages - can be overridden by subclasses
    handleMessage(socket, message) {
        // Handle different message types
        if (message.type === "update") {
            // Add or update user 
            this.users.set(socket, { id: message.goblin.id });
        } else if (message.type === "chat") {
            // Handle chat messages
            if (this.users.has(socket)) {
                const user = this.users.get(socket);
                message.userId = user.id; // Attach user ID to the message
            } else {
                message.userId = "unknown"; // Default if no user ID is set
            }
            console.log(`Received chat message from ${message.userId} in lobby ${this.id}: ${message.content}`);
        }

        // Broadcast message to all other clients in the same lobby
        this.broadcast(message, socket);
    }
}

export default Lobby;
