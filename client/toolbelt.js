import { you } from './index.js';
import { assets } from './assets.js';

class Toolbelt {
    constructor() {
        // Order matters for number hotkeys: 1=brush, 2=spray, 3=eraser
        this.tools = ['brush', 'spray', 'eraser']; // Available tools
        this.toolSize = 60; // Size of each tool square
        this.spacing = 10; // Spacing between tools
        this.margin = 20; // Margin from screen edge
        this.hoveredTool = -1; // Index of currently hovered tool
        
        // Position at bottom right
        this.updatePosition();
    }
    
    updatePosition() {
        // Calculate position based on window size
        const totalWidth = (this.tools.length * this.toolSize) + ((this.tools.length - 1) * this.spacing);
        this.x = windowWidth - totalWidth - this.margin;
        this.y = windowHeight - this.toolSize - this.margin;
    }
    
    update() {
        this.updatePosition(); // Update position in case window resized
        
        // Check for mouse interactions
        this.hoveredTool = -1;
        let cursorSet = false;
        
        for (let i = 0; i < this.tools.length; i++) {
            const toolX = this.x + (i * (this.toolSize + this.spacing));
            const toolY = this.y;
            
            // Check if mouse is hovering over this tool
            if (mouseX >= toolX && mouseX <= toolX + this.toolSize &&
                mouseY >= toolY && mouseY <= toolY + this.toolSize) {
                this.hoveredTool = i;
                cursor('pointer');
                cursorSet = true;
                
                // Handle tool selection on click
                if (mouseIsPressed) {
                    you.tool = this.tools[i];
                }
                break;
            }
        }
        
        this.display();
    }
    
    display() {
        push();
        
        for (let i = 0; i < this.tools.length; i++) {
            const tool = this.tools[i];
            const toolX = this.x + (i * (this.toolSize + this.spacing));
            const toolY = this.y;
            
            // Draw tool background with dotted border (same style as other UI)
            fill(240); // Light gray background
            drawingContext.setLineDash([20, 10]); // Dashed line style (smaller than other UI)
            stroke(you.ui_color[0], you.ui_color[1], you.ui_color[2], 100);
            strokeWeight(3);
            
            // Highlight current tool or hovered tool
            if (you.tool === tool) {
                stroke(you.ui_color[0], you.ui_color[1], you.ui_color[2], 200); // Stronger border for current tool
                strokeWeight(4);
            } else if (i === this.hoveredTool) {
                stroke(you.ui_color[0], you.ui_color[1], you.ui_color[2], 150); // Medium border for hovered tool
                strokeWeight(3);
            }
            
            rect(toolX, toolY, this.toolSize, this.toolSize, 8); // 8px rounded corners
            
            // Reset line dash for tool icons
            drawingContext.setLineDash([]);
            noStroke();
            
            // Draw tool icon
            this.drawToolIcon(tool, toolX + this.toolSize/2, toolY + this.toolSize/2);
        }
        
        pop();
    }
    
    drawToolIcon(tool, centerX, centerY) {
        push();
        
        switch (tool) {
            case 'brush':
                // Draw brush icon
                if (assets.sprites && assets.sprites.brush) {
                    // Use the brush asset if available
                    imageMode(CENTER);
                    const iconSize = this.toolSize * 0.6; // 60% of tool size
                    tint(you.color[0], you.color[1], you.color[2]); // Apply goblin's color tint
                    image(assets.sprites.brush, centerX, centerY, iconSize, iconSize);
                } else {
                    // Fallback: draw a simple brush icon
                    fill(you.ui_color[0], you.ui_color[1], you.ui_color[2]);
                    
                    // Draw brush handle
                    rectMode(CENTER);
                    rect(centerX, centerY + 8, 6, 20, 3);
                    
                    // Draw brush tip
                    ellipse(centerX, centerY - 8, 12, 8);
                }
                break;
            
            case 'spray':
                // Draw spray icon (prefer sprite if present; fallback to dotted spray)
                if (assets.sprites && (assets.sprites.spray || assets.sprites.brush)) {
                    imageMode(CENTER);
                    tint(you.color[0], you.color[1], you.color[2]); // Apply goblin's color tint
                    // Use dedicated spray sprite if available, otherwise reuse brush sprite as placeholder
                    const sprite = assets.sprites.spray || assets.sprites.brush;
                    // Preserve aspect ratio; prefer intrinsic sprite dims, fallback to known 42x61
                    const sw = (sprite && sprite.width) ? sprite.width : 42;
                    const sh = (sprite && sprite.height) ? sprite.height : 61;
                    const ratio = sw / sh; // < 1 means taller than wide
                    const iconH = this.toolSize * 0.7; // make it taller visually within slot
                    const iconW = iconH * ratio;
                    image(sprite, centerX, centerY, iconW, iconH);
                } else {
                    // Fallback: simple spray pattern of dots
                    noStroke();
                    fill(you.ui_color[0], you.ui_color[1], you.ui_color[2]);
                    const r = this.toolSize * 0.18;
                    for (let i = 0; i < 12; i++) {
                        const a = (i / 12) * TWO_PI;
                        const rr = r + (i % 3) * 3;
                        ellipse(centerX + cos(a) * rr, centerY + sin(a) * rr, 4, 4);
                    }
                }
                break;
                
            case 'eraser':
                // Draw eraser icon using eraser sprite if present
                if (assets.sprites && assets.sprites.eraser) {
                    imageMode(CENTER);
                    const iconSize = this.toolSize * 0.6; // 60% of tool size
                    tint(you.color[0], you.color[1], you.color[2]); // Apply goblin's color tint
                    image(assets.sprites.eraser, centerX, centerY, iconSize, iconSize);
                } else {
                    // Fallback: draw a simple eraser icon
                    fill(255, 200, 200); // Light pink color for eraser
                    rectMode(CENTER);
                    rect(centerX, centerY, this.toolSize * 0.5, this.toolSize * 0.3, 3);
                    fill(100);
                    textAlign(CENTER, CENTER);
                    textSize(8);
                    text("E", centerX, centerY);
                }
                break;
                
            default:
                // Default icon - just a colored circle
                fill(you.ui_color[0], you.ui_color[1], you.ui_color[2]);
                ellipse(centerX, centerY, this.toolSize * 0.4);
                break;
        }
        
        pop();
    }
    
    // Check if mouse is interacting with toolbelt
    isMouseInteracting() {
        const totalWidth = (this.tools.length * this.toolSize) + ((this.tools.length - 1) * this.spacing);
        return mouseX >= this.x && mouseX <= this.x + totalWidth &&
               mouseY >= this.y && mouseY <= this.y + this.toolSize;
    }
}

export default Toolbelt;
