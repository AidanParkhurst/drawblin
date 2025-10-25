import GuessingGameLobby from './GuessingGameLobby.js';
import prompts from '../prompts.js';

// Mobile variant for GuessingGame. Keep core behavior but mark mobile and slightly
// adjust timing to account for mobile pacing. Also prefer short phrase prompts
// (single noun or occasionally "adj noun") for easier drawing on small screens.
class GuessingGameMobileLobby extends GuessingGameLobby {
    constructor(id) {
        super(id);
        this.isMobile = true;
        this.maxPlayers = Math.min(4, this.maxPlayers);
        this.drawingTime = Math.max(45, this.drawingTime - 30);
        this.revealTime = Math.max(3, this.revealTime - 2);
    }

    // Replace complex phrase generation with a mobile-friendly short prompt generator
    generatePhrasePrompt() {
        const lex = Array.isArray(prompts?.lexicon) ? prompts.lexicon : [];
        const adjectives = Array.isArray(prompts?.adjectives) ? prompts.adjectives : [];
        const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

        // Prefer single-word lexicon entries
        const singles = lex.filter(e => e && typeof e.word === 'string' && !e.word.includes(' ')).map(e => e.word);
        const pool = singles.length ? singles : (lex.map(e => e.word).filter(Boolean));
        if (!pool.length) {
            // fallback to a tiny set
            this.prompt_tokens = [{ type: 'noun', value: 'thing' }];
            this.prompt = 'thing';
            this.scorable_words = new Set(['thing']);
            return;
        }

        const adjChance = 0.18;
        const useAdj = Math.random() < adjChance && adjectives.length > 0;

        const noun = pick(pool);
        let tokens = [];
        if (useAdj) {
            const adj = pick(adjectives) || '';
            if (adj) tokens.push({ type: 'adj', value: adj });
        }
        tokens.push({ type: 'noun', value: noun });

        this.prompt_tokens = tokens;
        this.prompt = tokens.map(t => t.value).join(' ');
        this.scorable_words = new Set(tokens.filter(t => t.type !== 'literal').map(t => t.value.toLowerCase()));
    }
}

export default GuessingGameMobileLobby;
