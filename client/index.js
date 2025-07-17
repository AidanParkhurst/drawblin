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
let header = "";
let lobby_type = 'freedraw'; // Default lobby type
let game_state = 'lobby';

// Gamemode dependent variables
let prompt = "";
let prompt_length = -1;
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
    createCanvas(windowWidth, windowHeight);
    ellipseMode(CENTER);
    textFont('Verdana');
    textSize(16);
    start();
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
    } else if (lobby_type === 'guessinggame') {
        guessinggame_update(deltaTime);
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
    timer -= delta / 1000; // Convert delta to seconds
    timer = Math.max(0, timer); // Ensure timer doesn't go negative

    var header = "";
    if (game_state === 'waiting') { // See all players, all lines, countdown to start
        for (let goblin of goblins) {
            goblin.update(delta);
        }
        header = `Waiting for players... (${int(timer)} seconds)`;
    } else if (game_state === 'drawing') { // See only you and your lines, and a header with the prompt and timer
        you.update(delta);
        header = `Draw: ${prompt} (${int(timer)} seconds)`;
    } else if (game_state === 'pre-voting') {
        for (let goblin of goblins) {
            goblin.update(delta, false); // Don't draw lines yet
        }
        header = `Drawing time's up! Get ready to vote.`;
    } else if (game_state === 'voting') { // See all players, only the current artist's lines, and a header to vote
        for (let goblin of goblins) {
            if (goblin.id === current_artist) {
                goblin.update(delta); // Draw lines for the current artist
            } else {
                goblin.update(delta, false);
            }
        }
        // TODO vote ui instead of header?
        header = `Say your rating (1-5) for this drawing!`;
    } else if (game_state === 'finished') { // See all players, winner's lines, and a header with the results
        last_winner = (goblins.find(g => g.id === results[0]?.artistId))?.id || -1; // Get the last winner's id
        for (let goblin of goblins) {
            if (last_winner !== -1 && goblin.id === last_winner) {
                goblin.update(delta); // Draw lines for the winning artist
            } else {
                goblin.update(delta, false); // Don't draw lines for others
            }
        }
        header = `Winner: ${last_winner !== -1 ? last_winner : "No winner"}!`;
    }

    push();
    fill(you.ui_color[0], you.ui_color[1], you.ui_color[2], 150);
    textAlign(CENTER);
    textSize(24);
    text(header, width / 2, 50); // Draw the header at the top center
    pop();
}

function guessinggame_update(delta) {
    timer -= delta / 1000; // Convert delta to seconds
    timer = Math.max(0, timer); // Ensure timer doesn't go negative
    var header = "";
    if (game_state === 'waiting') { // See all players, all lines, countdown
        for (let goblin of goblins) {
            goblin.update(delta);
        }
        header = `Waiting for players... (${int(timer)} seconds)`;
    }
    else if (game_state === 'drawing') { // See current artist's lines, header with underscores of the prompt length, and timer
        for (let goblin of goblins) {
            if (goblin.id === current_artist) {
                goblin.update(delta);
            } else {
                goblin.update(delta, false);
            }
        }
        if (you.id === current_artist) {
            header = `Draw: ${prompt} (${int(timer)} seconds)`;
        } else {
            header = `${"_ ".repeat(prompt_length)}(${int(timer)} seconds)`;
        }
    }
    else if (game_state === 'reveal') { // See all players, current artist's lines, and a header with the prompt
        for (let goblin of goblins) {
            if (goblin.id === current_artist) {
                goblin.update(delta);
            } else {
                goblin.update(delta, false);
            }
        }
        header = `The prompt was: ${prompt}!`;
    }
    else if (game_state === 'scoreboard') { // See all players, and a header with the scores
        // Draw the scoreboard table, each row is colored by the goblin's color
        for (let result of results) {
            var artist = goblins.find(g => g.id === result.userId);
            if (artist) {
                push();
                fill(artist.color[0], artist.color[1], artist.color[2]);
                textAlign(CENTER);
                text(`${artist.id}: ${result.score}`, windowWidth / 2, 100 + results.indexOf(result) * 20);
                pop();
            }
        }

        for (let goblin of goblins) {
            goblin.update(delta); 
        }
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
    if (game_state === 'voting' || game_state === 'pre-voting') {
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
                        // otherwise you just receive the length
                        prompt_length = data.prompt_length;
                    }
                    timer = data.time;
                } else if (data.state === 'reveal') {
                    prompt = data.prompt;
                    current_artist = data.artistId;
                    timer = data.time;
                } else if (data.state === 'scoreboard') {
                    if (game_state !== 'scoreboard') { // just entered the scoreboard state, clear previous drawings
                        for (let goblin of goblins) {
                            goblin.lines = []; // Clear lines for all players
                        }
                    }
                    results = data.scores; // Array of { userId, score }
                    timer = data.time;
                }
                game_state = data.state;
            }

            break;
    }
}

export { you, goblins, chat, onopen, onmessage };