import { you, goblins } from './index.js';
import { assets } from './assets.js'; // Import assets for the player list
import ProfileDisplay from './profile_display.js';

class PlayerList {
    constructor(circleSize = 50, spacing = 20) {
        this.circleSize = circleSize; // Size of each circle representing a player
        this.spacing = spacing; // Spacing between circles
        this.profileDisplay = new ProfileDisplay(); // Create profile display instance
    }

    update() {
        // Update profile display first (it handles its own visibility)
        this.profileDisplay.update();
        
        // Only handle goblin hover/click if profile display is not visible
        if (!this.profileDisplay.visible) {
            var hovered_goblin = this.checkHover(mouseX, mouseY);
            if (hovered_goblin) {
                cursor('pointer'); // Change cursor to pointer when hovering over a goblin
                if (mouseIsPressed) {
                    // Open profile display for the clicked goblin
                    this.profileDisplay.show(hovered_goblin.id);
                }
            }
            // Don't reset cursor here - let other UI elements handle it
        }
        this.display(); // Draw the player list
    }

    display() {
        push();

        const totalWidth = (goblins.length * this.circleSize) + ((goblins.length - 1) * this.spacing);
        const startX = (windowWidth - totalWidth) / 2; // Center horizontally
        const y = windowHeight - 20 - (this.circleSize / 2); // 20px up from bottom

        noStroke();
        for (let i = 0; i < goblins.length; i++) {
            const goblin = goblins[i];
            const x = startX + (i * (this.circleSize + this.spacing));

            push();
            
            // Draw circle with chatter's color
            fill(goblin.color[0], goblin.color[1], goblin.color[2]);
            translate(x, y);
            ellipse(0, 0, this.circleSize * 1.2, this.circleSize * 1.2);
            imageMode(CENTER);
            var sprite = assets.sprites[goblin.shape];
            image(sprite, 0, this.circleSize * sprite.height/sprite.width/3, this.circleSize, this.circleSize * sprite.height / sprite.width); // Draw goblin image

            pop(); 
        }
        
        pop();
    }

    // Check if the mouse is hovering over any goblin's circle
    checkHover(mx, my) {
        var circleSize = this.circleSize * 1.2;
        const totalWidth = (goblins.length * circleSize) + ((goblins.length - 1) * this.spacing);
        const startX = (windowWidth - totalWidth) / 2; // Center horizontally
        const y = windowHeight - 20 - (circleSize / 2); // 20px up from bottom

        for (let i = 0; i < goblins.length; i++) {
            const x = startX + (i * (circleSize + this.spacing));
            if (dist(mx, my, x, y) < circleSize / 2) {
                return goblins[i]; // Return the hovered goblin
            }
        }
        return null; // No goblin hovered
    }

    // Check if mouse is interacting with player list UI elements
    isMouseInteracting() {
        // Check if mouse is hovering over any goblin or if profile display is open
        return this.checkHover(mouseX, mouseY) !== null || this.profileDisplay.isMouseInteracting();
    }

}

export default PlayerList;