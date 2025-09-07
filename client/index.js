import p5 from "p5";

import Goblin from "./goblin.js";
import Portal from "./portal.js";
import Line from "./line.js";
import Chat from "./chat.js";
import PlayerList from "./players.js";
import Toolbelt from "./toolbelt.js";
import { drawHeader, drawWaitingWithScoreboard } from './header.js';
import { ws, connect, sendMessage } from "./network.js";
import { assets } from "./assets.js";
import { calculateUIColor, randomPaletteColor } from "./colors.js";
import { ready as authReady, isAuthConfigured, getUser } from './auth.js';
import { getProfileName, upsertProfileName } from './auth.js';
import { generateGoblinName } from './names.js';

// -- Game State Initialization --
let you;
let chat;
let playerList;
let toolbelt;
let goblins = [];
let header = "";
let lobby_type = 'freedraw'; // Default lobby type
let game_state = 'lobby';

// Gamemode dependent variables
let prompt = "";
let prompt_length = -1; // legacy single-word length (still used for quickdraw underscore fallback)
let last_winner = -1; // id of last winner 
let timer = 0;
let current_artist = -1; // id of the artist who drew the art being voted on
let results = [];

// drawing vars
let drawing = false;
let last_mouse = { x: 0, y: 0 };
let line_granularity = 10; // How many pixels between each line point
let last_line_count = 0;

// networking
let heartbeat = 150; 
let heartbeat_timer = 0;
let portals = [];
let joined = false; // Track if the user has joined a game


let hasInput = false;

// Line intersection utility function for eraser
function lineIntersect(line1Start, line1End, line2Start, line2End) {
    const x1 = line1Start.x, y1 = line1Start.y;
    const x2 = line1End.x, y2 = line1End.y;
    const x3 = line2Start.x, y3 = line2Start.y;
    const x4 = line2End.x, y4 = line2End.y;
    
    const denom = (x1 - x2) * (y3 - y4) - (y1 - y2) * (x3 - x4);
    if (denom === 0) return false; // Lines are parallel
    
    const t = ((x1 - x3) * (y3 - y4) - (y1 - y3) * (x3 - x4)) / denom;
    const u = -((x1 - x2) * (y1 - y3) - (y1 - y2) * (x1 - x3)) / denom;
    
    return t >= 0 && t <= 1 && u >= 0 && u <= 1;
}

async function start() {
    // Determine name: account name if available; otherwise generate; if account exists but has no name, set a random name in DB
    let name = '';
    if (isAuthConfigured()) {
        await authReady();
        const user = getUser();
        if (user) {
            const existing = await getProfileName();
            if (existing && existing.trim()) {
                name = existing.trim();
            } else {
                // Account without name yet: generate and save
                name = generateGoblinName();
                await upsertProfileName(name);
            }
        }
    }
    if (!name) {
        // Guest or no auth configured
        name = generateGoblinName();
    }

    you = new Goblin(
        width / 2,
        height / 2,
        randomPaletteColor(),
        true,
        -1,
        random(['manny', 'stanley', 'ricky', 'blimp', 'hippo', 'grubby']),
        name
    ); // Create the local goblin

    // Calculate UI color based on contrast against background (240, 240, 240)
    you.ui_color = calculateUIColor(you.color, [240, 240, 240]);
    
    goblins.push(you);
    chat = new Chat(); 
    playerList = new PlayerList(50, 20); // Create the player list with default circle size and spacing
    toolbelt = new Toolbelt(); // Create the toolbelt

    let freedraw_portal = new Portal(width / 2, height / 2 - 200, 150, you.ui_color, "Stand here to join\nFree Draw", () => {
        you.lines = [];
        connect('freedraw'); // Connect to the freedraw game type
        joined = true;
        lobby_type = 'freedraw'; // Set the lobby type to freedraw
    });
    let quickdraw_portal = new Portal(width / 2 + 400, height / 2 - 200, 150, you.ui_color, "Stand here to join\nQuick Draw", () => {
        you.lines = [];
        // game_state = 'waiting'; // Set game state to waiting
        connect('quickdraw'); // Connect to the quickdraw game type
        joined = true;
        lobby_type = 'quickdraw'; // Set the lobby type to quickdraw
        timer = 20;
    });
    let guessinggame_portal = new Portal(width / 2 - 400, height / 2 - 200, 150, you.ui_color, "Stand here to join\nGuessing Game", () => {
        you.lines = [];
        connect('guessinggame'); // Connect to the guessing game type
        joined = true;
        lobby_type = 'guessinggame'; // Set the lobby type to guessinggame
        timer = 20;
    });
    portals.push(freedraw_portal, quickdraw_portal, guessinggame_portal);

    return;
}


