import Line from './line.js';
import {assets} from './assets.js'; // Import assets for goblin sprites

class Goblin {

    constructor(x, y, color, local = false, id = -1, shape = 'manny', name = '') {
        this.local = local; // Indicates if this goblin is controlled by the local player
        this.id = id == -1 ? random(1000000) : id; // Unique ID for the goblin, can be used for networking
        this.x = x;
        this.y = y;
        this.color = color;
        this.ui_color = color;
        this.flip = false;
        this.name = name || '';

        this.cursor = createVector(x, y); // Create a cursor for the goblin
        this.cursor_range = 200; // Range within which the cursor can move
        this.cursor_vector = createVector(0, 0); // Vector to track cursor position relative to the goblin
        this.lines = []; // Array to store lines drawn by the goblin
        this.simplify_timer = 0; // Timer for simplifying lines
        this.simplify_interval = 1000; // Interval for simplifying lines in milliseconds
        this.last_simplify_count = 0; // Last count of lines after simplification
        
        this.max_speed = 8; // Maximum speed of the player
        this.speed = 2; // Acceleration
        this.velocity = createVector(0, 0); // Current velocity of the player
        this.friction = 0.9; // Friction to slow down the player
        this.keyStates = {}; // Object to track key states for movement
        this.input = createVector(0, 0); // Input vector for movement
        this.frozen = false;

        // Tool system
        this.tool = 'brush'; // Current tool being used

        this.speech = ""; // Speech text for the goblin
        this.speech_timer = 0; // Timer for speech display
        this.speech_duration = 3000; // Duration to display speech in milliseconds
        
        // Animation properties
        this.shape = shape;
        this.size;
        this.setSize();
        this.walk_cycle = 0; // Walking animation cycle counter
        this.walk_speed = 0.3; // Speed of the walking animation
        this.bounce_height = 3; // How high the goblin bounces
        this.tilt_angle = 5; // Maximum tilt angle in degrees
        this.hasCrown = false; // crown display flag
    }

    setSize() {
        switch (this.shape) {
            case 'hippo':
                this.size = 35;
                break;
            // These 4 are kinda big, so they have a smaller size
            case 'blimp':
            case 'stanley':
            case 'grubby':
                this.size = 40;
                break;
            // Ricky we specifically want to be smaller, even though he is normal
            case 'ricky':
                this.size = 45;
                break;
            // By default, 50
            case 'manny':
            default:
                this.size = 50; // Default size
        }
    }

    // Helper function to compare colors (handles both arrays and primitives)
    colorsEqual(color1, color2) {
        if (Array.isArray(color1) && Array.isArray(color2)) {
            return color1.length === color2.length && color1.every((val, i) => val === color2[i]);
        }
        return color1 === color2;
    }

    // Called every frame
    update(delta, draw_lines = true, draw_name = false) {
        if (this.simplify_timer >= this.simplify_interval && this.lines.length !== this.last_simplify_count) {
            this.simplify_timer = 0; 
            this.lines = this.simplifyLines(this.lines, 5, 0.5);
            this.last_simplify_count = this.lines.length;
        }
        if (draw_lines) {
            this.display_lines(this.lines);
        }

        this.simplify_timer += delta;
        if(this.local) {
            this.check_input();
            this.move();
        }
        
        // Update walking animation cycle when moving
        if (this.velocity.mag() > 1) { // Only animate when actually moving
            this.walk_cycle += this.walk_speed;
        } else {
            this.walk_cycle = 0; // Reset cycle when not moving
        }

        this.display(draw_name);

        // TODO: Point the goblin's pen at the cursor instead
        if (this.local){
            this.cursor.x = lerp(this.cursor.x, mouseX, 0.3);
            this.cursor.y = lerp(this.cursor.y, mouseY, 0.3);
        }
        // Limit the cursor's distance from the goblin
        this.cursor_vector = createVector(this.cursor.x - this.x, this.cursor.y - this.y);
        if (this.cursor_vector.mag() > this.cursor_range) {
            this.cursor_vector.setMag(this.cursor_range);
            this.cursor.x = this.x + this.cursor_vector.x;
            this.cursor.y = this.y + this.cursor_vector.y;
        }

        this.display_range(); 
        this.display_cursor();

        if (this.speech !== "") {
            this.display_speech();
            this.speech_timer += delta; // Increment speech timer
            if (this.speech_timer >= this.speech_duration) {
                this.speech = ""; // Clear speech after duration
                this.speech_timer = 0; // Reset timer
            }
        }
    }
    
