import p5 from "p5";

import Goblin from "./goblin.js";
import Portal from "./portal.js";
import Line from "./line.js";
import Chat from "./chat.js";
import { ws, connect, sendMessage } from "./network.js";

// -- Game State Initialization --
let you;
let goblins = [];

let chat;

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

async function start() {
    you = new Goblin(width / 2, height / 2, 50, [random(255), random(255), random(255)], true);
    goblins.push(you);
    chat = new Chat(); 
    let freedraw_portal = new Portal(width / 2, height / 2 - 200, 150, you.color, "Stand here to join\nFree Draw", () => {
        connect('freedraw'); // Connect to the freedraw game type
        joined = true;
    });
    let quickdraw_portal = new Portal(width / 2 + 400, height / 2 - 200, 150, you.color, "Stand here to join\nQuick Draw", () => {
        connect('quickdraw'); // Connect to the quickdraw game type
        joined = true;
    });
    let guessinggame_portal = new Portal(width / 2 - 400, height / 2 - 200, 150, you.color, "Coming soon...\nGuessing Game", () => {
        // connect('guessinggame'); // Connect to the guessing game type
        // joined = true;
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

    for (let goblin of goblins) {
        goblin.update(deltaTime);
    }

    chat.update();


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

function drawTitle() {
    push();
    translate(0, -100);
    textAlign(CENTER);
    fill(you.color[0], you.color[1], you.color[2]);
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
    }
}

export { you, goblins, chat, onopen, onmessage };