import QuickDrawLobby from './QuickDrawLobby.js';

// Mobile variant for QuickDraw. Mobile screens may prefer fewer players and
// slightly shortened timers; override nothing behaviorally here but expose a flag
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
}

export default QuickDrawMobileLobby;
