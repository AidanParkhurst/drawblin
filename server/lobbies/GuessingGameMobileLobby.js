import GuessingGameLobby from './GuessingGameLobby.js';

// Mobile variant for GuessingGame. Keep core behavior but mark mobile and slightly
// adjust timing to account for mobile pacing.
class GuessingGameMobileLobby extends GuessingGameLobby {
    constructor(id) {
        super(id);
        this.isMobile = true;
        this.maxPlayers = Math.min(4, this.maxPlayers);
        this.drawingTime = Math.max(45, this.drawingTime - 30);
        this.revealTime = Math.max(3, this.revealTime - 2);
    }
}

export default GuessingGameMobileLobby;
