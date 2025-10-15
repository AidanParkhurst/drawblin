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
        super(id, 8); // Quick draw works well with 4-6 players for voting
        this.minPlayers = 2; // Minimum players to start the game
        this.gameState = "waiting"; // waiting, drawing, pre-voting, voting, finished
    this.currentArtist = null; // legacy: id of artist being voted on (unused in team mode)
    this.currentTeam = []; // array of artist ids for the team currently being voted on
    this.teams = []; // array of arrays of userIds
    this.teamByUser = new Map(); // userId -> team array (including user)
    this.currentTeamIndex = 0;
        // TODO: Import a lot of these consts from a rules file, accessible by the frontend as well
        this.waitingTime = 20; // seconds to wait for players
        this.drawingTime = 180; // seconds (extended)
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
    this.firstPlaceTeamSize = 0; // number of players in the top team for finished payload

        // Handle disconnects
        this.onClientRemoved = (socket) => {
            const removedId = this.getUserId(socket);
            if (removedId) {
                // Remove from finished drawings if present
                this.finishedDrawings.delete(removedId);
                // If currently being voted on, advance as if timer ran out
                if (this.gameState === 'voting') {
                    // If the removed player is in the current team, skip ahead
                    if (Array.isArray(this.currentTeam) && this.currentTeam.includes(removedId)) {
                        this.timer = 0;
                    }
                    // Also clean team structures
                    this.teams = this.teams.map(t => t.filter(id => id !== removedId)).filter(t => t.length > 0);
                    if (this.teamByUser.has(removedId)) this.teamByUser.delete(removedId);
                    if (Array.isArray(this.currentTeam)) this.currentTeam = this.currentTeam.filter(id => id !== removedId);
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
                // Build teams for this round
                this.buildTeamsForRound();
                // Send per-player drawing state including teammates
                for (const client of this.clients) {
                    const uid = this.getUserId(client);
                    const team = (uid != null && this.teamByUser.has(uid)) ? this.teamByUser.get(uid) : [];
                    // teammates are team minus self
                    const teammates = Array.isArray(team) ? team.filter(id => id !== uid) : [];
                    this.sendTo(client, { type: "game_state", state: "drawing", prompt: this.prompt, time: this.drawingTime, teammates });
                }
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
            }
        } else if (this.gameState === 'pre-voting') {
            if (this.timer <= 0) { // Wait 5 seconds before starting voting
                this.gameState = 'voting';
                // Prepare the first team to be voted on
                const roundTeams = this.teams.length ? this.teams : [Array.from(this.finishedDrawings.keys())];
                // Filter teams to only include members that actually finished (present in finishedDrawings)
                const filtered = roundTeams.map(t => t.filter(id => this.finishedDrawings.has(id))).filter(t => t.length > 0);
                this.teams = filtered.length ? filtered : [Array.from(this.finishedDrawings.keys())];
                this.currentTeamIndex = 0;
                this.currentTeam = this.teams[0] || [];
                this.currentArtist = null; // deprecated in team mode
                this.timer = this.votingTime; // Set timer to voting time
                this.broadcast({ type: "game_state", state: "voting", artistIds: this.currentTeam.slice(), time: this.votingTime });
            }
        } else if (this.gameState === 'voting') {
            if (this.timer <= 0) {
                // Next team or end voting
                if (this.currentTeamIndex < this.teams.length - 1) {
                    this.currentTeamIndex += 1;
                    this.currentTeam = this.teams[this.currentTeamIndex] || [];
                    this.timer = this.votingTime; // Reset timer for next team
                    this.broadcast({ type: "game_state", state: "voting", artistIds: this.currentTeam.slice(), time: this.votingTime });
                } else {
                    // End voting phase
                    this.gameState = 'finished';
                    // Build per-artist stats
                    const perArtist = Array.from(this.finishedDrawings.entries()).map(([artistId, data]) => {
                        const totalVotes = (Array.isArray(data.votes) ? data.votes : []).reduce((sum, v) => sum + (v?.vote || 0), 0);
                        const count = (Array.isArray(data.votes) ? data.votes.length : 0);
                        const averageVote = count > 0 ? (totalVotes / count) : 0;
                        return { artistId, votes: count, averageVote };
                    });
                    // Compute team average for sorting and first-place size
                    const teamAvgByMember = new Map();
                    for (const t of this.teams) {
                        if (!t || t.length === 0) continue;
                        const members = t.filter(id => perArtist.find(p => p.artistId === id));
                        if (!members.length) continue;
                        let sum = 0; let n = 0;
                        for (const id of members) {
                            const p = perArtist.find(x => x.artistId === id);
                            if (p) { sum += p.averageVote; n += 1; }
                        }
                        const teamAvg = n > 0 ? (sum / n) : 0;
                        for (const id of members) teamAvgByMember.set(id, teamAvg);
                    }
                    // Sort by team average (desc), then by individual average (desc) as a stable tiebreaker
                    this.sortedResults = perArtist.sort((a, b) => {
                        const ta = teamAvgByMember.get(a.artistId) ?? a.averageVote;
                        const tb = teamAvgByMember.get(b.artistId) ?? b.averageVote;
                        if (tb !== ta) return tb - ta;
                        return b.averageVote - a.averageVote;
                    });
                    // Determine first place team size
                    this.firstPlaceTeamSize = 0;
                    if (this.sortedResults.length > 0) {
                        const topId = this.sortedResults[0].artistId;
                        // Find the team that contains topId
                        const topTeam = this.teams.find(t => Array.isArray(t) && t.includes(topId));
                        this.firstPlaceTeamSize = Array.isArray(topTeam) ? topTeam.length : 1;
                    }
                    this.broadcast({ type: "game_state", state: "finished", results: this.sortedResults, firstPlaceTeamSize: this.firstPlaceTeamSize, time: this.waitingTime });
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
                // Prefill state for newcomers
                const gid = (message.goblin && message.goblin.id != null)
                    ? message.goblin.id
                    : (message.g && message.g.i != null ? message.g.i : null);
                // Build state payload with team-friendly fields
                const base = { type: "game_state", state: this.gameState, prompt: this.prompt, time: Math.max(0, this.timer), results: this.sortedResults };
                if (this.gameState === 'voting') {
                    base.artistIds = Array.isArray(this.currentTeam) ? this.currentTeam.slice() : [];
                } else if (this.gameState === 'drawing') {
                    if (gid != null && this.teamByUser.has(gid)) {
                        const team = this.teamByUser.get(gid) || [];
                        base.teammates = team.filter(id => id !== gid);
                    }
                } else if (this.gameState === 'finished') {
                    base.firstPlaceTeamSize = this.firstPlaceTeamSize|0;
                }
                this.sendTo(socket, base);
            }
            // Accept both legacy and compact goblin update shapes
            const gid = (message.goblin && message.goblin.id != null)
                ? message.goblin.id
                : (message.g && message.g.i != null ? message.g.i : null);
            if (gid != null) {
                this.users.set(socket, { id: gid });
            }
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
                // Basic cap/clean; HTML escaping handled centrally in server.js
                if (typeof message.content === 'string') {
                    message.content = message.content.replace(/[\u0000-\u001F\u007F]/g, '').slice(0, 240);
                } else { message.content = ''; }
                var vote = this.getVoteFromMessage(message.content);

                // In team mode, don't allow members of the current team to vote on their own team
                const isOnCurrentTeam = Array.isArray(this.currentTeam) && this.currentTeam.includes(message.userId);
                if (!vote || isOnCurrentTeam) { // Normal chat message
                    this.broadcast(message, null); // include sender for chat
                    return;
                }

                // Apply vote to all members of the current team so they share identical scores
                const team = Array.isArray(this.currentTeam) ? this.currentTeam : [];
                for (const memberId of team) {
                    const bucket = this.finishedDrawings.get(memberId);
                    if (!bucket) continue;
                    if (!bucket.votes) bucket.votes = [];
                    const existingVote = bucket.votes.find(v => v.userId === message.userId);
                    if (existingVote) {
                        existingVote.vote = vote;
                    } else {
                        bucket.votes.push({ userId: message.userId, vote: vote });
                    }
                }
                this.broadcast({ type: "chat", userId: message.userId, content: "Voted!" });
            } else {
                // Not voting: drawing-phase chat is team-only; other phases are global
                if (typeof message.content === 'string') {
                    message.content = message.content.replace(/[\u0000-\u001F\u007F]/g, '').slice(0, 240);
                } else { message.content = ''; }
                if (this.gameState === 'drawing') {
                    const uid = message.userId;
                    const team = uid != null ? this.teamByUser.get(uid) : null;
                    if (Array.isArray(team) && team.length > 0) {
                        for (const client of this.clients) {
                            const cid = this.getUserId(client);
                            if (cid != null && team.includes(cid)) {
                                this.sendTo(client, message);
                            }
                        }
                    } else {
                        // Fallback: if no team found (e.g., late join), echo to sender only
                        this.sendTo(socket, message);
                    }
                } else {
                    this.broadcast(message, null);
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
        this.currentTeam = [];
        this.teams = [];
        this.teamByUser.clear();
        this.currentTeamIndex = 0;
        this.firstPlaceTeamSize = 0;
        // Dynamic wait based on current player count
        this.timer = this.desiredWaitForPlayers();
        this.prompt = "";
        this.finishedDrawings.clear();
        this.sortedResults = [];
        this.broadcast({ type: "game_state", state: "waiting", time: this.timer });
    }

    startNextRound() {
        // Prepare for next drawing phase directly
        this.currentArtist = null;
        this.currentTeam = [];
        this.teams = [];
        this.teamByUser.clear();
        this.currentTeamIndex = 0;
    this.firstPlaceTeamSize = 0;
        this.prompt = "";
        this.finishedDrawings.clear();
        this.sortedResults = [];
    this.prompt = this.pickNewPrompt();
        this.gameState = 'drawing';
        this.timer = this.drawingTime;
        // Rebuild teams and send per-player teammates
        this.buildTeamsForRound();
        for (const client of this.clients) {
            const uid = this.getUserId(client);
            const team = (uid != null && this.teamByUser.has(uid)) ? this.teamByUser.get(uid) : [];
            const teammates = Array.isArray(team) ? team.filter(id => id !== uid) : [];
            this.sendTo(client, { type: 'game_state', state: 'drawing', prompt: this.prompt, time: this.drawingTime, teammates });
        }
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

    // Team-building: random pairs, with a single team of 3 if odd
    buildTeamsForRound() {
        const ids = Array.from(this.users.values()).map(u => u.id).filter(id => id != null);
        // Shuffle ids
        for (let i = ids.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [ids[i], ids[j]] = [ids[j], ids[i]];
        }
        const teams = [];
        if (ids.length % 2 === 1 && ids.length >= 3) {
            // Make pairs until 3 remain; last team of 3
            let i = 0;
            while (i + 3 < ids.length) { teams.push([ids[i], ids[i+1]]); i += 2; }
            teams.push([ids[ids.length-3], ids[ids.length-2], ids[ids.length-1]]);
        } else {
            for (let i = 0; i < ids.length; i += 2) {
                const chunk = ids.slice(i, i + 2);
                if (chunk.length) teams.push(chunk);
            }
        }
        this.teams = teams;
        this.teamByUser.clear();
        for (const team of teams) {
            for (const uid of team) this.teamByUser.set(uid, team.slice());
        }
    }
}

export default QuickDrawLobby;
