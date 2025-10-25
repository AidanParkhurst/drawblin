import QuickDrawLobby from './QuickDrawLobby.js';
import prompts from '../prompts.js';

// Mobile variant for QuickDraw. Mobile screens may prefer fewer players and
// slightly shortened timers, and shorter prompts (single noun or occasionally "adj noun").
class QuickDrawMobileLobby extends QuickDrawLobby {
    constructor(id) {
        super(id);
        this.isMobile = true;
        // Prefer smaller groups on mobile
        this.maxPlayers = Math.min(6, this.maxPlayers);
        // Optionally shorten some timers for mobile sessions to keep rounds snappier
        this.drawingTime = Math.max(60, this.drawingTime - 30);
        this.votingTime = Math.max(8, this.votingTime - 5);
    }

    // Override prompt selection for mobile: mostly single nouns, sometimes "adj noun".
    pickNewPrompt() {
        const lex = Array.isArray(prompts?.lexicon) ? prompts.lexicon : [];
        const adjectives = Array.isArray(prompts?.adjectives) ? prompts.adjectives : [];

        // Prefer single-word lexicon entries (no spaces)
        const singles = lex.filter(e => e && typeof e.word === 'string' && !e.word.includes(' ')).map(e => e.word);
        const pool = singles.length ? singles : (lex.map(e => e.word).filter(Boolean));
        if (!pool.length) return 'thing';

        // Decide whether to return an adjective + noun. Keep adj+noun rare on mobile.
        const adjChance = 0.18; // ~18% of prompts will be adjective + noun
        const useAdj = Math.random() < adjChance && adjectives.length > 0;

        const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

        let noun = pick(pool);
        if (!noun) noun = pool[0];

        let choice = noun;
        if (useAdj) {
            const adj = pick(adjectives);
            if (adj) choice = `${adj} ${noun}`;
        }

        // Avoid recent repeats similar to parent implementation
        const recentSet = new Set(this.recentPrompts || []);
        if (recentSet.has(choice)) {
            // Try a few times to pick a different noun before giving up
            for (let i = 0; i < 6; i++) {
                noun = pick(pool);
                if (!noun) break;
                if (useAdj) {
                    const adj = pick(adjectives);
                    choice = adj ? `${adj} ${noun}` : noun;
                } else {
                    choice = noun;
                }
                if (!recentSet.has(choice)) break;
            }
        }

        this.recentPrompts = this.recentPrompts || [];
        this.recentPrompts.push(choice);
        if (this.recentPrompts.length > (this.recentLimit || 10)) this.recentPrompts.shift();
        return choice;
    }
}

export default QuickDrawMobileLobby;