// -- P5 Initialization --

window.setup = async() => {
    await assets.preloadAssets(); // Preload all assets
    let canvas = createCanvas(windowWidth, windowHeight);
    
    // Disable default drag behavior on canvas
    canvas.elt.addEventListener('dragstart', (e) => e.preventDefault());
    
    ellipseMode(CENTER);
    textFont(assets.font);
    textSize(16);
    // No auth UI logic here; button is bound by auth.js module
    await start();

    // React to auth changes: update goblin name accordingly
    window.addEventListener('auth:user-changed', async (evt) => {
        const user = evt.detail?.user || null;
        if (!you) return;
        let name = '';
        if (user) {
            const existing = await getProfileName();
            if (existing && existing.trim()) {
                name = existing.trim();
            } else {
                name = generateGoblinName();
                await upsertProfileName(name);
            }
        } else {
            name = generateGoblinName();
        }
        if (name && name !== you.name) {
            you.name = name;
            sendMessage({ type: 'update', goblin: you });
        }
    });

    // React to profile display-name saves from the account menu
    window.addEventListener('profile:name-updated', (evt) => {
        const newName = (evt.detail?.name || '').trim();
        if (!you || !newName) return;
        if (newName !== you.name) {
            you.name = newName;
            sendMessage({ type: 'update', goblin: you });
        }
    });

    // When UI color changes (e.g., via profile color picker), update any visible portals
    window.addEventListener('ui:color-changed', (evt) => {
        if (!Array.isArray(you?.ui_color)) return;
        for (const p of portals) {
            if (p && Array.isArray(p.color)) p.color = [...you.ui_color];
        }
    });
}
window.windowResized = () => { 
    resizeCanvas(windowWidth, windowHeight);
    // Move portals to new positions based on the new window size
    portals[0].x = width / 2;
    portals[0].y = height / 2 - 200;
    portals[1].x = width / 2 + 400;
    portals[1].y = height / 2 - 200;
    portals[2].x = width / 2 - 400;
    portals[2].y = height / 2 - 200;
    chat.moveInput(windowWidth, windowHeight);
}

window.draw = () => {
    background(240);
    cursor(ARROW); // Set default cursor at the beginning of each frame
    
    if (!hasInput) {
        drawTitle();
    } else if (!joined) {
        for (let portal of portals) {
            portal.update(deltaTime);
        }
    }


    if (lobby_type === 'freedraw') {
        freedraw_update(deltaTime);
    } else if (lobby_type === 'quickdraw') {
        quickdraw_update(deltaTime);
    } else if (lobby_type === 'guessinggame') {
        guessinggame_update(deltaTime);
    }

    chat.update();
    playerList.update();
    toolbelt.update();

    if (drawing && mouseIsPressed) {
        if (dist(you.cursor.x, you.cursor.y, last_mouse.x, last_mouse.y) < line_granularity) return; // Skip if the mouse hasn't moved enough
        
        if (you.tool === 'eraser') {
            // Eraser logic: remove lines that intersect with the eraser path
            const eraserLine = {
                start: createVector(last_mouse.x, last_mouse.y),
                end: createVector(you.cursor.x, you.cursor.y)
            };
            
            // Check each line for intersection with eraser path
            for (let i = you.lines.length - 1; i >= 0; i--) {
                const line = you.lines[i];
                if (lineIntersect(eraserLine.start, eraserLine.end, line.start, line.end)) {
                    you.lines.splice(i, 1); // Remove the intersected line
                }
            }
        } else {
            // Regular brush/drawing logic
            var l = new Line(createVector(last_mouse.x, last_mouse.y), createVector(you.cursor.x, you.cursor.y), you.color, 5);
            you.lines.push(l); // Store the line in the goblin's lines array
        }
    }

    last_mouse = createVector(you.cursor.x, you.cursor.y);


    heartbeat_timer += deltaTime;
    if (heartbeat_timer >= heartbeat && ws && ws.readyState === WebSocket.OPEN) {
        // Send the updated goblin state to the server
        sendMessage({
            type: "update",
            goblin: you
        });
        heartbeat_timer = 0;
    }
}

