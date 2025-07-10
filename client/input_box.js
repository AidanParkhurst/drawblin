import { sendMessage } from "./network.js";

class Input {
    constructor(x, y, width, height, chat = null) {
        this.x = x; // X position of the input box
        this.y = y; // Y position of the input box
        this.width = width; // Width of the input box
        this.height = height; // Height of the input box
        this.placeholder = "Write a message here..."; // Placeholder text
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
            }
            cursor('text'); // Change cursor to text input style
        } else {
            this.hover = false; // Reset hover state if mouse is not over the input box
            cursor(ARROW);
        }
        this.display();
    }

    // Draw the input box and its text
    display() {
        push();
        fill(0,0)
        drawingContext.setLineDash([40, 20]); // Set dashed line style
        strokeWeight(5);
        stroke(0,10);
        if (this.hover) {
            stroke(0, 50); // Darker stroke when hovered
        }
        if (this.active) {
            stroke(0, 100); // Brighter stroke when active
        }
        rect(this.x, this.y, this.width, this.height, 5);
        noStroke();
        textSize(24);
        if (this.acctive || this.hover) {
            fill(0, 0, 0, 150);
        } else {
            fill(0, 50)
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
        if (!this.active) return; // Only handle key presses if the input box is active
        if (keyCode === 8 || keyCode === 46) {
            this.text = this.text.slice(0, -1); // Remove the last character
        } else if (keyCode === 13) { // Enter key pressed
            // Send the message to the server or handle it as needed
            if (this.text.trim() !== "" && this.text !== this.placeholder) {
                sendMessage({type: "chat", content: this.text}); // Send the message to the server
                if (this.chat) {
                    this.chat.messages.push(`You: ${this.text}`); // Add the message to the chat display
                }
            }
            this.text = this.placeholder; // Clear the input after sending
            this.active = false; // Deactivate the input box
        } else if (keyCode >= 32 && keyCode <= 126) { // Check for printable characters
            this.text += String.fromCharCode(keyCode); // Append the character to the text
        }
    }


}

export default Input;