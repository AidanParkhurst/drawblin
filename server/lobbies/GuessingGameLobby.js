import Lobby from './Lobby.js';
import prompts from '../prompts.js';

class GuessingGameLobby extends Lobby {
    constructor(id) {
        super(id, 4); // Guessing game optimal with 3-4 players (1 artist, 2-3 guessers)
        this.minPlayers = 2; // Minimum players to start the game
        this.gameState = "waiting"; // waiting, drawing, reveal, scoreboard
        this.currentArtist = null; // socket of the current artist
        this.pastArtists = []; // sockets of past artists
        this.prompt = ""; // word being drawn
        this.scores = new Map(); // socket -> score: int
        this.correct_guessers = [] // sockets of players who guessed this curernt prompt correctly
        this.drawingTime = 60; // seconds
        this.waitTime = 20; // seconds to wait for players
        this.revealTime = 5; // how long prompt is shown
        this.scoreTimer = 10; // seconds to show scores
        this.timer = this.waitTime; // Start counting down from waiting time
        this.points_for_guess = 0;

        this.tickrate = 100; // ms
        this.gameTimer = null;

        this.startGameLoop();
    }

    startGameLoop() {
        this.gameTimer = setInterval(() => this.tick(), this.tickrate);
    }
    
    tick() {
        this.timer -= this.tickrate / 1000; // Convert ms to seconds and countdown
        if (this.gameState === 'waiting') {
            // Start the game when we have enough players or after waiting time
            if (this.clients.size >= this.minPlayers && this.timer <= 0) {
                var first_artist = Array.from(this.clients)[Math.floor(Math.random() * this.clients.size)];
                this.startDrawingPhase(first_artist);
                this.pastArtists.push(first_artist);
            }
        }
        else if (this.gameState === 'drawing') {
            if (this.timer <= 0) {
                this.gameState = 'reveal';
                this.timer = this.revealTime; // Set timer for reveal phase
                this.broadcast({ type: "game_state", state: "reveal", prompt: this.prompt, artistId: this.users.get(this.currentArtist).id, time: this.revealTime });
                console.log(`Guessing game lobby ${this.id} prompt revealed: ${this.prompt}`);
            }
        } else if (this.gameState === 'reveal') {
            if (this.timer <= 0) {
                var nextArtist = null;
                var availableArtists = Array.from(this.clients).filter(socket => !this.pastArtists.includes(socket));
                nextArtist = availableArtists[Math.floor(Math.random() * availableArtists.length)];

                if (nextArtist) {
                    this.startDrawingPhase(nextArtist);
                    this.pastArtists.push(nextArtist);
                } else {
                    this.gameState = 'scoreboard';
                    this.timer = this.scoreTimer; // Set timer for scoreboard display
                    this.broadcast({ type: "game_state", state: "scoreboard", time: this.scoreTimer, scores: Array.from(this.scores.entries()).map(([socket, score]) => ({ userId: this.users.get(socket).id, score })) });
                    console.log(`Guessing game lobby ${this.id} game ended.`);
                }
            }
        } else if (this.gameState === 'scoreboard') {
            if (this.timer <= 0) {
                this.gameState = 'waiting'; // Reset to waiting state for the next round
                this.timer = this.waitTime; // Reset timer for the next waiting period
                this.scores.clear(); // Clear scores for the next game
                this.correct_guessers = []; // Reset correct guessers
                this.currentArtist = null; // Reset current artist
                this.pastArtists = []; // Clear past artists
                this.broadcast({ type: "game_state", state: "waiting", time: this.timer });
                console.log(`Guessing game lobby ${this.id} reset to waiting state.`);
            }
        }
    }
    
    startDrawingPhase(artistSocket) {
        this.gameState = 'drawing';
        this.timer = this.drawingTime; // Set timer to drawing time
        this.prompt = prompts.difficulty.easy[Math.floor(Math.random() * prompts.difficulty.easy.length)];
        
        var artistId = this.users.get(artistSocket).id;
        this.currentArtist = artistSocket;

        this.points_for_guess = this.clients.size; // Points for guessing is number of guessers + 1
        this.correct_guessers = []; // Reset correct guessers for the new round

        this.sendTo(artistSocket, { type: "game_state", state: "drawing", prompt: this.prompt, time: this.drawingTime , artistId: artistId });
        this.broadcast({ type: "game_state", state: "drawing", prompt_length: this.prompt.length, time: this.drawingTime, artistId: artistId }, this.currentArtist);
        console.log(`Guessing game lobby ${this.id} started with artist: ${artistId} and prompt: ${this.prompt}`);
    }

    handleMessage(socket, message) {
        if (message.type === "update") {
            if (!this.users.has(socket)) {
                this.sendTo(socket, { type: "game_state", state: this.gameState, prompt_length: this.prompt.length, time: Math.max(0, this.timer), artistId: this.currentArtist ? this.users.get(this.currentArtist).id : null });
            }
            this.users.set(socket, { id: message.goblin.id });
            this.broadcast(message, socket);

        } else if (message.type === "chat") {
            if (this.users.has(socket)) {
                const user = this.users.get(socket);
                message.userId = user.id;
            } else {
                message.userId = "unknown";
            }
            
            // In guessing game, check if chat message is a guess
            if (this.gameState === "drawing" && socket !== this.currentArtist) {
                console.log(`Guessing game lobby ${this.id} guess from ${message.userId}: ${message.content}`); 
                if (message.content.toLowerCase().trim() === this.prompt.toLowerCase()) {
                    if (!this.correct_guessers.includes(socket)) {
                        this.correct_guessers.push(socket); // Add to correct guessers
                    } else {
                        return; // Ignore duplicate guesses
                    }
                    // Correct guess! Handle scoring and game state
                    if (!this.scores.has(socket)) {
                        this.scores.set(socket, 0); // Initialize score if not present
                    }
                    this.broadcast({ type: "chat", userId: message.userId, content: `Guessed Correctly! +${this.points_for_guess} points`});
                    this.scores.set(socket, this.scores.get(socket) + this.points_for_guess--); // Add points for correct guess

                    if (this.correct_guessers.length === this.clients.size - 1) { // All guessers guessed correctly
                        this.gameState = 'reveal';
                        this.timer = this.revealTime; // Set timer for reveal phase
                        this.broadcast({ type: "game_state", state: "reveal", prompt: this.prompt, artistId: this.users.get(this.currentArtist).id, time: this.revealTime });
                        console.log(`Guessing game lobby ${this.id} all guesses correct, revealing prompt: ${this.prompt}`);
                    }
                }
            } else {
                // Normal chat when not in guessing phase
                console.log(`Guessing game lobby ${this.id} chat from ${message.userId}: ${message.content}`);
                this.broadcast(message, socket);
            }
        }
    }

    stopGameLoop() {
        if (this.gameTimer) {
            clearInterval(this.gameTimer);
            this.gameTimer = null;
        }
    }
}

export default GuessingGameLobby;