    display(draw_name) {
        if (this.cursor.x > this.x) {
            this.flip = false; // Facing right
        } else if (this.cursor.x < this.x) {
            this.flip = true; // Facing left
        }

        // Calculate animation offsets
        let bounceOffset = 0;
        let tiltOffset = 0;
        
        if (this.velocity.mag() > 0.1) { // Only animate when moving
            // Bounce up and down using sine wave
            bounceOffset = sin(this.walk_cycle * 2) * this.bounce_height;
            
            // Tilt left and right using sine wave (offset phase for natural look)
            tiltOffset = sin(this.walk_cycle * 2 + PI/4) * this.tilt_angle * (this.velocity.mag() / this.max_speed);
        }

        push();
        imageMode(CENTER);
        tint(this.color[0], this.color[1], this.color[2]);
        noStroke();

        translate(this.x, this.y);
        // Empty hand just static next to goblin's back
        let empty_hand_x = this.flip ? 30 : -30;
        image(assets.sprites["empty_hand"], empty_hand_x, 10, 10, 10);
        let brush_vector = createVector(this.cursor.x - this.x, this.cursor.y - this.y);
        brush_vector.setMag(25); // Limit to max distance of 30 pixels
        push();
        translate(brush_vector.x, brush_vector.y);
        rotate(atan2(brush_vector.y, brush_vector.x)); // Rotate towards cursor
        image(assets.sprites["brush_hand"], 0, 0, 10, 10);
        if (this.tool === 'brush') {
            image(assets.sprites["brush"], 17, -8, 25, 15);
        } else if (this.tool === 'eraser') {
            image(assets.sprites["eraser"], 15, -8, 25, 15);
        }


        pop();

        let height = this.size * (assets.sprites[this.shape].height / assets.sprites[this.shape].width);

        // Draw name (adjust vertical offset if crown showing)
        if (draw_name && this.name) {
            push();
            noStroke();
            fill(this.ui_color[0], this.ui_color[1], this.ui_color[2], 200);
            textAlign(CENTER, BOTTOM);
            textSize(14);
            const nameOffset = this.hasCrown ? -60 : -50;
            text(this.name, 0, nameOffset);
            pop();
        }

        translate(0, bounceOffset); // Apply bounce offset
        
        // Apply tilt rotation
        rotate(radians(tiltOffset));

        if (this.flip) {
            scale(-1, 1); // Flip horizontally
        }
        image(assets.sprites[this.shape], 0, 0, this.size, height);
        if (this.hasCrown) this.display_crown();

        // OG: just a circle
        // fill(this.color);
        // noStroke();
        // ellipse(this.x, this.y, this.size);

        pop();
    }

    display_speech() {
        push();
        textSize(16);
        // Create smooth fade-in to midpoint, then fade-out
        var progress = this.speech_timer / this.speech_duration;
        var opacity = 255 * sin(progress * PI);
        var offsetX = 20 + progress * 10;
        var offsetY = 10 + progress * 10;
        fill(this.ui_color[0], this.ui_color[1], this.ui_color[2], opacity);
        text(this.speech, this.x + offsetX, this.y - offsetY);
        pop();
    }

    // Render a crown above the goblin (used for top scorer in waiting scoreboard)
    display_crown() {
        if (!assets?.sprites?.crown) return;
        let height = this.size * (assets.sprites[this.shape].height / assets.sprites[this.shape].width);
        push();
        imageMode(CENTER);
        noTint(); // ensure crown keeps original colors
        // Base vertical position above head
        const baseY = -(height/2 + 10);

        // Gentle bobbing: amplitude 5px, period ~ (2PI / 0.08) frames (~78 frames) => about 1.3s at 60fps
        const bob = Math.sin((frameCount * 0.03) + (this.id % 1000)) * 5;
        const crownY = baseY + bob;
        const crownWidth = this.size * 0.5;
        const crownHeight = crownWidth * (assets.sprites.crown.height / assets.sprites.crown.width);
        image(assets.sprites.crown, 0, crownY, crownWidth, crownHeight);

        pop();
    }

    display_cursor() {
        push();
        
        // Fill this circle with the goblin's color, but more transparent
        fill(this.color[0], this.color[1], this.color[2], 100);
        noStroke();
        ellipse(this.cursor.x, this.cursor.y, 20);

        pop();
    }
    
    display_range() {
        // Dotted line circle around the goblin (cursor range)
        push();
        drawingContext.setLineDash([40, 20]); // Set dashed line style
        translate(this.x, this.y);
        rotate(frameCount * 0.009); // Rotate the circle for a dynamic effect
        // if the cursor is almost at the edge of the range, make the stroke more visible
        stroke(this.color[0], this.color[1], this.color[2], (this.velocity.mag() * 100 / 10));
        strokeWeight(5);
        noFill();
        ellipse(0, 0, this.cursor_range * 2);
        pop();
    }

