import { you } from './index.js';
import { connect } from './network.js';

class Portal {
    constructor(x, y, radius, color, text="", teleportFunction = null, options = {}) {
        this.x = x; // X position of the portal
        this.y = y; // Y position of the portal
        this.radius = radius; // Radius of the portal
        this.color = color; // Color of the portal
        this.text = text; // Text to display inside the portal
        this.touch_timer = 0; // Timer to track how long the goblin has been touching the portal
        this.touch_duration = 2000; // Duration in milliseconds to trigger portal action
        this.teleport_function = teleportFunction; // Function to call when the portal is activated
        this.time_since_first_update = 0;
        // Behavior flags
        this.oneshot = !!options.oneshot; // if true, deactivate after first trigger
        this.active = true; // when false, collision and rendering stop
    }

    update(delta) {
        if (!this.active) return; // Do nothing if deactivated
        this.time_since_first_update += delta; // Increment time since last update
        this.checkCollision(delta); // Check if the goblin is touching the portal
        this.display(); // Draw the portal

    }

    checkCollision(delta) {
        if (!this.active) return;
        // Check if the goblin is touching the portal
        if (you && dist(you.x, you.y, this.x, this.y) < this.radius) {
            this.touch_timer += delta; // Increment touch timer
            if (this.touch_timer >= this.touch_duration) {
                if (this.teleport_function) {
                    const fn = this.teleport_function; // local copy in case we null it
                    // If oneshot, immediately deactivate and prevent further triggers
                    if (this.oneshot) {
                        this.active = false;
                        this.teleport_function = null;
                    }
                    fn(); // Call the teleport function if defined and duration met
                }
                this.touch_timer = 0; // Reset timer after action
            }
        } else {
            this.touch_timer = 0; // Reset timer if not touching
        }
    }

    display() {
        if (!this.active) return;
        // Spinnning dotted line circle
        push();
        translate(this.x, this.y);

        var transparency;
        if (this.time_since_first_update < 1000) { // Fade in effect
            transparency = map(this.time_since_first_update, 0, 1000, 0, 50);
        } else {
            transparency = map(this.touch_timer, 0, this.touch_duration, 50, 255);
        }
        fill(this.color[0], this.color[1], this.color[2], transparency);
        stroke(this.color[0], this.color[1], this.color[2], transparency);

        textSize(18);
        textAlign(CENTER, CENTER);
        text(this.text, 0, 0); // Display portal text at the center

        rotate(frameCount * 0.001); // Rotate the circle for a dynamic effect
        strokeWeight(5);
        noFill();
        drawingContext.setLineDash([20, 20]); // Set dashed line style
        // shrink the radius a little as the touch timer increases
        let diameter = this.radius * 2 - map(this.touch_timer, 0, this.touch_duration, 0, 40);
        ellipse(0, 0, diameter, diameter); // Draw the portal circle
        pop();
    }
}

export default Portal;