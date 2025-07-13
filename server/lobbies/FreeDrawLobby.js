import Lobby from './Lobby.js';

class FreeDrawLobby extends Lobby {
    constructor(id) {
        super(id, 4);
    }

    handleMessage(socket, message) {
        // Free drawing - all messages allowed, no restrictions
        super.handleMessage(socket, message);
    }
}

export default FreeDrawLobby;