    display_lines(lines) {
        if (lines.length === 0) return;
        // console.log("Goblin id:" + this.id + " displaying " + lines.length + " lines");
        push();
        let currentColor = lines[0].color;
        let currentWeight = lines[0].weight;

        beginShape();
        strokeJoin(ROUND);
        strokeCap(ROUND);
        stroke(currentColor);
        strokeWeight(currentWeight);
        noFill();

        vertex(lines[0].start.x, lines[0].start.y);
        vertex(lines[0].end.x, lines[0].end.y);

        for (let i = 1; i < lines.length; i++) {
            const line = lines[i];
            const prev = lines[i - 1];

            const sameStyle = this.colorsEqual(line.color, prev.color) && line.weight === prev.weight;
            const connected = line.start.x === prev.end.x && line.start.y === prev.end.y;

            if (sameStyle && connected) {
                vertex(line.end.x, line.end.y);
            } else {
                endShape();
                stroke(line.color);
                strokeWeight(line.weight);
                beginShape();
                vertex(line.start.x, line.start.y);
                vertex(line.end.x, line.end.y);
            }
        }

        endShape();

        pop();
    }

    move() {
        // Update velocity based on input
        if (this.input.x !== 0 || this.input.y !== 0) {
            // Calculate the movement vector based on input, speed, and delta time
            var dir = createVector(this.input.x, this.input.y).normalize();
            var movement = dir.mult(this.speed); // Scale the direction by speed and delta time
            this.velocity.add(movement);
            // Limit the velocity to the maximum speed
            this.velocity.limit(this.max_speed);
        }

        // Apply friction to slow down the player
        this.velocity.mult(this.friction);
        
        // Update position based on velocity
        this.x += this.velocity.x;
        this.y += this.velocity.y;
    }

    say(message) {
        this.speech = message;
        this.speech_timer = 0; // Reset speech timer
    }

    check_input() {
        if (this.frozen || !focused) {
            this.input.x = 0; // Reset input if frozen
            this.input.y = 0;
            return; // If the goblin is frozen, do not process input
        }
        this.input.x = 0;
        if (this.keyStates['a'] || this.keyStates['ArrowLeft']) { // 'A' key for left movement
            this.input.x -= 1;
        }
        if (this.keyStates['d'] || this.keyStates['ArrowRight']) { // 'D' key for right movement
            this.input.x += 1;
        }

        this.input.y = 0;
        if (this.keyStates['w'] || this.keyStates['ArrowUp']) { // 'W' key for up movement
            this.input.y -= 1;
        } else if (this.keyStates['s'] || this.keyStates['ArrowDown']) { // 'S' key for down movement
            this.input.y += 1;
        }
    }


    simplifyLines(lines, angleThreshold = 5, distanceThreshold = 0.5) {
        if (lines.length === 0) return [];

        const simplified = [];

        let current = lines[0];
        let start = current.start.copy();
        let end = current.end.copy();
        let color = current.color;
        let weight = current.weight;
        let prevDir = end.copy().sub(start);

        for (let i = 1; i < lines.length; i++) {
            const next = lines[i];

            // Check style match - handle color arrays properly
            if (!this.colorsEqual(next.color, color) || next.weight !== weight) {
                simplified.push(new Line(start, end, color, weight));
                start = next.start.copy();
                end = next.end.copy();
                color = next.color;
                weight = next.weight;
                prevDir = end.copy().sub(start);
                continue;
            }

            // Check if connected
            if (end.dist(next.start) > distanceThreshold) {
                simplified.push(new Line(start, end, color, weight));
                start = next.start.copy();
                end = next.end.copy();
                prevDir = end.copy().sub(start);
                continue;
            }

            // Check angle similarity
            const nextStart = next.start.copy();
            const nextEnd = next.end.copy();
            const nextDir = nextEnd.copy().sub(nextStart);
            
            // Avoid division by zero
            if (prevDir.mag() === 0 || nextDir.mag() === 0) {
                end = nextEnd;
                prevDir = end.copy().sub(start);
                continue;
            }

            const dotProduct = prevDir.normalize().dot(nextDir.normalize());
            // Clamp dot product to avoid NaN from acos
            const clampedDot = constrain(dotProduct, -1, 1);
            const angle = degrees(acos(clampedDot));

            if (angle < angleThreshold) {
                // Extend current segment
                end = next.end.copy();
                prevDir = end.copy().sub(start);
            } else {
                // Not aligned enough, commit current
                simplified.push(new Line(start, end, color, weight));
                start = next.start.copy();
                end = next.end.copy();
                prevDir = end.copy().sub(start);
            }
        }

        // Add the final line
        simplified.push(new Line(start, end, color, weight));
        return simplified;
    }
}

export default Goblin;