function freedraw_update(delta) {
    for (let goblin of goblins) {
        goblin.update(delta);
    }
}

function quickdraw_update(delta) {
    timer -= delta / 1000; // Convert delta to seconds
    timer = Math.max(0, timer); // Ensure timer doesn't go negative

    let headerText = '';
    if (game_state === 'waiting') {
        // Clear crowns (winner crown only shown during finished state)
        for (let goblin of goblins) goblin.update(delta, true, true);
        headerText = `Waiting for players...`;
    } else if (game_state === 'drawing') {
        for (let g of goblins) g.hasCrown = false;
        you.update(delta);
        headerText = `Draw [${prompt}]`;
    } else if (game_state === 'pre-voting') {
        for (let goblin of goblins) goblin.update(delta, false);
        headerText = `Time's up! Get ready to vote.`;
    } else if (game_state === 'voting') {
        for (let goblin of goblins) {
            if (goblin.id === current_artist) goblin.update(delta); else goblin.update(delta, false);
        }
        headerText = `Rate this drawing 1-5`;
    } else if (game_state === 'finished') {
        last_winner = (goblins.find(g => g.id === results[0]?.artistId))?.id || -1;
        let winnerName = '';
        for (let goblin of goblins) {
            if (last_winner !== -1 && goblin.id === last_winner) {
                goblin.update(delta, true, true);
                goblin.hasCrown = true; // winner gets crown
                winnerName = goblin.name;
            } else {
                goblin.update(delta, false, true);
                goblin.hasCrown = false;
            }
        }
        headerText = last_winner !== -1 ? `Winner: ${winnerName}!` : 'No winner';
    }
    if (headerText) drawHeader(headerText, int(timer), you.ui_color);
}

function guessinggame_update(delta) {
    timer -= delta / 1000; // Convert delta to seconds
    timer = Math.max(0, timer); // Ensure timer doesn't go negative
    var header = "";
    if (game_state === 'waiting') { // See all players, all lines, countdown
        // Update everyone and compute crowns for top scorer
        let top = null;
        if (results && results.length) {
            for (const r of results) {
                if (!top || r.score > top.score || (r.score === top.score && r.userId < top.userId)) top = r;
            }
        }
        for (let goblin of goblins) {
            goblin.hasCrown = (top && goblin.id === top.userId);
            goblin.update(delta, true, true);
        }
        if (results && results.length) {
            drawWaitingWithScoreboard(timer, results, goblins, you.ui_color);
        } else {
            header = `Waiting for players...`;
        }
    }
    else if (game_state === 'drawing') { // See current artist's lines, header with underscores of the prompt length, and timer
        for (let goblin of goblins) {
            if (goblin.id === current_artist) {
                goblin.update(delta);
            } else {
                goblin.update(delta, false);
            }
            goblin.hasCrown = false; // no crowns during drawing
        }
        if (you.id === current_artist) {
            header = `Draw a ${prompt}`;
        } else {
            header = prompt;
        }
    }
    else if (game_state === 'reveal') { // See all players, current artist's lines, and a header with the prompt
        for (let goblin of goblins) {
            if (goblin.id === current_artist) {
                goblin.update(delta, true);
            } else {
                goblin.update(delta, false);
            }
            goblin.hasCrown = false; // crowns reserved for waiting scoreboard in guessing game
        }
    // Server sends fully bracketed phrase on reveal; display colored without timer
        header = "It was a " + prompt;
    }

    if (header) drawHeader(header, int(timer), you.ui_color);
}

function drawTitle() {
    push();
    translate(0, -100);
    textAlign(CENTER);
    fill(you.ui_color[0], you.ui_color[1], you.ui_color[2]);
    textSize(16);
    text("Click to Draw, WASD or Arrows to Move", width / 2, height / 2 + 50);
    textSize(32);
    textStyle(BOLD);
    text("Drawblins!", width / 2, height / 2);
    pop();
}

