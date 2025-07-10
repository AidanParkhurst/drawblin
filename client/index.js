import p5 from "p5";

import Goblin from "./goblin.js";
import Line from "./line.js";
import Chat from "./chat.js";
import { ws, sendMessage } from "./network.js";

// -- Game State Initialization --
let you;
let goblins = [];

let chat;
let font_regular;

// drawing vars
let drawing = false;
let last_mouse = { x: 0, y: 0 };
let line_granularity = 10; // How many pixels between each line point

// networking
let heartbeat = 300; 
let heartbeat_timer = 0;

async function start() {
    you = new Goblin(width / 2, height / 2, 50, [random(255), random(255), random(255)], true);
    goblins.push(you);
    chat = new Chat(); 
    return;
}


// -- P5 Initialization --
window.setup = async() => {
    createCanvas(windowWidth, windowHeight);
    ellipseMode(CENTER);
    font_regular = await loadFont("assets/Neucha-Regular.ttf");
    textFont(font_regular);
    textSize(16);
    start();
}
window.windowResized = () => { resizeCanvas(windowWidth, windowHeight); }

window.draw = () => {
    background(240);
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
    if (heartbeat_timer >= heartbeat && ws.readyState === WebSocket.OPEN) {
        // Send the updated goblin state to the server
        sendMessage({
            type: "update",
            goblin: you
        });
        heartbeat_timer = 0;
    }
}

window.mousePressed = () => {
    drawing = true;
    last_mouse = createVector(you.cursor.x, you.cursor.y);
}

window.mouseReleased = () => {
    drawing = false;
    // add a dot line to the goblin's lines
    var l = new Line(createVector(you.cursor.x, you.cursor.y), createVector(you.cursor.x, you.cursor.y), you.color, 5);
    you.lines.push(l); // Store the line in the goblin's lines array
}

window.keyPressed = () => {
    chat.input.keyPressed(keyCode);
}

// -- Networking Setup --
ws.onopen = () => {
    console.log("WebSocket connection established");
    // TODO: maybe useful to send an introductory message, once the goblin is loaded
}
ws.onmessage = (event) => {
    const data = JSON.parse(event.data);
    // print(data);
    // Handle incoming messages from the server
    if (!data || !data.type || (!data.goblin && !data.content)) {
        console.error("Invalid data received:", data);
        return;
    }

    switch (data.type) {
        case "chat":
            // Handle chat messages
            if (data.userId) {
                chat.messages.push(`${data.userId}: ${data.content}`);
            } else {
                chat.messages.push(`Unknown: ${data.content}`);
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
    }
}