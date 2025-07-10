import Input from "./input_box.js";

class Chat {
    constructor(height = 200, width = 400) {
        this.messages = [];
        this.height = height;
        this.width = width;
        this.input = new Input(20, windowHeight - height + (height - 60), width, 40, this);
    }

    // every frame
    update() {
        this.display();
        this.input.update();
    }

    display() {
        push();

        // overall chat box
        drawingContext.setLineDash([40, 20]); // Set dashed line style
        stroke(0, 0, 0, 10);
        strokeWeight(5);
        fill(0, 0, 0, 0);
        rect(20, windowHeight - this.height - 20, this.width, this.height, 5);
        noStroke();
        fill(0, 0, 0, 150); // Semi-transparent black background
        textSize(24);

        // Message display bottom to top
        for (let i = 0; i < this.messages.length; i++) {
            let y = windowHeight - this.height + 10 + i * 20;
            text(this.messages[i], 30, y);
        }

        pop();
    }
}

export default Chat;