window.mousePressed = () => {
    hasInput = true; // Set hasInput to true when the user clicks
    
    // Check if mouse is interacting with any UI elements
    if (chat.isMouseInteracting() || playerList.isMouseInteracting() || toolbelt.isMouseInteracting()) {
        return; // Don't start drawing if interacting with UI
    }
    
    if (game_state === 'voting' || game_state === 'pre-voting') {
        return;
    }
    drawing = true;
    last_mouse = createVector(you.cursor.x, you.cursor.y);
    last_line_count = you.lines.length; // Store the initial line count
}

window.mouseReleased = () => {
    if (drawing && you.lines.length === last_line_count && you.tool !== 'eraser') { // If no new line was added and not using eraser
        var l = new Line(createVector(you.cursor.x, you.cursor.y), createVector(you.cursor.x, you.cursor.y), you.color, 5);
        you.lines.push(l); // Store the line in the goblin's lines array
    }
    drawing = false;
    // add a dot line to the goblin's lines
}

window.keyPressed = () => {
    hasInput = true; // Set hasInput to true when the user presses a key
    chat.input.keyPressed(keyCode);
}

window.addEventListener('keydown', (event) => {
    you.keyStates[event.key] = true;
});
window.addEventListener('keyup', (event) => {
    you.keyStates[event.key] = false; // Reset the key state when the key is
});

window.addEventListener('blur', () => {
    // Reset the key states when the window loses focus
    for (let k in you.keyStates) {
        you.keyStates[k] = false;
    }
    you.input.x = 0; // Reset input to prevent movement when focus is regained
    you.input.y = 0; // Reset input to prevent movement when focus is regained
});

