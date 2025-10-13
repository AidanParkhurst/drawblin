import Lobby from './Lobby.js';
import prompts from '../prompts.js';

class GuessingGameLobby extends Lobby {
    constructor(id) {
        super(id, 4); // Guessing game optimal with 3-4 players (1 artist, 2-3 guessers)
        this.minPlayers = 2; // Minimum players to start the game
    this.gameState = "waiting"; // waiting, drawing, reveal
        this.currentArtist = null; // socket of the current artist
        this.pastArtists = []; // sockets of past artists
    this.prompt = ""; // phrase being drawn (full phrase revealed to artist only until reveal)
    this.prompt_tokens = []; // array of token objects { type: 'noun'|'adj'|'literal', value }
    this.scorable_words = new Set(); // set of words (lowercase) that can earn points
    this.wordGuessers = new Map(); // word -> Set(sockets) that have already earned it
        this.scores = new Map(); // socket -> score: int
    this.correct_guessers = [] // sockets of players who guessed this curernt prompt correctly
    this.persistentScores = new Map(); // keep scores across rounds until reset (for lobby scoreboard in waiting)
    this.drawingTime = 90; // seconds (extended for phrase prompts)
        this.waitTime = 20; // seconds to wait for players
    this.revealTime = 5; // how long prompt is shown
    // Removed scoreboard phase; scores shown during waiting
        this.timer = this.waitTime; // Start counting down from waiting time
        this.points_for_guess = 0;

        this.tickrate = 100; // ms
        this.gameTimer = null;

        this.startGameLoop();

        // Hook join/leave events to refresh waiting scoreboard and handle artist drop
        this.onClientRemoved = (socket) => {
            // Clean per-round and persistent state tied to this socket
            this.scores.delete(socket);
            this.persistentScores.delete(socket);
            for (const set of this.wordGuessers.values()) set.delete(socket);

            if (this.currentArtist === socket) {
                // Treat as if timer ran out on the round
                if (this.gameState === 'drawing') {
                    this.forceReveal('artist_disconnected');
                } else if (this.gameState === 'reveal') {
                    // Fast-forward to next artist
                    this.timer = 0;
                }
                this.currentArtist = null;
            } else {
                // If player count drops below minimum mid-round, return to waiting
                if (this.clients.size < this.minPlayers && this.gameState !== 'waiting') {
                    this.backToWaiting('not_enough_players');
                }
            }

            if (this.gameState === 'waiting') this.broadcastWaitingWithScores();
        };
    }

    startGameLoop() {
        this.gameTimer = setInterval(() => this.tick(), this.tickrate);
    }

    addClient(socket) {
        super.addClient(socket);
        // If we're in waiting, shrink remaining timer according to player count (can't extend)
        if (this.gameState === 'waiting') {
            const target = this.desiredWaitForPlayers();
            if (this.timer > target) this.timer = target;
        }
    }
    
