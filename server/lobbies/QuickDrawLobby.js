import Lobby from './Lobby.js';
import prompts from '../prompts.js';

class QuickDrawLobby extends Lobby {
    // Wait for players, then send the prompt to all artists
    // All artists draw on their own canvas
    // After drawing time, switch to voting phase
    // One at a time, each artist's drawing is displayed to all players
    // And players rank each one
    // Note: Chat is allowed in all phases. Only during 'voting' do numeric messages (1-5)
    // get interpreted as votes; otherwise they're broadcast as normal chat.
    // After all drawings are displayed, show results and scores

    constructor(id) {
        super(id, 6); // Quick draw works well with 4-6 players for voting
        this.minPlayers = 2; // Minimum players to start the game
        this.gameState = "waiting"; // waiting, drawing, pre-voting, voting, finished
        this.currentArtist = null; // id of artist being voted on 
        // TODO: Import a lot of these consts from a rules file, accessible by the frontend as well
        this.waitingTime = 20; // seconds to wait for players
        this.drawingTime = 70; // seconds (extended)
        this.preVotingTime = 5; // seconds before voting starts
        this.votingTime = 15;
        this.celebrationTime = 20; // seconds to show off the winner
        this.gameTimer = null;
        this.header = ""; // Header for the game state
        this.timer = this.waitingTime; // Start counting down from waiting time (will shrink as players join)
        this.tickrate = 100;
        this.prompt = ""; // what to draw
        this.finishedDrawings = new Map(); // goblin id -> votes: [{ userId, vote }]
        this.sortedResults = []; // Store results for the finished state 
        this.recentPrompts = []; // keep last few prompts to avoid repeats
        this.recentLimit = 10; // shortlist size

        // Handle disconnects
        this.onClientRemoved = (socket) => {
            const removedId = this.getUserId(socket);
            if (removedId) {
                // Remove from finished drawings if present
                this.finishedDrawings.delete(removedId);
                // If currently being voted on, advance as if timer ran out
                if (this.gameState === 'voting' && this.currentArtist === removedId) {
                    this.timer = 0;
                }
            }
            if (this.clients.size < this.minPlayers && this.gameState !== 'waiting') {
                // Not enough players; reset
                this.resetLobby();
            }
        };

        // Start the game loop immediately
        this.startGameLoop();
    }

    startGameLoop() {
        this.gameTimer = setInterval(() => this.tick(), this.tickrate);
    }

    addClient(socket) {
        super.addClient(socket);
    if (this.gameState === 'waiting') {
            const target = this.desiredWaitForPlayers();
            if (this.timer > target) this.timer = target; // shrink but never extend
        }
    }
    
    tick() {
    if (!this.clients || this.clients.size === 0) return;
        this.timer -= this.tickrate / 1000; // Convert ms to seconds and countdown
    if (this.gameState === 'waiting') {
            // Start the game when we have enough players or after waiting time
            if (this.clients.size == this.maxPlayers || (this.clients.size >= this.minPlayers && this.timer <= 0)) {
                this.prompt = this.pickNewPrompt();
                this.gameState = 'drawing';
                this.timer = this.drawingTime; // Set timer to drawing time
                this.broadcast({ type: "game_state", state: "drawing", prompt: this.prompt, time: this.drawingTime });
                console.log(`Quick draw lobby ${this.id} started with prompt: ${this.prompt}`);
            }
        } else if (this.gameState === 'drawing') {
            if (this.timer <= 0) { // Transition immediately when timer ends (no extra hidden delay)
                for (const client of this.clients) {
                    const uid = this.getUserId(client);
                    if (uid) this.finishedDrawings.set(uid, { votes: [] });
                }
                this.gameState = 'pre-voting';
                this.timer = this.preVotingTime; // Set timer to pre-voting time
                this.broadcast({ type: "game_state", state: "pre-voting", time: this.preVotingTime });
                console.log(`Quick draw lobby ${this.id} finished drawing phase. Now voting.`);
            }
        } else if (this.gameState === 'pre-voting') {
            if (this.timer <= 0) { // Wait 5 seconds before starting voting
                this.gameState = 'voting';
                // Pick the first available artist id
                this.currentArtist = Array.from(this.finishedDrawings.keys())[0] || null;
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
                // Immediately kick off the next round without a separate waiting period
                // Only require waiting when there was no prior round (fresh lobby)
                if (this.clients.size >= this.minPlayers) {
                    this.startNextRound();
                } else {
                    // Not enough players anymore; fall back to waiting
                    this.resetLobby();
                }
            }
        }
    }

