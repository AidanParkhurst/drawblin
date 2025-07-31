import { you, goblins } from './index.js';
import { assets } from './assets.js';
import { sendMessage } from './network.js'; 

class ProfileDisplay {
    constructor(width = 500, height = 400) {
        this.width = width;
        this.height = height;
        this.x = (windowWidth - width) / 2; // Center horizontally
        this.y = (windowHeight - height) / 2; // Center vertically
        this.visible = false;
        this.targetGoblin = null;
        
        // Color palette setup
        this.colorPalette = [
            [255, 100, 100], // Red
            [100, 255, 100], // Green
            [100, 100, 255], // Blue
            [255, 255, 100], // Yellow
            [255, 100, 255], // Magenta
            [100, 255, 255], // Cyan
            [255, 150, 50],  // Orange
            [150, 50, 255],  // Purple
            [255, 200, 200], // Pink
            [200, 255, 200], // Light Green
            [200, 200, 255], // Light Blue
            [255, 255, 200], // Light Yellow
            [150, 150, 150], // Gray
            [50, 50, 50],    // Dark Gray
            [255, 255, 255], // White
            [0, 0, 0]        // Black
        ];
        
        this.colorSize = 30;
        this.colorSpacing = 10;
        this.colorsPerRow = 4;
        this.colorStartX = this.width * 0.55; // Start colors on right side
        this.colorStartY = 120;
        
        this.hoveredColor = -1;
    }
    
    show(goblinId) {
        this.targetGoblin = goblins.find(g => g.id === goblinId) || you;
        this.visible = true;
        this.updatePosition(); // Update position in case window was resized
    }
    
    hide() {
        this.visible = false;
        this.targetGoblin = null;
    }
    
    updatePosition() {
        this.x = (windowWidth - this.width) / 2;
        this.y = (windowHeight - this.height) / 2;
    }
    
    update() {
        if (!this.visible || !this.targetGoblin) return;
        
        this.updatePosition();
        
        // Check for mouse interactions
        this.hoveredColor = -1;
        
        // Check color palette interactions
        for (let i = 0; i < this.colorPalette.length; i++) {
            const col = i % this.colorsPerRow;
            const row = Math.floor(i / this.colorsPerRow);
            const colorX = this.x + this.colorStartX + col * (this.colorSize + this.colorSpacing);
            const colorY = this.y + this.colorStartY + row * (this.colorSize + this.colorSpacing);
            
            if (mouseX >= colorX && mouseX <= colorX + this.colorSize &&
                mouseY >= colorY && mouseY <= colorY + this.colorSize) {
                this.hoveredColor = i;
                cursor('pointer');
                
                if (mouseIsPressed) {
                    this.selectColor(i);
                }
                break;
            }
        }
        
        // Check if clicking outside the profile display to close it
        if (mouseIsPressed && !this.isMouseInside()) {
            this.hide();
        }
        
        // Check if escape key is pressed to close the profile display
        if (keyIsPressed && key === 'Escape') {
            this.hide();
        }
        
        this.display();
    }
    
    isMouseInside() {
        return mouseX >= this.x && mouseX <= this.x + this.width &&
               mouseY >= this.y && mouseY <= this.y + this.height;
    }

    // Check if mouse is interacting with profile display
    isMouseInteracting() {
        return this.visible && this.isMouseInside();
    }
    
    selectColor(colorIndex) {
        if (colorIndex >= 0 && colorIndex < this.colorPalette.length) {
            const newColor = [...this.colorPalette[colorIndex]]; // Copy the color array
            
            // Update the goblin's color
            this.targetGoblin.color = newColor;
            
            // If this is the local player, also update their UI color
            if (this.targetGoblin === you) {
                you.ui_color = this.calculateUIColor(newColor, [240, 240, 240]);
            }
            
            sendMessage({ type: 'update', goblin: this.targetGoblin });
        }
    }
    
    // Copy of the calculateUIColor function from index.js for consistency
    calculateUIColor(goblinColor, backgroundColor) {
        const luminance1 = this.getLuminance(goblinColor);
        const luminance2 = this.getLuminance(backgroundColor);
        
        const contrast = (Math.max(luminance1, luminance2) + 0.05) / 
                        (Math.min(luminance1, luminance2) + 0.05);
        
        let darkenedColor = this.darkenColor(goblinColor, 0.6);
        
        // If contrast is still too low, darken further
        if (contrast < 3) {
            darkenedColor = this.darkenColor(darkenedColor, 0.8);
        }
        
        return darkenedColor;
    }
    
    getLuminance(color) {
        const [r, g, b] = color.map(c => {
            c = c / 255;
            return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
        });
        
        return 0.2126 * r + 0.7152 * g + 0.0722 * b;
    }
    
    darkenColor(color, factor = 0.6) {
        return color.map(c => Math.floor(c * factor));
    }
    