// -- Networking Setup --
function onopen() {
    console.log("WebSocket connection established");
    // TODO: maybe useful to send an introductory message, once the goblin is loaded
}
function onmessage(event) {
    let data;
    try {
        data = JSON.parse(event.data);
    } catch (e) {
        console.error('Invalid JSON from server:', e);
        return;
    }
    // print(data);
    // Handle incoming messages from the server
    if (!data || !data.type) {
        console.error("Invalid data received:", data);
        return;
    }

    switch (data.type) {
        case "chat":
            // Handle chat messages
            if (data.userId) {
                let chatUser = goblins.find(g => g.id === data.userId);
                if (chatUser && typeof chatUser.say === 'function') {
                    chatUser.say(data.content);
                    chat.messages.push({ user: chatUser, content: data.content });
                } else {
                    chat.messages.push({ user: null, content: data.content });
                }
                if (data.guessed && Array.isArray(data.guessed) && typeof guessed_words !== 'undefined' && guessed_words && typeof guessed_words.add === 'function') {
                    for (const g of data.guessed) {
                        if (g.guessed) guessed_words.add(g.word);
                    }
                }
            } else {
                chat.messages.push({ user: null, content: data.content });
                if (data.guessed && Array.isArray(data.guessed) && typeof guessed_words !== 'undefined' && guessed_words && typeof guessed_words.add === 'function') {
                    for (const g of data.guessed) {
                        if (g.guessed) guessed_words.add(g.word);
                    }
                }
            }
            break;
        case "update":
            // Update the goblin's position and state based on the received data
            const goblin = goblins.find(g => g.id === data.goblin.id);
            if (!goblin) {
                // If the goblin doesn't exist, create a new one
                const color = Array.isArray(data.goblin.color) && data.goblin.color.length===3 ? data.goblin.color : randomPaletteColor();
                goblins.push(new Goblin(data.goblin.x, data.goblin.y, color, false, data.goblin.id, data.goblin.shape, data.goblin.name || ''));
                return;
            }
            if (goblin) {
                // TODO: Prob shouldn't be accessing _values, but otherwise it doesnt work
                goblin.x = data.goblin.x;
                goblin.y = data.goblin.y;
                if (data.goblin.cursor && Array.isArray(data.goblin.cursor._values)) {
                    goblin.cursor = createVector(data.goblin.cursor._values[0], data.goblin.cursor._values[1]);
                } else if (data.goblin.cursor && typeof data.goblin.cursor.x === 'number' && typeof data.goblin.cursor.y === 'number') {
                    goblin.cursor = createVector(data.goblin.cursor.x, data.goblin.cursor.y);
                }
                goblin.color = (Array.isArray(data.goblin.color) && data.goblin.color.length===3) ? data.goblin.color : goblin.color;
                goblin.ui_color = data.goblin.ui_color;
                goblin.tool = data.goblin.tool || 'brush'; // Update tool, default to brush if not provided
                goblin.name = data.goblin.name || goblin.name || '';
                goblin.shape = data.goblin.shape || goblin.shape || 'manny';
                goblin.setSize();
                if (goblin.lines.length !== data.goblin.lines.length) {
                    goblin.lines = [];
                    for (let i = 0; i < data.goblin.lines.length; i++) {
                        goblin.lines.push(new Line(
                            createVector(data.goblin.lines[i].start._values[0], data.goblin.lines[i].start._values[1]),
                            createVector(data.goblin.lines[i].end._values[0], data.goblin.lines[i].end._values[1]),
                            data.goblin.lines[i].color,
                            data.goblin.lines[i].weight));
                    }
                }
            }
            break;
        case "user_left":
            // Handle user leaving the game
            const index = goblins.findIndex(g => g.id === data.userId);
            if (index !== -1) {
                goblins.splice(index, 1); // Remove the goblin from the list
                console.log(`User ${data.userId} has left the game.`);
            } else {
                console.warn(`User ${data.userId} not found in goblins.`);
            }
            break;

        case "game_state":
            if (lobby_type === 'quickdraw') {
                if (data.state === 'waiting') {
                    if (game_state === 'finished' && last_winner !== -1) { // game restarted, clear all drawings except for the winner
                        for (let goblin of goblins) {
                            if (goblin.id !== last_winner) {
                                goblin.lines = []; // Clear lines for all except the winner
                            }
                        }
                    }
                    timer = data.time;

                } else if (data.state === 'drawing') {
                    if (game_state !== 'drawing') { // just entered the drawing state, clear previous drawings
                        for (let goblin of goblins) {
                            goblin.lines = [];
                        }
                    }
                    prompt = data.prompt;
                    timer = data.time;

                } else if (data.state === 'pre-voting') {
                    timer = data.time;

                } else if (data.state === 'voting') {
                    current_artist = data.artistId; // Set the current artist for voting
                    timer = data.time;

                } else if (data.state === 'finished') {
                    timer = data.time;
                    results = data.results;
                }

                game_state = data.state;
            }
            else if (lobby_type === 'guessinggame') {
        if (data.state === 'waiting') {
                    timer = data.time;
                } else if (data.state === 'drawing') {
                    current_artist = data.artistId;
                    // if you are the artist, you received the prompt
                    if (you.id === current_artist) {
                        if (game_state !== 'drawing') { // just entered the drawing state, clear previous drawings
                            you.lines = []; // Clear previous lines for the new drawing
                        }
                        prompt = data.prompt;
                    } else {
            // otherwise you just receive masked prompt already in data.prompt
            prompt = data.prompt;
                    }
                    timer = data.time;
                } else if (data.state === 'reveal') {
                    prompt = data.prompt;
                    current_artist = data.artistId;
                    timer = data.time;
                }
                // Always update results if scores provided (waiting phase or other states)
                if (data.scores && Array.isArray(data.scores)) {
                    results = data.scores;
                }
                game_state = data.state;
            }

            break;
        case 'prompt_update':
            if (lobby_type === 'guessinggame' && game_state === 'drawing' && you.id !== current_artist) {
                prompt = data.prompt; // updated masked prompt with newly revealed words for this player only
            }
            break;
        case 'point_scored':
            // Update local scoreboard cache if we have it
            if (lobby_type === 'guessinggame') {
                const { userId, points } = data;
                if (userId != null && typeof points === 'number') {
                    let entry = results.find(r => r.userId === userId);
                    if (!entry) {
                        entry = { userId, score: 0 };
                        results.push(entry);
                    }
                    entry.score += points;
                    // Show floating burst in player list
                    if (playerList && typeof playerList.addPointBurst === 'function') {
                        playerList.addPointBurst(userId, points);
                    }
                }
            }
            break;
    }
}

export { you, goblins, chat, onopen, onmessage };