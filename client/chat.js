import Input from "./input_box.js";
import { you, goblins } from "./index.js"; // Import the goblin object
import {assets} from "./assets.js"; // Import assets for the chat

class Chat {
    constructor(height = 200, width = 400) {
        this.messages = [];
        this.height = height;
        this.width = width;
        this.max_messages = 7; // Maximum number of messages to display
        this.input = new Input(20, windowHeight - height + (height - 60), width, 40, this);
    }

    // every frame
    update() {
        this.display();
        this.input.update();
        if (this.messages.length > this.max_messages) {
            this.messages.splice(0, this.messages.length - this.max_messages);
        }
    }

    display() {
        push();

        // overall chat box
        drawingContext.setLineDash([40, 20]); // Set dashed line style
        stroke(you.ui_color[0], you.ui_color[1], you.ui_color[2], 10);
        strokeWeight(5);
        fill(0, 0, 0, 0);
        rect(20, windowHeight - this.height - 20, this.width, this.height, 5);
        noStroke();
        textSize(24);

        // Message display bottom to top
        for (let i = 0; i < this.messages.length; i++) {
            var chatter_color = this.messages[i].user ? this.messages[i].user.ui_color : [0, 0, 0];
            fill(chatter_color[0], chatter_color[1], chatter_color[2], 150); // Semi-transparent background
            let y = windowHeight - this.height + 10 + i * 20;
            text(this.messages[i].content, 30, y);
        }

        pop();
    }

    moveInput(windowWidth, windowHeight) {
        // Move the input box to the bottom of the chat box
        this.input.x = 20;
        this.input.y = windowHeight - this.height + (this.height - 60);
        this.input.width = this.width;
    }

    // Check if mouse is interacting with chat UI elements
    isMouseInteracting() {
        return this.input.contains(mouseX, mouseY);
    }
}

export default Chat;