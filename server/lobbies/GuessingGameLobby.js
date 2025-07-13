import Lobby from './Lobby.js';

class GuessingGameLobby extends Lobby {
    constructor(id) {
        super(id, 4); // Guessing game optimal with 3-4 players (1 drawer, 2-3 guessers)
        this.gameState = "waiting"; // waiting, drawing, guessing, reveal, finished
        this.currentDrawer = null; // socket of current drawer
        this.secretWord = ""; // word being drawn
        this.guesses = new Map(); // socket -> guess
        this.scores = new Map(); // socket -> score
        this.drawingTime = 90; // seconds
        this.timer = 0;
    }

    handleMessage(socket, message) {
        if (message.type === "update") {
            this.users.set(socket, { id: message.goblin.id });
            
            // Only allow drawing updates from the current drawer during drawing phase
            if (this.gameState === "drawing" && socket === this.currentDrawer) {
                this.broadcast(message, socket);
            } else if (this.gameState === "waiting") {
                this.broadcast(message, socket);
            }
        } else if (message.type === "chat") {
            if (this.users.has(socket)) {
                const user = this.users.get(socket);
                message.userId = user.id;
            } else {
                message.userId = "unknown";
            }
            
            // In guessing game, check if chat message is a guess
            if (this.gameState === "drawing" && socket !== this.currentDrawer) {
                // This is a guess - store it and check if correct
                this.guesses.set(socket, message.content.toLowerCase().trim());
                console.log(`Guessing game lobby ${this.id} guess from ${message.userId}: ${message.content}`);
                
                // Check if guess is correct (you'll implement word checking logic)
                if (message.content.toLowerCase().trim() === this.secretWord.toLowerCase()) {
                    // Correct guess! Handle scoring and game state
                    console.log(`Correct guess from ${message.userId}!`);
                }
            } else {
                // Normal chat when not in guessing phase
                console.log(`Guessing game lobby ${this.id} chat from ${message.userId}: ${message.content}`);
            }
            
            this.broadcast(message, socket);
        }
        // Add guessing game logic here (word selection, scoring, etc.)
    }
}

export default GuessingGameLobby;
