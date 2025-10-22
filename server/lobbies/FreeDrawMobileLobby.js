import FreeDrawLobby from './FreeDrawLobby.js';

// Mobile variant of FreeDrawLobby. Keeps behavior identical but marks lobby as mobile
// and uses a smaller maxPlayers by default to account for smaller screens.
class FreeDrawMobileLobby extends FreeDrawLobby {
    constructor(id) {
        super(id);
        this.isMobile = true;
        // reduce max players slightly for mobile sessions (configurable)
        this.maxPlayers = Math.min(4, this.maxPlayers);
    }
}

export default FreeDrawMobileLobby;
