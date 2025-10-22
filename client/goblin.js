import Line from './line.js';
import {assets} from './assets.js'; // Import assets for goblin sprites
import { resolveBlingLayout, installBlingDebugOnce, computeBlingWidth } from './bling_config.js';
import { playPop, playTap, clearTapState } from './audio.js';

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
    this.simplify_interval = 500; // Interval for simplifying lines in milliseconds (run more regularly)
        this.last_simplify_count = 0; // Last count of lines after simplification
    // Optional callback (set by host) to notify when lines have changed so render registries can resync
    this.onLinesChanged = null;
        
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
        // Footstep tap tracking
        this._lastWalkPhase = 0; // remember last fractional cycle to detect foot plant crossings
        // Bling system
        this.hasBling = false;       // whether to render a bling accessory (winner)
        this.blingType = 'crown';    // which bling asset: crown|halo|chain|shades
        installBlingDebugOnce();

        // Cosmetic companion (pet) selection key (networked). Null/undefined => no pet.
        this.petKey = null;

        // Tool options
        this.eraserRadius = 15; // default eraser radius in pixels

    // Mobile move mode state (toggled by tapping your own goblin on touch devices)
    this._mobileMoveActive = false;
    this._prevToolBeforeMobileMove = null;

        // Appear/spawn animation state
        this._spawnActive = false;      // currently animating
        this._spawnTime = 0;            // ms since start
        this._spawnDuration = 330;      // quick pop under half a second
        this._popStarted = false;       // has an appear animation started at least
        this._popCompleted = false;     // finished appear animation

        // Per-frame render intent flags (set by update(), consumed by renderer)
        this._visibleThisFrame = false;       // whether to render goblin sprite/UI this frame
        this._linesVisibleThisFrame = false;  // whether to render lines this frame
        this._drawNameThisFrame = false;      // whether to draw the name label
    }

    // Reset per-frame visibility flags; call once at the start of a frame before any updates
    beginFrame() {
        this._visibleThisFrame = false;
        this._linesVisibleThisFrame = false;
        this._drawNameThisFrame = false;
    }

    // Public: trigger a quick pop-in animation now
    triggerAppear() {
        this._spawnActive = true;
        this._spawnTime = 0;
        this._popStarted = true;
        this._popCompleted = false;
        // Low-latency pop via Web Audio
        try { playPop(); } catch {}
    }

    setSize() {
        switch (this.shape) {
            case 'yogi':
                this.size = 30;
                break;
            case 'hippo':
            case 'grubby':
            case 'sticky':
            case 'bricky':
                this.size = 35;
                break;
            // These 4 are kinda big, so they have a smaller size
            case 'blimp':
            case 'stanley':
            case 'reggie':
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

    // Called every frame (when this goblin should be considered for rendering this frame)
    // This now only updates state and sets per-frame render flags. Actual drawing is done elsewhere
    // to ensure all lines render beneath goblins consistently.
    update(delta, draw_lines = true, draw_name = false) {
        // Mark intended render visibility for this frame
        this._visibleThisFrame = true;
        this._linesVisibleThisFrame = !!draw_lines;
        this._drawNameThisFrame = !!draw_name;
        // First-time auto trigger if never started
        if (!this._popStarted) this.triggerAppear();

        if (this.simplify_timer >= this.simplify_interval && this.lines.length !== this.last_simplify_count) {
            this.simplify_timer = 0; 
            this.lines = this.simplifyLines(this.lines, 5, 0.5);
            this.last_simplify_count = this.lines.length;
            // Inform host (index.js) so global draw registry stays in sync with simplified segments
            if (typeof this.onLinesChanged === 'function') {
                try { this.onLinesChanged(this.id, this.lines); } catch {}
            }
        }

        this.simplify_timer += delta;
        if(this.local) {
            // If mobile move is active, behave as: cursor leads, goblin follows to close the gap.
            if (this._mobileMoveActive) {
                // Place cursor at finger position (immediate) so it can precede the goblin.
                this.cursor.x = mouseX;
                this.cursor.y = mouseY;

                // Compute vector from goblin to cursor and clamp its length to cursor_range
                this.cursor_vector = createVector(this.cursor.x - this.x, this.cursor.y - this.y);
                const distToCursor = this.cursor_vector.mag();
                if (distToCursor > this.cursor_range) {
                    this.cursor_vector.setMag(this.cursor_range);
                    this.cursor.x = this.x + this.cursor_vector.x;
                    this.cursor.y = this.y + this.cursor_vector.y;
                }

                // Move the goblin toward the cursor with smoothing. The farther the cursor, the higher the follow strength.
                const gap = this.cursor_vector.mag();
                // Map gap 0..cursor_range -> follow 0.10..0.7 (tunable)
                const minFollow = 0.10;
                const maxFollow = 0.7;
                const followStrength = minFollow + (Math.min(gap, this.cursor_range) / this.cursor_range) * (maxFollow - minFollow);
                const prevX = this.x;
                const prevY = this.y;
                this.x = lerp(this.x, this.cursor.x, followStrength);
                this.y = lerp(this.y, this.cursor.y, followStrength);
                // Update velocity to reflect recent movement for animation/audio
                this.velocity.x = this.x - prevX;
                this.velocity.y = this.y - prevY;
                // Keep on-screen during mobile-follow mode as well
                try { this.clampToViewport(); } catch (e) {}
            } else {
                this.check_input();
                this.move();
            }
        }
        
        // Update walking animation cycle when moving
        const speedMag = this.velocity.mag();
        if (speedMag > 1) { // Only animate when moving
            this.walk_cycle += this.walk_speed;
            // Generate footstep taps aligned roughly to bounce crest/trough.
            // We use sin(walk_cycle * 2) like bounce; fire tap near points where phase crosses multiples of PI (cycle*2 near integer PI).
            const phase = (this.walk_cycle * 2) % (Math.PI*2); // 0..2PI domain of sine
            const lastPhase = this._lastWalkPhase;
            // Detect downward zero-crossing and its opposite (two taps per full sine wave)
            const crossed = (lastPhase < Math.PI && phase >= Math.PI) || (lastPhase > phase && lastPhase > Math.PI); // handle wrap
            if (crossed) {
                // intensity scaled by velocity ratio
                const intensity = Math.min(1, speedMag / this.max_speed);
                try { playTap(this.id, intensity); } catch {}
            }
            this._lastWalkPhase = phase;
        } else {
            // Not moving – reset cycle & tap state so next movement starts cleanly
            this.walk_cycle = 0;
            this._lastWalkPhase = 0;
            clearTapState(this.id);
        }

        // TODO: Point the goblin's pen at the cursor instead
        if (this.local){
            // When mobile move is active, the cursor is driven directly by touch (above). Otherwise, keep prior smoothing behavior.
            if (!this._mobileMoveActive) {
                this.cursor.x = lerp(this.cursor.x, mouseX, 0.3);
                this.cursor.y = lerp(this.cursor.y, mouseY, 0.3);
            }
        }
        // Limit the cursor's distance from the goblin
        this.cursor_vector = createVector(this.cursor.x - this.x, this.cursor.y - this.y);
        if (this.cursor_vector.mag() > this.cursor_range) {
            this.cursor_vector.setMag(this.cursor_range);
            this.cursor.x = this.x + this.cursor_vector.x;
            this.cursor.y = this.y + this.cursor_vector.y;
        }

        // Handle speech timer lifecycle (rendering happens in render pass)
        if (this.speech !== "") {
            this.speech_timer += delta; // Increment speech timer
            if (this.speech_timer >= this.speech_duration) {
                this.speech = ""; // Clear speech after duration
                this.speech_timer = 0; // Reset timer
            }
        }

        // Advance spawn animation and bookkeep last render frame
        if (this._spawnActive) {
            const step = Math.min(delta, 50); // cap per-frame advance so animation can't be skipped
            this._spawnTime += step;
            if (this._spawnTime >= this._spawnDuration) {
                this._spawnActive = false;
                this._spawnTime = this._spawnDuration;
                this._popCompleted = true;
            }
        }
        // keep flags consistent
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
        // Compute pop-in scale once
        let spawnScale = 1;
        if (this._popStarted) {
            const t = Math.min(Math.max(this._spawnTime / this._spawnDuration, 0), 1); // 0..1
            const startScale = 0.05;   // start very small
            const overshoot = 1.15;    // subtle overshoot
            const split = 0.75;        // reach overshoot later in the timeline
            if (t <= split) {
                // ease-out from startScale to overshoot
                const u = t / split;
                const eased = 1 - Math.pow(1 - u, 2); // quadratic ease-out
                spawnScale = startScale + (overshoot - startScale) * eased;
            } else {
                // ease-in from overshoot down to 1.0 quickly
                const u = (t - split) / (1 - split);
                const easedIn = u * u; // quadratic ease-in
                spawnScale = overshoot + (1.0 - overshoot) * easedIn;
            }
        }

        // Draw hands and tools with pop scale
        push();
        scale(spawnScale);
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
        } else if (this.tool === 'spray') {
            // Use dedicated spray sprite if available; otherwise reuse brush asset as placeholder
            const sprite = assets.sprites["spray"] || assets.sprites["brush"];
            // Preserve sprite aspect ratio (default 42x61), scale to similar footprint but taller than wide
            const sw = (sprite && sprite.width) ? sprite.width : 42;
            const sh = (sprite && sprite.height) ? sprite.height : 61;
            const ratio = sw / sh;
            const targetH = 28; // make spraycan a little bigger in hand
            const targetW = targetH * ratio;
            image(sprite, 17, -8, targetW, targetH);
        } else if (this.tool === 'eraser') {
            image(assets.sprites["eraser"], 15, -8, 25, 15);
        }
        pop();
        pop();

        let height = this.size * (assets.sprites[this.shape].height / assets.sprites[this.shape].width);

        // Draw name (adjust vertical offset if crown showing), not scaled
        if (draw_name && this.name) {
            push();
            noStroke();
            fill(this.ui_color[0], this.ui_color[1], this.ui_color[2], 200);
            textAlign(CENTER, BOTTOM);
            textSize(14);
            const nameOffset = this.hasBling && (this.blingType === 'crown' || this.blingType === 'halo') ? -60 : -50;
            text(this.name, 0, nameOffset);
            pop();
        }

        // Draw body with pop scale
        push();
        scale(spawnScale);
        translate(0, bounceOffset); // Apply bounce offset
        
        // Apply tilt rotation
        rotate(radians(tiltOffset));

        if (this.flip) {
            scale(-1, 1); // Flip horizontally
        }
        image(assets.sprites[this.shape], 0, 0, this.size, height);
    if (this.hasBling) this.display_bling();
        pop();

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

    // Render winner bling using anchor/spec system
    display_bling() {
        const sprite = assets?.sprites?.[this.blingType];
        if (!sprite) return;
        const layout = resolveBlingLayout(this.shape, this.blingType);
        if (!layout) return;
        const { anchor, spec } = layout;
        const bodySprite = assets.sprites[this.shape];
        if (!bodySprite) return;
        const bodyHeight = this.size * (bodySprite.height / bodySprite.width);
        const bodyWidth = this.size; // width we render body at

    // Convert anchor (normalized) to pixel offsets in unflipped (facing right) space
    let baseX = anchor.x * bodyWidth;
    let baseY = anchor.y * bodyHeight;
    if (spec.dx) baseX += spec.dx * bodyWidth;
    if (spec.dy) baseY += spec.dy * bodyHeight;

    let targetWidth = Math.max(4, computeBlingWidth(this.shape, this.blingType, (spec.width || 0.5), this.size));
        const ratio = sprite.height / sprite.width;
        let targetHeight = targetWidth * ratio;

        // Floating / bobbing motion
        if (spec.bob) {
            const bobAmp = spec.ring ? 6 : 5;
            const bob = Math.sin((frameCount * 0.035) + (this.id % 997)) * bobAmp;
            baseY += bob;
        }

        push();
        imageMode(CENTER);
        noTint();
        // Apply horizontal flip transform so offsets/anchors mirror perfectly.
        // For ring-like halo we keep it centered (ignore X anchor to avoid lateral drift).
    // Parent display() already applied scale(-1,1) when this.flip is true, so baseX is auto-mirrored.
    // DO NOT negate here or offsets double-flip. Only center ring types.
            const drawX = baseX; 
    const drawY = baseY;
        image(sprite, drawX, drawY, targetWidth, targetHeight);

        // Debug overlay
        if (window.__blingDebug) {
            push();
            stroke(255, 0, 0, 160); strokeWeight(2); noFill();
            line(drawX - 6, drawY, drawX + 6, drawY);
            line(drawX, drawY - 6, drawX, drawY + 6);
            stroke(0,200,255,160);
            rectMode(CENTER);
            rect(drawX, drawY, targetWidth, targetHeight);
            pop();
        }
        pop();
    }

    display_cursor() {
        push();
        
        if (this.tool === 'eraser') {
            fill(this.color[0], this.color[1], this.color[2], 100);
            noStroke();
            ellipse(this.cursor.x, this.cursor.y, this.eraserRadius * 2);
        } else if (this.tool === 'spray') {
            // Slightly larger cursor to suggest thicker stroke
            fill(this.color[0], this.color[1], this.color[2], 100);
            noStroke();
            ellipse(this.cursor.x, this.cursor.y, 28);
        } else {
            // Cursor dot
            fill(this.color[0], this.color[1], this.color[2], 100);
            noStroke();
            ellipse(this.cursor.x, this.cursor.y, 20);
        }

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

        // Keep local goblins on their own viewport: softly bounce them back if they hit the edges
        try {
            this.clampToViewport();
        } catch (e) {
            // ignore if width/height aren't available
        }
    }

    // Prevent the local goblin from moving off the visible screen. When the goblin
    // hits a viewport edge, gently nudge it back and invert a bit of its velocity
    // to produce a soft bounce effect.
    clampToViewport() {
        if (!this.local) return;
        // Use p5 width/height when available, fallback to window
        const vw = (typeof width === 'number') ? width : (window.innerWidth || 0);
        const vh = (typeof height === 'number') ? height : (window.innerHeight || 0);
        if (!vw || !vh) return;

        // Keep the goblin's visual center inside the viewport with a small padding
        const padding = 8;
        const halfSize = Math.max(10, (this.size || 40) * 0.5);
        const minX = padding + halfSize;
        const maxX = Math.max(minX, vw - padding - halfSize);
        const minY = padding + halfSize;
        const maxY = Math.max(minY, vh - padding - halfSize);

        // Soft bounce factor: how much velocity is inverted and how strongly we nudge back
        const bounceVelFactor = 0.4; // keep some momentum but dampen
        const penetrationFactor = 0.3; // how far inside the bounds to place when penetrating

        // X axis
        if (this.x < minX) {
            const pen = minX - this.x;
            this.x = minX + pen * penetrationFactor;
            this.velocity.x = -this.velocity.x * bounceVelFactor;
        } else if (this.x > maxX) {
            const pen = this.x - maxX;
            this.x = maxX - pen * penetrationFactor;
            this.velocity.x = -this.velocity.x * bounceVelFactor;
        }

        // Y axis
        if (this.y < minY) {
            const pen = minY - this.y;
            this.y = minY + pen * penetrationFactor;
            this.velocity.y = -this.velocity.y * bounceVelFactor;
        } else if (this.y > maxY) {
            const pen = this.y - maxY;
            this.y = maxY - pen * penetrationFactor;
            this.velocity.y = -this.velocity.y * bounceVelFactor;
        }
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