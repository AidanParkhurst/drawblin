import { sendMessage } from "./network.js";
import { you } from "./index.js";

class Input {
    constructor(x, y, width, height, chat = null) {
        this.x = x; // X position of the input box
        this.y = y; // Y position of the input box
        this.width = width; // Width of the input box
        this.height = height; // Height of the input box
        this.placeholder = "Press Enter or Click Here"; // Placeholder text
        this.text = this.placeholder; // Text inside the input box
        this.active = false; // Whether the input box is active (focused)
        this.hover = false; // Whether the mouse is hovering over the input box   
        this.chat = chat; // Reference to the chat object, if any
    }

    update() {
        if (this.contains(mouseX, mouseY)) {
            this.hover = true; // Set hover state if mouse is over the input box
            if (mouseIsPressed && !this.active) {
                this.active = true; // Activate the input box on mouse press
                this.text = ""; // Clear text when activated
                if (you) {
                    you.frozen = true; // Freeze the goblin when input is active
                }
            }
            cursor('text'); // Change cursor to text input style
        } else {
            this.hover = false; // Reset hover state if mouse is not over the input box
            // Don't reset cursor here - let other UI elements handle it
            if (mouseIsPressed && this.active) {
                this.active = false; // Deactivate the input box on mouse press outside
                if (you) {
                    you.frozen = false; // Unfreeze the goblin when input is deactivated
                }
            }
        }
        this.display();
    }

    // Draw the input box and its text
    display() {
        push();
        fill(0,0)
        drawingContext.setLineDash([40, 20]); // Set dashed line style
        strokeWeight(5);
        stroke(you.ui_color[0], you.ui_color[1], you.ui_color[2], 10); // Use goblin's color with transparency
        if (this.hover) {
            stroke(you.ui_color[0], you.ui_color[1], you.ui_color[2], 20); // Darker stroke when hovered
        }
        if (this.active) {
            stroke(you.ui_color[0], you.ui_color[1], you.ui_color[2], 40); // Brighter stroke when active
        }
        rect(this.x, this.y, this.width, this.height, 5);
        noStroke();
        textSize(24);
        if (this.active || this.hover) {
            fill(you.ui_color[0], you.ui_color[1], you.ui_color[2], 150);
        } else {
            fill(you.ui_color[0], you.ui_color[1], you.ui_color[2], 50);
        }
        text(this.text, this.x + 10, this.y + this.height / 2 + 5);

        pop();
    }

    // Check if the input box contains a point (mouse position)
    contains(mx, my) {
        return mx >= this.x && mx <= this.x + this.width && my >= this.y && my <= this.y + this.height;
    }

    // Handle key presses
    keyPressed(keyCode) {
        if (!this.active) {
            if (keyCode === 13) { // If Enter is pressed, activate the input box
                this.active = true; // Activate the input box
                this.text = ""; // Clear the text
                if (you) {
                    you.frozen = true; // Freeze the goblin when input is active
                }
            }
            return; // Exit if the input box is not active
        } 
        if (keyCode === 8 || keyCode === 46) { // Backspace or Delete
            this.text = this.text.slice(0, -1); // Remove the last character
        } else if (keyCode === 13) { // Enter key pressed
            // Send the message to the server or handle it as needed
            if (this.text.trim() !== "" && this.text !== this.placeholder) {
                sendMessage({type: "chat", content: this.text}); // Send the message to the server
                if (this.chat) {
                    this.chat.messages.push({user: you, content: this.text}); // Add the message to the chat display
                }
                if (you) {
                    you.say(this.text); // Goblin says the message
                    you.frozen = false; // Unfreeze the goblin after sending the message
                }
            }
            this.text = this.placeholder; // Clear the input after sending
            this.active = false; // Deactivate the input box
        } else if (key == ESCAPE) { // If escape pressed, deactivate the input box
            this.active = false;
            if (you) {
                you.frozen = false; // Unfreeze the goblin when input is deactivated
            }
        } else if (key.length === 1 && key !== '\n' && key !== '\r' && key !== '\t') {
            // Use 'key' instead of keyCode for proper character handling
            // Only add printable characters (single character, not special keys)
            this.text += key;
        }
    }


}

export default Input;