    tick() {
        if (!this.clients || this.clients.size === 0) return;
        
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
            // Broadcast full prompt (bracket everything to indicate reveal so client colors full phrase)
            const fullyBracketed = this.prompt_tokens.map(t => t.type === 'literal' ? t.value : `[${t.value}]`).join(' ');
            this.broadcast({ type: "game_state", state: "reveal", prompt: fullyBracketed, artistId: this.getUserId(this.currentArtist), time: this.revealTime });
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
                    // End of rotation; merge scores and return to waiting
                    for (const [sock, val] of this.scores.entries()) {
                        const prev = this.persistentScores.get(sock) || 0;
                        this.persistentScores.set(sock, prev + val);
                    }
                    this.scores.clear();
                    this.correct_guessers = [];
                    this.currentArtist = null;
                    this.pastArtists = [];
                    this.gameState = 'waiting';
                    // Reset waiting timer based on current player count (scaled)
                    this.timer = this.desiredWaitForPlayers();
                    this.broadcastWaitingWithScores();
                }
            }
        }
    }
    
    startDrawingPhase(artistSocket) {
        this.gameState = 'drawing';
        this.timer = this.drawingTime; // Set timer to drawing time
    // Generate a phrase prompt instead of a single word
    this.generatePhrasePrompt();
        
        const artistId = this.getUserId(artistSocket);
        if (!artistId) {
            // Pick another eligible artist that has an id
            const candidates = Array.from(this.clients).filter(s => s !== artistSocket);
            const fallback = candidates.find(s => this.getUserId(s));
            if (fallback) {
                return this.startDrawingPhase(fallback);
            }
            // No valid artist; go back to waiting
            return this.backToWaiting('no_valid_artist');
        }
        this.currentArtist = artistSocket;

        this.points_for_guess = this.clients.size; // Points for guessing is number of guessers + 1
        this.correct_guessers = []; // Reset correct guessers for the new round
    // Reset per-word guess tracking
    this.wordGuessers = new Map();
    for (const s of this.clients) { delete s.guessedWords; }

    // Send phrase to artist with placeholder words bracketed for client-side coloring
    const artistView = this.prompt_tokens.map(t => t.type === 'literal' ? t.value : `[${t.value}]`).join(' ');
    this.sendTo(artistSocket, { type: "game_state", state: "drawing", prompt: artistView, time: this.drawingTime , artistId: artistId });
        // Build masked prompt for others (literals visible, scorable words masked with underscores of equal length)
        const masked = this.prompt_tokens.map(t => {
            if (t.type === 'literal') return t.value;
            return '_'.repeat(t.value.length);
        }).join(' ');
    for (const client of this.clients) {
            if (client === artistSocket) continue;
            this.sendTo(client, { type: "game_state", state: "drawing", prompt: masked, time: this.drawingTime, artistId: artistId });
        }
    // Artist and prompt set; omit verbose start log in production
    }

    generatePhrasePrompt() {
        const templates = prompts?.phraseTemplates && prompts.phraseTemplates.length ? prompts.phraseTemplates : ['(character) riding a (ridable)'];
        const template = templates[Math.floor(Math.random() * templates.length)];
        const adjectives = prompts?.adjectives && prompts.adjectives.length ? prompts.adjectives : ['big','small','old','new'];
        const lexicon = Array.isArray(prompts?.lexicon) ? prompts.lexicon : [];

        // Helper: pick random from array
        const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

        // Helper: choose lexicon word by tag expression
        // Supports: 'tag', 'tag1|tag2' (OR), 'tag1+tag2' (AND). Combined ORs of AND-clauses are allowed.
        const chooseByTags = (expr) => {
            if (!lexicon.length) return null;
            const orClauses = expr.split('|').map(s => s.trim()).filter(Boolean);
            let candidates = [];
            for (const clause of orClauses) {
                const andTags = clause.split('+').map(s => s.trim()).filter(Boolean);
                const matched = lexicon.filter(entry => andTags.every(t => entry.tags?.includes(t)));
                candidates = candidates.concat(matched);
            }
            if (candidates.length === 0) {
                // Fallback: exact word match in lexicon
                const exact = lexicon.find(e => e.word.toLowerCase() === expr.toLowerCase());
                if (exact) return exact.word;
            }
            // Prefer single-word entries for better scoring/masking
            const singles = candidates.filter(e => !e.word.includes(' '));
            const pool = singles.length ? singles : candidates;
            return pool.length ? pick(pool).word : null;
        };

        // Tokenize and fill placeholders (support suffix like (object)s and punctuation)
        const rawParts = template.split(/\s+/);
        const tokens = [];
        const pluralize = (w) => {
            if (!w) return w;
            const lower = w.toLowerCase();
            // basic pluralization rules
            if (/([sxz]|(sh)|(ch))$/i.test(lower)) return w + 'es';
            if (/[^aeiou]y$/i.test(lower)) return w.slice(0, -1) + 'ies';
            return w + 's';
        };
        for (const part of rawParts) {
            // groups: 1=inner, 2=alpha suffix (e.g., 's'), 3=punctuation suffix
            const m = part.match(/^\(([^)]+)\)([a-zA-Z]*)([^a-zA-Z]*)?$/);
            if (m) {
                const inner = (m[1] || '').trim();
                const alphaSuffix = (m[2] || '').trim();
                const punct = m[3] || '';
                let base = '';
                let type = 'noun';
                if (inner === 'adj') {
                    type = 'adj';
                    base = pick(adjectives);
                } else if (inner === 'noun') {
                    // Any lexicon entry
                    const singles = lexicon.filter(e => !e.word.includes(' '));
                    const entry = (singles.length ? pick(singles) : pick(lexicon));
                    base = entry ? entry.word : 'thing';
                } else {
                    // Treat as tag expression
                    base = chooseByTags(inner) || 'thing';
                }
                let value = base;
                if (alphaSuffix) {
                    // only attempt plural rules for a simple 's' suffix; otherwise append as-is
                    if (alphaSuffix.toLowerCase() === 's') value = pluralize(base);
                    else value = base + alphaSuffix;
                }
                tokens.push({ type, value });
                if (punct) tokens.push({ type: 'literal', value: punct });
            } else {
                tokens.push({ type: 'literal', value: part });
            }
        }
        this.prompt_tokens = tokens;
        this.prompt = tokens.map(t => t.value).join(' ');
        this.scorable_words = new Set(tokens.filter(t => t.type !== 'literal').map(t => t.value.toLowerCase()));
    }

    handleMessage(socket, message) {
        if (message.type === "update") {
            if (!this.users.has(socket)) {
                // Track user id from either legacy or compact update shape
                const gid = (message.goblin && message.goblin.id != null)
                    ? message.goblin.id
                    : (message.g && message.g.i != null ? message.g.i : null);
                if (gid != null) this.users.set(socket, { id: gid });
                // On first update from a new client, send current state and scoreboard if waiting
                if (this.gameState === 'waiting') {
                    // Adjust timer now that a new player is present
                    const target = this.desiredWaitForPlayers();
                    if (this.timer > target) this.timer = target;
                    this.sendTo(socket, { type: "game_state", state: 'waiting', time: Math.max(0, this.timer) });
                    this.sendScoreboardTo(socket);
                    // After adding user ensure everyone sees updated list (now that ID is known)
                    this.broadcastWaitingWithScores();
                } else if (this.gameState === 'drawing') {
                    this.sendTo(socket, { type: "game_state", state: 'drawing', prompt: this.maskedPromptForNewJoiner(), time: Math.max(0, this.timer), artistId: this.getUserId(this.currentArtist) });
                } else if (this.gameState === 'reveal') {
                    this.sendTo(socket, { type: "game_state", state: 'reveal', prompt: this.prompt, artistId: this.getUserId(this.currentArtist), time: Math.max(0, this.timer) });
                }
            } else {
                const gid = (message.goblin && message.goblin.id != null)
                    ? message.goblin.id
                    : (message.g && message.g.i != null ? message.g.i : null);
                if (gid != null) this.users.set(socket, { id: gid });
            }
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
                // Cap/clean before processing. HTML escaping is centrally handled in server.js
                const safe = typeof message.content === 'string' ? message.content.replace(/[\u0000-\u001F\u007F]/g, '').slice(0, 240) : '';
                message.content = safe;
                // Omit per-guess logging for performance
                // Phrase scoring: split guess into words from the unescaped safe version
                const cleaned = safe.toLowerCase();
                const words = cleaned.match(/[a-zA-Z]+/g) || [];
                let totalPointsEarned = 0;
                if (!this.scores.has(socket)) this.scores.set(socket, 0);
                if (!socket.guessedWords) socket.guessedWords = new Set();
                const newlyGuessed = [];
                let artistBonusPerWord = 0; // count how many placeholder words this player newly matched in this message

                const totalGuessers = Math.max(1, this.clients.size - 1); // exclude artist

                for (const w of words) {
                    if (!this.scorable_words.has(w)) continue;
                    // Initialize set for this word
                    if (!this.wordGuessers.has(w)) this.wordGuessers.set(w, new Set());
                    const guessersForWord = this.wordGuessers.get(w);
                    if (guessersForWord.has(socket)) continue; // already got credit earlier

                    // Inverse scoring: fewer prior guessers => more points.
                    const priorCount = guessersForWord.size; // how many others already got it
                    // Example formula: (totalGuessers - priorCount) ensures first gets max, last gets 1.
                    const pointsForThisWord = Math.max(1, totalGuessers - priorCount);
                    totalPointsEarned += pointsForThisWord;
                    guessersForWord.add(socket);
                    socket.guessedWords.add(w);
                    newlyGuessed.push(w);
                    // Artist gains +1 for every correct placeholder guess (even if others already found it)
                    artistBonusPerWord += 1;
                }

                if (totalPointsEarned > 0) {
                    this.scores.set(socket, this.scores.get(socket) + totalPointsEarned);
                    // Award artist +1 per placeholder guessed in this message (not limited to first discovery)
                    if (artistBonusPerWord > 0 && this.currentArtist) {
                        if (!this.scores.has(this.currentArtist)) this.scores.set(this.currentArtist, 0);
                        this.scores.set(this.currentArtist, this.scores.get(this.currentArtist) + artistBonusPerWord);
                    }
                    // Broadcast point_scored events (guesser and artist bonus if any)
                    this.broadcast({ type: 'point_scored', userId: message.userId, points: totalPointsEarned });
                    if (artistBonusPerWord > 0 && this.currentArtist) {
                        const artistIdBroadcast = this.getUserId(this.currentArtist);
                        if (artistIdBroadcast != null) this.broadcast({ type: 'point_scored', userId: artistIdBroadcast, points: artistBonusPerWord });
                    }
                    // Preserve original content explicitly before any mutation
                    const originalContent = message.content;
                    const suffix = ` [+${totalPointsEarned} point${totalPointsEarned!==1?'s':''}]`;
                    // Censor newly guessed scorable words for other players (artist + guesser see uncensored)
                    let censored = originalContent;
                    for (const w of newlyGuessed) {
                        const re = new RegExp('\\b' + w.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&') + '\\b', 'gi');
                        censored = censored.replace(re, '*'.repeat(w.length));
                    }
                    // Send uncensored version to the guesser (with points)
                    this.sendTo(socket, { type: "chat", userId: message.userId, content: originalContent + suffix });
                    // Also send uncensored to the current artist (if different)
                    if (this.currentArtist && this.currentArtist !== socket) {
                        this.sendTo(this.currentArtist, { type: "chat", userId: message.userId, content: originalContent + suffix });
                    }
                    // Send censored version to all other guessers (with points)
                    for (const client of this.clients) {
                        if (client === socket || client === this.currentArtist) continue;
                        this.sendTo(client, { type: "chat", userId: message.userId, content: censored + suffix });
                    }

                    // Send updated masked prompt (with this user's discovered words revealed) only to the guesser
                    const personalized = this.prompt_tokens.map(t => {
                        if (t.type === 'literal') return t.value;
                        const lw = t.value.toLowerCase();
                        if (socket.guessedWords && socket.guessedWords.has(lw)) return `[${t.value}]`; // bracket revealed word
                        return '_'.repeat(t.value.length);
                    }).join(' ');
                    this.sendTo(socket, { type: 'prompt_update', prompt: personalized });
                } else {
                    // Regular chat broadcast only to others (no points scored)
                    // Ensure non-scoring chat message is capped/cleaned
                    const safe2 = typeof message.content === 'string' ? message.content.replace(/[\u0000-\u001F\u007F]/g, '').slice(0, 240) : '';
                    this.broadcast({ type: "chat", userId: message.userId, content: safe2 }, null);
                }

                // Check if all scorable words have been found by at least one player (excluding artist)
                const allFound = Array.from(this.scorable_words).every(sw => {
                    const set = this.wordGuessers.get(sw);
                    if (!set) return false;
                    // Consider found if at least one guesser (other than artist) has it
                    return Array.from(set).some(s => s !== this.currentArtist);
                });
                if (allFound) {
                    this.gameState = 'reveal';
                    this.timer = this.revealTime;
                    const fullyBracketed = this.prompt_tokens.map(t => t.type === 'literal' ? t.value : `[${t.value}]`).join(' ');
                    this.broadcast({ type: "game_state", state: "reveal", prompt: fullyBracketed, artistId: this.getUserId(this.currentArtist), time: this.revealTime });
                }
            } else {
                // Normal chat when not in drawing phase (include sender)
                this.broadcast(message, null);
            }
        }
    }

    stopGameLoop() {
        if (this.gameTimer) {
            clearInterval(this.gameTimer);
            this.gameTimer = null;
        }
    }

    formatScores(map) {
        return Array.from(map.entries()).map(([socket, score]) => ({ userId: this.users.get(socket)?.id, score })).filter(e=> e.userId!=null);
    }

    broadcastWaitingWithScores() {
        const merged = new Map();
        // Use persistentScores as base
        for (const [sock,val] of this.persistentScores.entries()) merged.set(sock,val);
        // Add current round partial scores (should be empty normally at waiting start)
        for (const [sock,val] of this.scores.entries()) merged.set(sock,(merged.get(sock)||0)+val);
        // Ensure every current user appears with at least 0
        for (const sock of this.clients) {
            if (!merged.has(sock)) merged.set(sock, 0);
        }
        this.broadcast({ type: 'game_state', state: 'waiting', time: this.timer, scores: this.formatScores(merged) });
    }

    sendScoreboardTo(socket) {
        const merged = new Map();
        for (const [sock,val] of this.persistentScores.entries()) merged.set(sock,val);
        for (const [sock,val] of this.scores.entries()) merged.set(sock,(merged.get(sock)||0)+val);
        for (const sock2 of this.clients) {
            if (!merged.has(sock2)) merged.set(sock2, 0);
        }
        this.sendTo(socket, { type: 'game_state', state: 'waiting', time: this.timer, scores: this.formatScores(merged) });
    }

    maskedPromptForNewJoiner() {
        if (!this.prompt_tokens || !this.prompt_tokens.length) return '';
        return this.prompt_tokens.map(t => t.type==='literal'? t.value : '_'.repeat(t.value.length)).join(' ');
    }

    desiredWaitForPlayers() {
        // Scale from 20s at minPlayers (or fewer) down to 10s at maxPlayers using linear interpolation
        const high = this.waitTime; // 20
        const low = 10; // target at max players
        const p = this.clients.size;
        if (p >= this.maxPlayers) return low;
        if (p <= this.minPlayers) return high;
        const span = this.maxPlayers - this.minPlayers;
        const t = (p - this.minPlayers) / span; // 0..1
        return high - (high - low) * t;
    }

    // Force move to reveal phase safely (e.g., artist disconnect)
    forceReveal(reason = '') {
        if (this.gameState !== 'drawing') return;
        this.gameState = 'reveal';
        this.timer = this.revealTime;
        const fullyBracketed = this.prompt_tokens.map(t => t.type === 'literal' ? t.value : `[${t.value}]`).join(' ');
        this.broadcast({ type: 'game_state', state: 'reveal', prompt: fullyBracketed, artistId: this.getUserId(this.currentArtist), time: this.revealTime, reason });
    }

    // Reset to waiting state and announce scoreboard
    backToWaiting(reason = '') {
        // Merge scores into persistent
        for (const [sock, val] of this.scores.entries()) {
            const prev = this.persistentScores.get(sock) || 0;
            this.persistentScores.set(sock, prev + val);
        }
        this.scores.clear();
        this.correct_guessers = [];
        this.currentArtist = null;
        this.pastArtists = [];
        this.gameState = 'waiting';
        this.timer = this.desiredWaitForPlayers();
        this.broadcast({ type: 'game_state', state: 'waiting', time: this.timer, reason });
        this.broadcastWaitingWithScores();
    }
}

export default GuessingGameLobby;
