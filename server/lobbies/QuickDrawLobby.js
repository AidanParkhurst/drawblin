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
        this.gameState = "waiting"; // waiting, drawing, pre-voting, voting, finished
        this.currentArtist = null; // id of artist being voted on 
        // TODO: Import a lot of these consts from a rules file, accessible by the frontend as well
        this.waitingTime = 20; // seconds to wait for players
        this.drawingTime = 60; // seconds
        this.preVotingTime = 5; // seconds before voting starts
        this.votingTime = 15;
        this.celebrationTime = 10; // seconds to show off the winner
        this.gameTimer = null;
        this.header = ""; // Header for the game state
        this.timer = this.waitingTime; // Start counting down from waiting time
        this.tickrate = 100;
        this.prompt = ""; // what to draw
        this.finishedDrawings = new Map(); // goblin id -> votes: [{ userId, vote }]
        this.sortedResults = []; // Store results for the finished state 

        // Start the game loop immediately
        this.startGameLoop();
    }

    startGameLoop() {
        this.gameTimer = setInterval(() => this.tick(), this.tickrate);
    }
    
    tick() {
        if (!this.clients || this.clients.size === 0) return;
        this.timer -= this.tickrate / 1000; // Convert ms to seconds and countdown
        if (this.gameState === 'waiting') {
            // Start the game when we have enough players or after waiting time
            if (this.clients.size == this.maxPlayers || (this.clients.size >= this.minPlayers && this.timer <= 0)) {
                this.prompt = prompts.difficulty.easy[Math.floor(Math.random() * prompts.difficulty.easy.length)];
                this.gameState = 'drawing';
                this.timer = this.drawingTime; // Set timer to drawing time
                this.broadcast({ type: "game_state", state: "drawing", prompt: this.prompt, time: this.drawingTime });
                console.log(`Quick draw lobby ${this.id} started with prompt: ${this.prompt}`);
            }
        } else if (this.gameState === 'drawing') {
            if (this.timer <= -this.drawingTime * 0.05) { // Allow a bit of extra time for last updates
                for (const client of this.clients) {
                    const user = this.users.get(client);
                    if (user) {
                        this.finishedDrawings.set(user.id, { votes: [] });
                    }
                }
                this.gameState = 'pre-voting';
                this.timer = this.preVotingTime; // Set timer to pre-voting time
                this.broadcast({ type: "game_state", state: "pre-voting", time: this.preVotingTime });
                console.log(`Quick draw lobby ${this.id} finished drawing phase. Now voting.`);
            }
        } else if (this.gameState === 'pre-voting') {
            if (this.timer <= 0) { // Wait 5 seconds before starting voting
                this.gameState = 'voting';
                this.currentArtist = this.finishedDrawings.keys().next().value; // Get the first artist
                this.timer = this.votingTime; // Set timer to voting time
                this.broadcast({ type: "game_state", state: "voting", artistId: this.currentArtist, time: this.votingTime });
                console.log(`Quick draw lobby ${this.id} started voting phase for artist: ${this.currentArtist}`);
            }
        } else if (this.gameState === 'voting') {
            if (this.timer <= 0) {
                // Next artist or end voting
                const artistKeys = Array.from(this.finishedDrawings.keys());
                const currentIndex = artistKeys.indexOf(this.currentArtist);
                if (currentIndex < artistKeys.length - 1) {
                    this.currentArtist = artistKeys[currentIndex + 1];
                    this.timer = this.votingTime; // Reset timer for next artist
                    this.broadcast({ type: "game_state", state: "voting", artistId: this.currentArtist, time: this.votingTime });
                    console.log(`Quick draw lobby ${this.id} voting for next artist: ${this.currentArtist}`);
                } else {
                    // End voting phase
                    this.gameState = 'finished';
                    // TODO: This is ai generated lol, check if its correct
                    this.sortedResults = Array.from(this.finishedDrawings.entries()).map(([artistId, data]) => {
                        const totalVotes = data.votes.reduce((sum, vote) => sum + vote.vote, 0);
                        const averageVote = totalVotes / data.votes.length || 0; // Avoid division
                        return { artistId, votes: data.votes.length, averageVote };
                    }).sort((a, b) => b.averageVote - a.averageVote); // Sort by average vote descending
                    this.broadcast({ type: "game_state", state: "finished", results: this.sortedResults, time: this.waitingTime });
                    console.log(`Quick draw lobby ${this.id} finished. Results:`, this.sortedResults);
                    this.timer = this.celebrationTime; // Set timer for celebration
                }
            }
        } else if (this.gameState === 'finished') {
            if (this.timer <= 0) {
                // Reset lobby for next game
                this.resetLobby();

            }
        }
    }

    handleMessage(socket, message) {
        if (message.type === "update") {
            if (!this.users.has(socket)) {
                this.sendTo(socket, {type: "game_state", state: this.gameState, prompt: this.prompt, time: Math.max(0, this.timer), artistId: this.currentArtist, results: this.sortedResults });
            }
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

            if (this.gameState === "voting") {
                // In voting phase, check if the message is a vote
                var vote = this.getVoteFromMessage(message.content);
                
                if (!vote || message.userId === this.currentArtist) { // Normal chat message
                    this.broadcast(message, socket); // Broadcast chat message to all clients
                    console.log(`Quick draw lobby ${this.id} chat from ${message.userId}: ${message.content}`);
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
                    existingVote.vote = vote;
                } else {
                    current_art.votes.push({ userId: message.userId, vote: vote });
                    this.broadcast({ type: "chat", userId: message.userId, content: "Voted!" }); // Broadcast chat message to all clients
                }
            }
        }
    }

    getVoteFromMessage(content) {
        // Check if message is a single number, between 1 and 5
        const vote = parseInt(content.trim());
        if (!isNaN(vote) && vote >= 1 && vote <= 5) {
            return vote;
        } else {
            return null; // Invalid vote
        }
    }

    resetLobby() {
        this.gameState = 'waiting';
        this.currentArtist = null;
        this.timer = this.waitingTime; // Reset to waiting time for countdown
        this.prompt = "";
        this.finishedDrawings.clear();
        this.sortedResults = [];
        this.broadcast({ type: "game_state", state: "waiting", time: this.waitingTime });
        console.log(`Quick draw lobby ${this.id} has been reset for a new game.`);
    }

    stopGameLoop() {
        if (this.gameTimer) {
            clearInterval(this.gameTimer);
            this.gameTimer = null;
        }
    }
}

export default QuickDrawLobby;
