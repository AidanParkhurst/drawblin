import p5 from 'p5';
import Line from './line.js';

class Goblin {

    constructor(x, y, size, color, local = false, id = -1) {
        this.local = local; // Indicates if this goblin is controlled by the local player
        this.id = id == -1 ? random(1000000) : id; // Unique ID for the goblin, can be used for networking
        this.x = x;
        this.y = y;
        this.size = size;
        this.color = color;

        this.cursor = createVector(x, y); // Create a cursor for the goblin
        this.cursor_range = 200; // Range within which the cursor can move
        this.lines = []; // Array to store lines drawn by the goblin
        this.simplify_timer = 0; // Timer for simplifying lines
        this.simplify_interval = 1000; // Interval for simplifying lines in milliseconds
        this.last_simplify_count = 0; // Last count of lines after simplification
        
        this.max_speed = 8; // Maximum speed of the player
        this.speed = 2; // Acceleration
        this.velocity = createVector(0, 0); // Current velocity of the player
        this.friction = 0.9; // Friction to slow down the player
        this.input = createVector(0, 0); // Input vector for movement
    }

    // Helper function to compare colors (handles both arrays and primitives)
    colorsEqual(color1, color2) {
        if (Array.isArray(color1) && Array.isArray(color2)) {
            return color1.length === color2.length && color1.every((val, i) => val === color2[i]);
        }
        return color1 === color2;
    }

    // Called every frame
    update(delta) {
        if (this.simplify_timer >= this.simplify_interval && this.lines.length !== this.last_simplify_count) {
            this.simplify_timer = 0; 
            this.lines = this.simplifyLines(this.lines, 5, 0.5);
            this.last_simplify_count = this.lines.length;
        }
        this.simplify_timer += delta;
        this.check_input();
        this.move();
        this.display();

        // TODO: Point the goblin's pen at the cursor instead
        if (this.local){
            this.cursor.x = lerp(this.cursor.x, mouseX, 0.3);
            this.cursor.y = lerp(this.cursor.y, mouseY, 0.3);
        }
        // Limit the cursor's distance from the goblin
        let cursor_vector = createVector(this.cursor.x - this.x, this.cursor.y - this.y);
        if (cursor_vector.mag() > this.cursor_range) {
            cursor_vector.setMag(this.cursor_range);
            this.cursor.x = this.x + cursor_vector.x;
            this.cursor.y = this.y + cursor_vector.y;
        }

        this.display_cursor();
        this.display_lines(this.lines);    
    }
    
    display() {

        push();

        fill(this.color);
        noStroke();
        ellipse(this.x, this.y, this.size);

        // Dotted line circle around the goblin (cursor range)
        push();
        drawingContext.setLineDash([40, 20]); // Set dashed line style
        translate(this.x, this.y);
        rotate(frameCount * 0.009); // Rotate the circle for a dynamic effect
        stroke(this.color[0], this.color[1], this.color[2], this.velocity.mag() * 100 / 10);
        strokeWeight(5);
        noFill();
        ellipse(0, 0, this.cursor_range * 2);
        pop();
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
        if (!this.local) return; // Only move if this goblin is controlled by the local player
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

    check_input() {
        if (keyIsDown('a')) { // 'A' key for left movement
            this.input.x = -1;
        } else if (keyIsDown('d')) { // 'D' key for right movement
            this.input.x = 1;
        } else {
            this.input.x = 0;
        }

        if (keyIsDown('w')) { // 'W' key for up movement
            this.input.y = -1;
        } else if (keyIsDown('s')) { // 'S' key for down movement
            this.input.y = 1;
        } else {
            this.input.y = 0;
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