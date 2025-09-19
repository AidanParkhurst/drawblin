import { you, goblins } from './index.js';
import { assets } from './assets.js'; // Import assets for the player list
import ProfileDisplay from './profile_display.js';
import { spawnBurst } from './burst.js';

class PlayerList {
    constructor(circleSize = 50, spacing = 20) {
        this.circleSize = circleSize; // Size of each circle representing a player
        this.spacing = spacing; // Spacing between circles
        this.profileDisplay = new ProfileDisplay(); // Create profile display instance
    this.pointBursts = []; // { userId, points, age, duration }
    }

    update() {
        // Update profile display first (it handles its own visibility)
        this.profileDisplay.update();
        this.updatePointBursts();
        
        // Only handle goblin hover/click if profile display is not visible
        if (!this.profileDisplay.visible) {
            var hovered_goblin = this.checkHover(mouseX, mouseY);
            if (hovered_goblin && hovered_goblin.id === you.id) {
                cursor('pointer'); // Change cursor to pointer when hovering over a goblin
                if (mouseIsPressed) {
                    // Calculate the position of the clicked goblin's icon
                    const goblinIndex = goblins.indexOf(hovered_goblin);
                    const totalWidth = (goblins.length * this.circleSize) + ((goblins.length - 1) * this.spacing);
                    const startX = (windowWidth - totalWidth) / 2;
                    const playerIconX = startX + (goblinIndex * (this.circleSize + this.spacing));
                    const playerIconY = windowHeight - 20 - (this.circleSize / 2);
                    
                    // Open profile display for the clicked goblin at the icon position
                    this.profileDisplay.show(hovered_goblin.id, playerIconX, playerIconY);
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

        // Draw point bursts after circles so they overlay
        for (const b of this.pointBursts) {
            const g = goblins.find(g=> g.id === b.userId);
            if (!g) continue;
            // Recompute circle x for this goblin
            const idx = goblins.indexOf(g);
            if (idx === -1) continue;
            const x = startX + (idx * (this.circleSize + this.spacing));
            const baseY = y - this.circleSize * 0.9; // above circle
            const progress = b.age / b.duration;
            const floatY = baseY - progress * 40; // drift up 40px
            const alpha = 255 * (1 - progress);
            push();
            translate(x, floatY);
            textAlign(CENTER, BOTTOM);
            textSize(20);
            fill(g.ui_color[0], g.ui_color[1], g.ui_color[2], alpha);
            text(`+${b.points}`, 0, 0);
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

    // Trigger a floating +points indicator
    addPointBurst(userId, points) {
        if (points === 0) return;
        this.pointBursts.push({ userId, points, age: 0, duration: 1200 }); // duration ms

        // Also spawn a quick particle burst where the number appears
        try {
            // Compute the same position as in display(): find index and coordinates
            const circleSize = this.circleSize; // base size used there
            const totalWidth = (goblins.length * circleSize) + ((goblins.length - 1) * this.spacing);
            const startX = (windowWidth - totalWidth) / 2; // Center horizontally
            const y = windowHeight - 20 - (circleSize / 2); // circle center Y
            const idx = goblins.findIndex(g=> g.id === userId);
            if (idx !== -1) {
                const x = startX + (idx * (circleSize + this.spacing));
                const baseY = y - circleSize * 0.9; // matches display()
                spawnBurst(x, baseY, goblins[idx].ui_color || goblins[idx].color || [0,0,0], { count: 8 });
            }
        } catch {}
    }

    updatePointBursts() {
        const dt = deltaTime || 16; // ms
        for (const b of this.pointBursts) b.age += dt;
        this.pointBursts = this.pointBursts.filter(b => b.age < b.duration);
    }

    // Check if mouse is interacting with player list UI elements
    isMouseInteracting() {
        // Check if mouse is hovering over any goblin or if profile display is open
        return this.checkHover(mouseX, mouseY) !== null || this.profileDisplay.isMouseInteracting();
    }

}

export default PlayerList;