    display() {
        if (!this.visible || !this.targetGoblin) return;
        
        push();
        
        // Draw the main rectangle with dotted border (same style as chat and other UI)
        fill(240); 
        drawingContext.setLineDash([40, 20]); // Set dashed line style
        stroke(you.ui_color[0], you.ui_color[1], you.ui_color[2], 100);
        strokeWeight(5);
        rect(this.x, this.y, this.width, this.height, 15); // 15px rounded corners
        
        // Reset line dash for other elements
        drawingContext.setLineDash([]);
        noStroke();
        
        // Draw goblin sprite on the left side
        const spriteX = this.x + 100;
        const spriteY = this.y + this.height / 2;
        const spriteSize = 120;
        
        if (assets.sprites && assets.sprites[this.targetGoblin.shape]) {
            const sprite = assets.sprites[this.targetGoblin.shape];
            
            push();
            // Apply goblin's color tint
            tint(this.targetGoblin.color[0], this.targetGoblin.color[1], this.targetGoblin.color[2]);
            imageMode(CENTER);
            
            // Draw the goblin sprite
            image(sprite, spriteX, spriteY, spriteSize, spriteSize * sprite.height / sprite.width);
            
            // Calculate scale factor based on sprite size ratio
            // In goblin.js, hands are sized relative to goblin.size (typically 40-50px)
            // Here spriteSize is 120px, so scale factor is approximately 120/45 = 2.67
            const scaleFactor = spriteSize / 45; // Using 45 as average goblin size
            const handSize = 10 * scaleFactor; // Scale hand size proportionally
            const brushWidth = 25 * scaleFactor;
            const brushHeight = 15 * scaleFactor;
            
            // Draw hands like in goblin.js
            // Empty hand (static, behind the goblin) - scaled positioning
            let empty_hand_x = spriteX - (30 * scaleFactor); // Position relative to sprite size
            image(assets.sprites["empty_hand"], empty_hand_x, spriteY + (10 * scaleFactor), handSize, handSize);
            
            // Brush hand (positioned towards the right, simulating cursor direction)
            let brush_hand_x = spriteX + (25 * scaleFactor); // Position relative to sprite size
            let brush_hand_y = spriteY;
            
            // Draw brush hand and brush (static position for profile display)
            image(assets.sprites["brush_hand"], brush_hand_x, brush_hand_y, handSize, handSize);
            
            // Draw brush tool based on current tool
            if (this.targetGoblin.tool === 'brush') {
                image(assets.sprites["brush"], brush_hand_x + (15 * scaleFactor), brush_hand_y - (8 * scaleFactor), brushWidth, brushHeight);
            } else if (this.targetGoblin.tool === 'eraser') {
                image(assets.sprites["empty_hand"], brush_hand_x + (10 * scaleFactor), brush_hand_y, handSize, handSize);
            }
            
            noTint();
            pop();
        } else {
            // Fallback: draw a colored circle if sprite not available
            fill(this.targetGoblin.color[0], this.targetGoblin.color[1], this.targetGoblin.color[2]);
            ellipse(spriteX, spriteY, spriteSize, spriteSize);
        }
        
        // Draw color palette title
        fill(you.ui_color[0], you.ui_color[1], you.ui_color[2]);
        textAlign(LEFT, TOP);
        textSize(20);
        text("Choose Color:", this.x + this.colorStartX, this.y + 60);
        
        // Draw color palette
        for (let i = 0; i < this.colorPalette.length; i++) {
            const col = i % this.colorsPerRow;
            const row = Math.floor(i / this.colorsPerRow);
            const colorX = this.x + this.colorStartX + col * (this.colorSize + this.colorSpacing);
            const colorY = this.y + this.colorStartY + row * (this.colorSize + this.colorSpacing);
            
            const color = this.colorPalette[i];
            fill(color[0], color[1], color[2]);
            
            // Add hover effect
            if (i === this.hoveredColor) {
                stroke(255, 255, 255);
                strokeWeight(3);
            } else {
                noStroke();
            }
            
            // Highlight current color
            if (this.targetGoblin.color[0] === color[0] && 
                this.targetGoblin.color[1] === color[1] && 
                this.targetGoblin.color[2] === color[2]) {
                stroke(255, 255, 0); // Yellow border for current color
                strokeWeight(4);
            }
            
            ellipse(colorX + this.colorSize/2, colorY + this.colorSize/2, this.colorSize, this.colorSize);
        }
        
        // Draw player name/ID
        fill(you.ui_color[0], you.ui_color[1], you.ui_color[2]);
        text(`Player ${this.targetGoblin.id}`, this.x + 20, this.y + 60);
        
        // Draw close instruction
        textAlign(CENTER, BOTTOM);
        textSize(16);
        fill(you.ui_color[0], you.ui_color[1], you.ui_color[2], 200);
        text("Press Escape or click outside to close", this.x + this.width/2, this.y + this.height - 10);
        
        pop();
    }
}

export default ProfileDisplay;
