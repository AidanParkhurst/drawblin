import Lobby from './Lobby.js';
import prompts from '../prompts.js';

class QuickDrawLobby extends Lobby {
    // Wait for players, then send the prompt to all artists
    // All artists draw on their own canvas
    // After drawing time, switch to voting phase
    // One at a time, each artist's drawing is displayed to all players
    // And players rank each one
    // After all drawings are displayed, show results and scores

    constructor(id) {
        super(id, 6); // Quick draw works well with 4-6 players for voting
        this.minPlayers = 2; // Minimum players to start the game
        this.gameState = "waiting"; // waiting, drawing, voting, finished
        this.currentArtist = null; // id of artist being voted on 
        this.waitingTime = 30; // seconds to wait for players
        this.drawingTime = 60; // seconds
        this.votingTime = 15;
        this.gameTimer = null;
        this.timer = 0.0;
        this.tickrate = 100;
        this.prompt = ""; // what to draw
        this.finishedDrawings = new Map(); // goblin id -> votes: [{ userId, vote }]
        
        // Start the game loop immediately
        this.startGameLoop();
    }

    startGameLoop() {
        this.gameTimer = setInterval(() => this.tick(), this.tickrate);
    }
    
    tick() {
        this.timer += this.tickrate / 1000; // Convert ms to seconds
        if (this.gameState === 'waiting') {
            // Start the game when we have enough players or after waiting time
            if (this.clients.size == this.maxPlayers || (this.clients.size >= this.minPlayers && this.timer >= this.waitingTime)) {
                this.prompt = prompts.difficulty.easy[Math.floor(Math.random() * prompts.difficulty.easy.length)];
                this.gameState = 'drawing';
                this.timer = 0; // Reset timer
                this.broadcast({ type: "game_start", prompt: this.prompt, time: this.drawingTime });
                console.log(`Quick draw lobby ${this.id} started with prompt: ${this.prompt}`);
            }
        } else if (this.gameState === 'drawing') {
            if (this.timer >= this.drawingTime * 1.05) { // Allow a bit of extra time for last updates
                for (const client of this.clients) {
                    const user = this.users.get(client);
                    if (user) {
                        this.finishedDrawings.set(user.id, { votes: [] });
                    }
                }
                this.gameState = 'voting';
                this.timer = 0; // Reset timer for voting phase
                this.broadcast({ type: "drawing_finished" });
                console.log(`Quick draw lobby ${this.id} finished drawing phase. Now voting.`);
            }
        } else if (this.gameState === 'voting') {
            if (this.currentArtist == null) {
                // Start voting phase
                this.currentArtist = this.finishedDrawings.keys().next().value;
                this.broadcast({ type: "voting_start", artistId: this.currentArtist });
                console.log(`Quick draw lobby ${this.id} started voting for artist: ${this.currentArtist}`);
            }
            if (this.timer >= this.votingTime) {
                // Next artist or end voting
                const artistKeys = Array.from(this.finishedDrawings.keys());
                const currentIndex = artistKeys.indexOf(this.currentArtist);
                if (currentIndex < artistKeys.length - 1) {
                    this.currentArtist = artistKeys[currentIndex + 1];
                    this.timer = 0; // Reset timer for next artist
                    this.broadcast({ type: "voting_start", artistId: this.currentArtist });
                    console.log(`Quick draw lobby ${this.id} voting for next artist: ${this.currentArtist}`);
                } else {
                    // End voting phase
                    this.gameState = 'finished';
                    this.broadcast({ type: "voting_finished", results: this.finishedDrawings });
                    clearInterval(this.gameTimer);
                    console.log(`Quick draw lobby ${this.id} finished voting phase. Results:`, this.finishedDrawings);
                }
                this.timer = 0;
            }
        }
    }

    handleMessage(socket, message) {
        if (message.type === "update") {
            this.users.set(socket, { id: message.goblin.id });
            this.broadcast(message, socket); // Broadcast updates to all clients

        } else if (message.type === "chat") {
            // Handle chat
            if (this.users.has(socket)) {
                const user = this.users.get(socket);
                message.userId = user.id;
            } else {
                message.userId = "unknown";
            }
            console.log(`Quick draw lobby ${this.id} chat from ${message.userId}: ${message.content}`);
            this.broadcast(message, socket);

        } else if (message.type === "vote") {
            // place this vote in the votes map for the current artist
            if (this.gameState !== 'voting' || !this.currentArtist) {
                console.warn("Vote received in non-voting state or no current artist");
                return;
            }

            var current_art = this.finishedDrawings.get(this.currentArtist);
            if (!current_art) {
                console.warn("Current artist not found in finished drawings");
                return;
            }
            if (!current_art.votes) {
                current_art.votes = []; // Initialize votes if not present
            }

            var existingVote = current_art.votes.find(v => v.userId === message.userId);
            if (existingVote) {
                // Update existing vote
                existingVote.vote = message.vote;
            } else {
                current_art.votes.push({ userId: message.userId, vote: message.vote });
            }
        }
    }
}

export default QuickDrawLobby;
