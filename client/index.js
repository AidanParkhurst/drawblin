import p5 from "p5";

import Goblin from "./goblin.js";
import Portal from "./portal.js";
import Line from "./line.js";
import Chat from "./chat.js";
import { ws, connect, sendMessage } from "./network.js";

// -- Game State Initialization --
let you;
let chat;
let goblins = [];
let lobby_type = 'freedraw'; // Default lobby type
let game_state = 'lobby';

// Quick Draw
// game_state can be 'lobby', 'waiting', 'drawing', or 'voting'
let prompt = "";
let timer = 0;
let current_artist = -1; // id of the artist who drew the art being voted on

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

// Calculate relative luminance for contrast checking
function getLuminance(color) {
    // Normalize RGB values to 0-1 range
    const [r, g, b] = color.map(c => {
        c = c / 255;
        return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
    });
    
    // Calculate luminance using the standard formula
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

// Calculate contrast ratio between two colors
function getContrastRatio(color1, color2) {
    const lum1 = getLuminance(color1);
    const lum2 = getLuminance(color2);
    
    const brightest = Math.max(lum1, lum2);
    const darkest = Math.min(lum1, lum2);
    
    return (brightest + 0.05) / (darkest + 0.05);
}

// Darken a color by a given factor (0-1, where 0 = black, 1 = original)
function darkenColor(color, factor = 0.6) {
    return color.map(c => Math.floor(c * factor));
}

// Calculate appropriate UI color based on contrast
function calculateUIColor(color, backgroundColor) {
    const contrastRatio = getContrastRatio(color, backgroundColor);
    
    // WCAG AA standard recommends 4.5:1 for normal text
    // We'll use 3:1 as our threshold for UI elements
    if (contrastRatio < 3) {
        // Color doesn't have enough contrast, darken it
        let darkenedColor = darkenColor(color, 0.6);
        
        // Keep darkening until we get good contrast or hit a minimum
        let attempts = 0;
        while (getContrastRatio(darkenedColor, backgroundColor) < 3 && attempts < 5) {
            darkenedColor = darkenColor(darkenedColor, 0.8);
            attempts++;
        }
        
        return darkenedColor;
    }
    
    // Color has good contrast, use original
    return [...color]; // Return a copy to avoid reference issues
}

async function start() {
    you = new Goblin(width / 2, height / 2, 50, [random(255), random(255), random(255)], true);
    
    // Calculate UI color based on contrast against background (240, 240, 240)
    you.ui_color = calculateUIColor(you.color, [240, 240, 240]);
    
    goblins.push(you);
    chat = new Chat(); 
    let freedraw_portal = new Portal(width / 2, height / 2 - 200, 150, you.ui_color, "Stand here to join\nFree Draw", () => {
        you.lines = [];
        connect('freedraw'); // Connect to the freedraw game type
        joined = true;
        lobby_type = 'freedraw'; // Set the lobby type to freedraw
    });
    let quickdraw_portal = new Portal(width / 2 + 400, height / 2 - 200, 150, you.ui_color, "Stand here to join\nQuick Draw", () => {
        you.lines = [];
        connect('quickdraw'); // Connect to the quickdraw game type
        joined = true;
        lobby_type = 'quickdraw'; // Set the lobby type to quickdraw
        timer = 30;
    });
    let guessinggame_portal = new Portal(width / 2 - 400, height / 2 - 200, 150, you.ui_color, "Coming soon...\nGuessing Game", () => {
        // you.lines = [];
        // connect('guessinggame'); // Connect to the guessing game type
        // joined = true;
        // lobby_type = 'guessinggame'; // Set the lobby type to guessinggame
    });
    portals.push(freedraw_portal, quickdraw_portal, guessinggame_portal);

    return;
}


// -- P5 Initialization --
window.setup = async() => {
    createCanvas(windowWidth, windowHeight);
    ellipseMode(CENTER);
    textFont('Verdana');
    textSize(16);
    start();
}
window.windowResized = () => { resizeCanvas(windowWidth, windowHeight); }

window.draw = () => {
    background(240);
    if (!hasInput) {
        drawTitle();
    } else if (!joined) {
        for (let portal of portals) {
            portal.update(deltaTime);
        }
    }

    chat.update();

    if (lobby_type === 'freedraw') {
        freedraw_update(deltaTime);
    } else if (lobby_type === 'quickdraw') {
        quickdraw_update(deltaTime);
    }

    if (drawing && mouseIsPressed) {
        if (dist(you.cursor.x, you.cursor.y, last_mouse.x, last_mouse.y) < line_granularity) return; // Skip if the mouse hasn't moved enough
        var l = new Line(createVector(last_mouse.x, last_mouse.y), createVector(you.cursor.x, you.cursor.y), you.color, 5);
        you.lines.push(l); // Store the line in the goblin's lines array
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
    if (timer > 0) {
        timer -= delta / 1000; // Convert delta to seconds
    } else {
        timer = 0;
    }
    var header = "";
    if (game_state === 'lobby') { // See all players, all lines, countdown to start
        for (let goblin of goblins) {
            goblin.update(delta);
        }
        header = `Waiting for players... (${int(timer)} seconds left)`;
    } else if (game_state === 'voting') { // See all players, only the current artist's lines, and a header to vote
        for (let goblin of goblins) {
            if (goblin.id === current_artist) {
                goblin.update(delta); // Don't draw lines for the current artist
            } else {
                goblin.update(delta, false);
            }
        }
        // TODO vote ui instead of header?
        header = `Rate this drawing by ${current_artist}.`; // TODO: name instead of id
    } else if (game_state === 'drawing') { // See only you and your lines, and a header with the prompt and timer
        you.update(delta);
        header = `Draw: ${prompt} (${int(timer)} seconds)`;
    }
    
    push();
    fill(you.ui_color[0], you.ui_color[1], you.ui_color[2], 150);
    textAlign(CENTER);
    textSize(24);
    text(header, width / 2, 50); // Draw the header at the top center
    pop();
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
    if (chat.input.contains(mouseX, mouseY)) return;
    if (game_state === 'voting' || game_state === 'waiting') {
        return;
    }
    drawing = true;
    last_mouse = createVector(you.cursor.x, you.cursor.y);
    last_line_count = you.lines.length; // Store the initial line count
}

window.mouseReleased = () => {
    if (drawing && you.lines.length === last_line_count) { // If no new line was added
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

// -- Networking Setup --
function onopen() {
    console.log("WebSocket connection established");
    // TODO: maybe useful to send an introductory message, once the goblin is loaded
}
function onmessage(event) {
    const data = JSON.parse(event.data);
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
                chatUser.say(data.content);
                chat.messages.push({user: chatUser, content: data.content});

            } else {
                chat.messages.push({user: null, content: data.content});
            }
            break;
        case "update":
            // Update the goblin's position and state based on the received data
            const goblin = goblins.find(g => g.id === data.goblin.id);
            if (!goblin) {
                // If the goblin doesn't exist, create a new one
                goblins.push(new Goblin(data.goblin.x, data.goblin.y, data.goblin.size, data.goblin.color, false, data.goblin.id));
                return;
            }
            if (goblin) {
                // TODO: Prob shouldn't be accessing _values, but otherwise it doesnt work
                goblin.x = data.goblin.x;
                goblin.y = data.goblin.y;
                goblin.cursor = createVector(data.goblin.cursor._values[0], data.goblin.cursor._values[1]);
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

        case "game_start":
            // Handle game start for quickdraw
            game_state = 'drawing';
            prompt = data.prompt;
            timer = data.time;
            for (let goblin of goblins) {
                goblin.lines = []; // Clear lines for all goblins
            }
            break;
        
        case "drawing_finished":
            // Handle drawing finished for quickdraw
            game_state = 'waiting';
            current_artist = data.artistId;
            prompt = data.prompt;
            timer = data.time;
            break;
        
        case "voting_start":
            // Handle voting start for quickdraw
            game_state = 'voting';
            current_artist = data.artistId;
            timer = data.time;
            break;
    }
}

export { you, goblins, chat, onopen, onmessage };