    handleMessage(socket, message) {
        if (message.type === "update") {
            if (!this.users.has(socket)) {
                this.sendTo(socket, {type: "game_state", state: this.gameState, prompt: this.prompt, time: Math.max(0, this.timer), artistId: this.currentArtist, results: this.sortedResults });
            }
            this.users.set(socket, { id: message.goblin?.id });
            this.broadcast(message, socket); // still exclude sender for movement updates

        } else if (message.type === "chat") {
            // Handle chat
            // Always allow chat during drawing (and other non-voting phases).
            // Only interpret numeric messages as votes during the voting phase.
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
                    this.broadcast(message, null); // include sender for chat
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
                }
                this.broadcast({ type: "chat", userId: message.userId, content: "Voted!" });
            } else {
                // Not voting: treat all chat as normal chat and broadcast to everyone
                this.broadcast(message, null);
                console.log(`Quick draw lobby ${this.id} chat from ${message.userId}: ${message.content}`);
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
        // Dynamic wait based on current player count
        this.timer = this.desiredWaitForPlayers();
        this.prompt = "";
        this.finishedDrawings.clear();
        this.sortedResults = [];
        this.broadcast({ type: "game_state", state: "waiting", time: this.timer });
        console.log(`Quick draw lobby ${this.id} has been reset for a new game.`);
    }

    startNextRound() {
        // Prepare for next drawing phase directly
        this.currentArtist = null;
        this.prompt = "";
        this.finishedDrawings.clear();
        this.sortedResults = [];
    this.prompt = this.pickNewPrompt();
        this.gameState = 'drawing';
        this.timer = this.drawingTime;
        this.broadcast({ type: 'game_state', state: 'drawing', prompt: this.prompt, time: this.drawingTime });
        console.log(`Quick draw lobby ${this.id} starting next round with prompt: ${this.prompt}`);
    }

    pickNewPrompt() {
        const pool = prompts.quickdrawConcepts && prompts.quickdrawConcepts.length ? prompts.quickdrawConcepts : ['nature','adventure','storm'];
        if (!pool.length) return 'draw';
        // Try to pick a prompt not in recentPrompts; if pool too small, allow repeats
        const recentSet = new Set(this.recentPrompts);
        let candidates = pool.filter(p => !recentSet.has(p));
        if (candidates.length === 0) candidates = pool.slice();
        const choice = candidates[Math.floor(Math.random() * candidates.length)];
        // update recent queue
        this.recentPrompts.push(choice);
        if (this.recentPrompts.length > this.recentLimit) this.recentPrompts.shift();
        return choice;
    }

    stopGameLoop() {
        if (this.gameTimer) {
            clearInterval(this.gameTimer);
            this.gameTimer = null;
        }
    }

    desiredWaitForPlayers() {
        // Scale from waitingTime (e.g., 20s) at minPlayers down to 10s at maxPlayers
        const high = this.waitingTime;
        const low = 10;
        const p = this.clients.size;
        if (p >= this.maxPlayers) return low;
        if (p <= this.minPlayers) return high;
        const span = this.maxPlayers - this.minPlayers;
        const t = (p - this.minPlayers) / span; // 0..1
        return high - (high - low) * t;
    }
}

export default QuickDrawLobby;
