import { you, goblins, pets } from './index.js';
import { assets } from './assets.js';
import { sendMessage } from './network.js';
import Pet from './pets.js';
import { calculateUIColor, palette } from './colors.js';
import { resolveBlingLayout, computeBlingWidth, BLING_SPECS } from './bling_config.js';
import { hasPremium, hasPetPack, hasBlingPack, hasMoreGoblinsPack, fetchEntitlements } from './entitlements.js';

// Single, basic profile display used for all users.
class ProfileDisplay {
    constructor(width = 320, height = 160) {
        this.width = width;
        this.height = height;
        this.x = 0;
        this.y = 0;
        this.visible = false;
        this.targetGoblin = null;

        this.colorPalette = palette;
        this.colorSize = 20;
        this.colorSpacing = 5;
        this.colorsPerRow = 4;
        // place color picker on the left side of the dialog
        this.colorStartX = 20;
        this.colorStartY = 20;

        this.hoveredColor = -1;
        // Base goblin shapes always available
        this.baseShapes = ['manny','stanley','ricky','blimp','hippo','grubby'];
        // Extra goblins unlocked by pack/premium
        this.extraShapes = ['bricky','reggie','sticky','yogi'];
        this.leftArrowHover = false;
        this.rightArrowHover = false;
        this.blingLeftHover = false;
        this.blingRightHover = false;
        this.prevMousePressed = false;
        this.arrowOffset = 80;
        this.arrowSize = 15;
        // Local picker selection for bling (do NOT apply to the in-game goblin object)
        this.selectedBling = null;
        this.selectedPet = null;
    }

    // Return the list of shapes the user can pick from, including extra goblins if entitled
    getAvailableShapes() {
        if (hasMoreGoblinsPack()) return [...this.baseShapes, ...this.extraShapes];
        return [...this.baseShapes];
    }

    show(goblinId, playerX, playerY) {
        this.targetGoblin = goblins.find(g => g.id === goblinId) || you;
        this.playerX = playerX;
        this.playerY = playerY;
        this.visible = true;
        // ensure a sensible default bling selection for the picker (does NOT force on the in-game goblin)
        // Initialize picker from the goblin's authoritative blingType so the picker
        // reflects the current value; we will write blingType locally when changed.
        this.selectedBling = this.targetGoblin.blingType || 'crown';
        // Initialize selected pet from the goblin so the picker remembers last selection
        this.selectedPet = this.targetGoblin.petKey || 'no';
        this.updatePosition();
        // Ensure the current shape is allowed by entitlements; if not and this is the local player, reset to base shape
        try {
            const shapes = this.getAvailableShapes();
            if (this.targetGoblin === you && !shapes.includes(this.targetGoblin.shape)) {
                this.targetGoblin.shape = shapes[0];
                // adjust size if available
                if (typeof this.targetGoblin.setSize === 'function') this.targetGoblin.setSize();
                try { sendMessage({ type: 'update', g: { i: this.targetGoblin.id, s: this.targetGoblin.shape } }); } catch (e) {}
            }
        } catch (e) {}
        // Kick off an async entitlement fetch so the picker can update if entitlements arrive shortly after opening
        try {
            fetchEntitlements().then(() => {
                try {
                    const shapes = this.getAvailableShapes();
                    if (this.targetGoblin === you && !shapes.includes(this.targetGoblin.shape)) {
                        this.targetGoblin.shape = shapes[0];
                        if (typeof this.targetGoblin.setSize === 'function') this.targetGoblin.setSize();

                        try { sendMessage({ type: 'update', g: { i: this.targetGoblin.id, s: this.targetGoblin.shape } }); } catch (e) {}
                    }
                } catch (e) {}
            }).catch(()=>{});
        } catch (e) {}
    }

    hide() { this.visible = false; this.targetGoblin = null; }

    updatePosition() {
        this.x = this.playerX - this.width / 2;
        this.y = this.playerY - this.height - 40;
        if (this.x < 10) this.x = 10;
        if (this.x + this.width > windowWidth - 10) this.x = windowWidth - this.width - 10;
        if (this.y < 10) this.y = this.playerY + 60;
    }

    update() {
        if (!this.visible || !this.targetGoblin) return;
        this.updatePosition();
        this.hoveredColor = -1;
        this.leftArrowHover = false; this.rightArrowHover = false;
        this.blingLeftHover = false; this.blingRightHover = false;
        this.petLeftHover = false;
        this.petRightHover = false;

    // place goblin sprite on the right side of the dialog (nudged toward the color picker)
    const spriteX = this.x + this.width - 100;
    // equal vertical padding: 20px top and bottom
    const contentTop = this.y + 20;
    const contentBottom = this.y + this.height - 20;
    const spriteY = contentTop + (contentBottom - contentTop) * 0.5;
    const arrowSize = this.arrowSize;
    const arrowOffset = this.arrowOffset;
    // bling arrows sit above the shape arrows
    const blingArrowY = spriteY - (arrowSize * 2 + 8);
    const blingLeftX = spriteX - arrowOffset; const blingLeftBox = { x: blingLeftX, y: blingArrowY - arrowSize/2, w: arrowSize, h: arrowSize };
    const blingRightX = spriteX + arrowOffset; const blingRightBox = { x: blingRightX - arrowSize, y: blingArrowY - arrowSize/2, w: arrowSize, h: arrowSize };
        const leftTipX = spriteX - arrowOffset;
        const leftBox = { x: leftTipX, y: spriteY - arrowSize/2, w: arrowSize, h: arrowSize };
        const rightTipX = spriteX + arrowOffset;
        const rightBox = { x: rightTipX - arrowSize, y: spriteY - arrowSize/2, w: arrowSize, h: arrowSize };
        const justPressed = mouseIsPressed && !this.prevMousePressed;
    // Hit testing order: bling (if allowed) -> shape arrows -> pet (if allowed)
    let hitHandled = false;
    if (hasBlingPack() || hasPremium()) {
        if (mouseX >= blingLeftBox.x && mouseX <= blingLeftBox.x + blingLeftBox.w && mouseY >= blingLeftBox.y && mouseY <= blingLeftBox.y + blingLeftBox.h) {
            this.blingLeftHover = true; cursor('pointer'); if (justPressed) this.cycleBling(-1); hitHandled = true;
        } else if (mouseX >= blingRightBox.x && mouseX <= blingRightBox.x + blingRightBox.w && mouseY >= blingRightBox.y && mouseY <= blingRightBox.y + blingRightBox.h) {
            this.blingRightHover = true; cursor('pointer'); if (justPressed) this.cycleBling(1); hitHandled = true;
        }
    } else { this.blingLeftHover = false; this.blingRightHover = false; }

    // Then shape arrows (only if a prior hit didn't already consume input)
    if (!hitHandled) {
        if (mouseX >= leftBox.x && mouseX <= leftBox.x + leftBox.w && mouseY >= leftBox.y && mouseY <= leftBox.y + leftBox.h) { this.leftArrowHover = true; cursor('pointer'); if (justPressed) this.cycleShape(-1); hitHandled = true; }
        else if (mouseX >= rightBox.x && mouseX <= rightBox.x + rightBox.w && mouseY >= rightBox.y && mouseY <= rightBox.y + rightBox.h) { this.rightArrowHover = true; cursor('pointer'); if (justPressed) this.cycleShape(1); hitHandled = true; }
    }

    // Pet arrows sit below the shape arrows
    const petArrowY = spriteY + (arrowSize * 2 + 8);
    const petLeftX = spriteX - arrowOffset; const petLeftBox = { x: petLeftX, y: petArrowY - arrowSize/2, w: arrowSize, h: arrowSize };
    const petRightX = spriteX + arrowOffset; const petRightBox = { x: petRightX - arrowSize, y: petArrowY - arrowSize/2, w: arrowSize, h: arrowSize };
    if (hasPetPack() || hasPremium()) {
        if (mouseX >= petLeftBox.x && mouseX <= petLeftBox.x + petLeftBox.w && mouseY >= petLeftBox.y && mouseY <= petLeftBox.y + petLeftBox.h) { this.petLeftHover = true; cursor('pointer'); if (justPressed) this.cyclePet(-1); }
        else if (mouseX >= petRightBox.x && mouseX <= petRightBox.x + petRightBox.w && mouseY >= petRightBox.y && mouseY <= petRightBox.y + petRightBox.h) { this.petRightHover = true; cursor('pointer'); if (justPressed) this.cyclePet(1); }
    } else { this.petLeftHover = false; this.petRightHover = false; }

        for (let i = 0; i < this.colorPalette.length; i++) {
            const col = i % this.colorsPerRow; const row = Math.floor(i / this.colorsPerRow);
            const colorX = this.x + this.colorStartX + col * (this.colorSize + this.colorSpacing);
            const colorY = this.y + this.colorStartY + row * (this.colorSize + this.colorSpacing);
            if (mouseX >= colorX && mouseX <= colorX + this.colorSize && mouseY >= colorY && mouseY <= colorY + this.colorSize) { this.hoveredColor = i; cursor('pointer'); if (mouseIsPressed) this.selectColor(i); break; }
        }

        if (mouseIsPressed && !this.isMouseInside()) this.hide();
        if (keyIsPressed && key === 'Escape') this.hide();

        this.display(); this.prevMousePressed = mouseIsPressed;
    }

    isMouseInside() { return mouseX >= this.x && mouseX <= this.x + this.width && mouseY >= this.y && mouseY <= this.y + this.height; }
    isMouseInteracting() { return this.visible && this.isMouseInside(); }

    selectColor(i) { if (i<0||i>=this.colorPalette.length) return; const newColor=[...this.colorPalette[i]]; this.targetGoblin.color=newColor; if (this.targetGoblin===you){ you.ui_color = calculateUIColor(newColor, [240,240,240]); try{ window.dispatchEvent(new CustomEvent('ui:color-changed',{detail:{color:you.ui_color}})); }catch(_){} } sendMessage({ type:'update', g:{ i:this.targetGoblin.id, co:[newColor[0]|0,newColor[1]|0,newColor[2]|0] } }); }

    display() {
        if (!this.visible || !this.targetGoblin || you !== this.targetGoblin) return;
        push();
        fill(240,200);
        drawingContext.setLineDash([6,12]);
        stroke(you.ui_color[0], you.ui_color[1], you.ui_color[2], 100);
        strokeWeight(2);
        rect(this.x, this.y, this.width, this.height, 10);
        drawingContext.setLineDash([]);
        noStroke();

    // goblin sprite on the right side now (mirrors update() above) (nudged toward the color picker)
    const spriteX = this.x + this.width - 100;
    // equal vertical padding: 20px top and bottom
    const contentTop = this.y + 20;
    const contentBottom = this.y + this.height - 20;
    const spriteY = contentTop + (contentBottom - contentTop) * 0.5;
    const spriteSize = 70;
        const arrowSize = this.arrowSize; const arrowOffset = this.arrowOffset;
        // Render goblin at the same size & with hands/tools as in game
        const tg = this.targetGoblin;
        if (assets.sprites && assets.sprites[tg.shape]){
            const bodySprite = assets.sprites[tg.shape];
            const bodyHeight = tg.size * (bodySprite.height / bodySprite.width);
            push();
            imageMode(CENTER);
            // Center at picker spriteX/spriteY
            translate(spriteX, spriteY);
            // Apply tint for body color
            tint(tg.color[0], tg.color[1], tg.color[2]);
            noStroke();

            // Draw hands and tool (similar to Goblin.display)
            push();
            // Determine flip based on mouse relative to the picker center (not the goblin's world flip)
            const pickerFlip = (mouseX < spriteX);
            // No spawnScale in picker (use 1) but respect flip for hand placement
            const empty_hand_x = pickerFlip ? 30 : -30;
            if (assets.sprites['empty_hand']) image(assets.sprites['empty_hand'], empty_hand_x, 10, 10, 10);
            // Place brush hand and tool; rotate toward the picker's mouse position so it matches in-game behavior
            let brush_vector = createVector(mouseX - spriteX, mouseY - spriteY);
            if (brush_vector.mag() < 1) brush_vector = createVector(25, 0);
            brush_vector.setMag(25);
            push();
            translate(brush_vector.x, brush_vector.y);
            // rotate the hand/tool to point toward the mouse
            rotate(atan2(brush_vector.y, brush_vector.x));
            if (assets.sprites['brush_hand']) image(assets.sprites['brush_hand'], 0, 0, 10, 10);
            if (tg.tool === 'brush' && assets.sprites['brush']) image(assets.sprites['brush'], 17, -8, 25, 15);
            else if (tg.tool === 'spray' && (assets.sprites['spray'] || assets.sprites['brush'])) {
                const sprite = assets.sprites['spray'] || assets.sprites['brush'];
                const sw = sprite && sprite.width ? sprite.width : 42;
                const sh = sprite && sprite.height ? sprite.height : 61;
                const ratio = sw / sh;
                const targetH = 28;
                const targetW = targetH * ratio;
                image(sprite, 17, -8, targetW, targetH);
            } else if (tg.tool === 'eraser' && assets.sprites['eraser']) {
                image(assets.sprites['eraser'], 15, -8, 25, 15);
            }
            pop();
            pop();

            // Draw body (respect flip)
            push();
                if (pickerFlip) scale(-1, 1);
            image(bodySprite, 0, 0, tg.size, bodyHeight);
            // Draw bling on picker using the picker's selected bling (do not require tg.hasBling or mutate tg)
            // Only render bling if the bling picker is available to the user (don't show crown when picker is hidden)
            const blingAllowed = (hasBlingPack() || hasPremium());
            const blingToRender = blingAllowed ? (this.selectedBling || tg.blingType) : null;
            if (blingToRender && assets.sprites[blingToRender]) {
                try {
                    const blingSprite = assets.sprites[blingToRender];
                    const layout = resolveBlingLayout(tg.shape, blingToRender);
                    if (layout) {
                        const { anchor, spec } = layout;
                        const bodyWidth = tg.size;
                        const bodyH = bodyHeight;
                        let drawX = (anchor.x || 0) * bodyWidth;
                        let drawY = (anchor.y || 0) * bodyH;
                        if (spec.dx) drawX += spec.dx * bodyWidth;
                        if (spec.dy) drawY += spec.dy * bodyH;
                        const targetWidth = Math.max(4, computeBlingWidth(tg.shape, blingToRender, spec.width || 0.5, tg.size));
                        const ratio = blingSprite.height / blingSprite.width;
                        const targetH = targetWidth * ratio;
                        let bob = 0;
                        if (spec.bob) bob = Math.sin(frameCount * 0.035 + (tg.id % 997)) * (spec.ring ? 6 : 5);
                        push(); imageMode(CENTER); noTint(); image(blingSprite, drawX, drawY + bob, targetWidth, targetH); pop();
                    }
                } catch (e) {}
            }
            pop();

            noTint();
            pop();
            // Draw selected pet next to goblin in the picker (unless 'no' / null)
            try {
                const petKey = this.selectedPet || tg.petKey || null;
                if (petKey && petKey !== 'no' && assets.sprites && assets.sprites[petKey]) {
                    // Size mapping mirrors client/pets.js setSize mapping
                    const petSizeMap = { 'pet_butterfly':26, 'pet_bunny':30, 'pet_croc':50, 'pet_mole':40, 'pet_puffle':24 };
                    const pW = petSizeMap[petKey] || 30;
                    const petSprite = assets.sprites[petKey];
                    const petH = pW * (petSprite.height / petSprite.width);
                    // Place pet to the left of the goblin sprite with a small gap
                    const petX = spriteX - (tg.size * 0.5) - (pW * 0.5) - 12;
                    const petY = spriteY + 34; // slightly lower baseline than the goblin (nudged further down)
                    push(); imageMode(CENTER);
                    // Tint pet to match owner's color (same as in-game Pet.display)
                    if (Array.isArray(tg.color)) tint(tg.color[0], tg.color[1], tg.color[2], 200);
                    image(petSprite, petX, petY, pW, petH);
                    noTint(); pop();
                }
            } catch (e) {}
            // Pet preview: only show pet preview in picker if entitlement present
            if (hasPetPack() || hasPremium()) {
                try {
                    const petKey = this.selectedPet || tg.petKey || null;
                    if (petKey && petKey !== 'no' && assets.sprites && assets.sprites[petKey]) {
                        // Size mapping mirrors client/pets.js setSize mapping
                        const petSizeMap = { 'pet_butterfly':26, 'pet_bunny':30, 'pet_croc':50, 'pet_mole':40, 'pet_puffle':24 };
                        const pW = petSizeMap[petKey] || 30;
                        const petSprite = assets.sprites[petKey];
                        const petH = pW * (petSprite.height / petSprite.width);
                        // Place pet to the left of the goblin sprite with a small gap
                        const petX = spriteX - (tg.size * 0.5) - (pW * 0.5) - 12;
                        const petY = spriteY + 34; // slightly lower baseline than the goblin (nudged further down)
                        push(); imageMode(CENTER);
                        // Tint pet to match owner's color (same as in-game Pet.display)
                        if (Array.isArray(tg.color)) tint(tg.color[0], tg.color[1], tg.color[2], 200);
                        image(petSprite, petX, petY, pW, petH);
                        noTint(); pop();
                    }
                } catch (e) {}
            }
        } else {
            // Fallback: simple colored circle
            fill(this.targetGoblin.color[0], this.targetGoblin.color[1], this.targetGoblin.color[2]);
            ellipse(spriteX, spriteY, spriteSize, spriteSize);
        }

    push(); noStroke();
    // draw bling arrows (above shape arrows) only if entitlement present
    if (hasBlingPack() || hasPremium()) {
        const blingArrowY = spriteY - (arrowSize * 2 + 8);
        push(); noStroke();
        fill(you.ui_color[0], you.ui_color[1], you.ui_color[2], this.blingLeftHover ? 255 : 160);
        triangle(spriteX - arrowOffset, blingArrowY, spriteX - arrowOffset + arrowSize, blingArrowY - arrowSize/2, spriteX - arrowOffset + arrowSize, blingArrowY + arrowSize/2);
        fill(you.ui_color[0], you.ui_color[1], you.ui_color[2], this.blingRightHover ? 255 : 160);
        triangle(spriteX + arrowOffset, blingArrowY, spriteX + arrowOffset - arrowSize, blingArrowY - arrowSize/2, spriteX + arrowOffset - arrowSize, blingArrowY + arrowSize/2);
        pop();
    }

    push(); noStroke();
    // draw left arrow with hover alpha (shape arrows)
    fill(you.ui_color[0], you.ui_color[1], you.ui_color[2], this.leftArrowHover ? 255 : 160);
    triangle(spriteX - arrowOffset, spriteY, spriteX - arrowOffset + arrowSize, spriteY - arrowSize/2, spriteX - arrowOffset + arrowSize, spriteY + arrowSize/2);
    // draw right arrow with hover alpha
    fill(you.ui_color[0], you.ui_color[1], you.ui_color[2], this.rightArrowHover ? 255 : 160);
    triangle(spriteX + arrowOffset, spriteY, spriteX + arrowOffset - arrowSize, spriteY - arrowSize/2, spriteX + arrowOffset - arrowSize, spriteY + arrowSize/2);
    pop();

    // draw pet arrows (below shape arrows) only if entitlement present
    if (hasPetPack() || hasPremium()) {
        push(); noStroke();
        const petArrowY = spriteY + (arrowSize * 2 + 8);
        fill(you.ui_color[0], you.ui_color[1], you.ui_color[2], this.petLeftHover ? 255 : 160);
        triangle(spriteX - arrowOffset, petArrowY, spriteX - arrowOffset + arrowSize, petArrowY - arrowSize/2, spriteX - arrowOffset + arrowSize, petArrowY + arrowSize/2);
        fill(you.ui_color[0], you.ui_color[1], you.ui_color[2], this.petRightHover ? 255 : 160);
        triangle(spriteX + arrowOffset, petArrowY, spriteX + arrowOffset - arrowSize, petArrowY - arrowSize/2, spriteX + arrowOffset - arrowSize, petArrowY + arrowSize/2);
        pop();
    }
    pop();

        // fill(you.ui_color[0], you.ui_color[1], you.ui_color[2]); textAlign(LEFT, TOP); textSize(16); text('Choose Color:', this.x + this.colorStartX, this.y + 20);
        for (let i=0;i<this.colorPalette.length;i++){ const col=i%this.colorsPerRow; const row=Math.floor(i/this.colorsPerRow); const colorX=this.x+this.colorStartX+col*(this.colorSize+this.colorSpacing); const colorY=this.y+this.colorStartY+row*(this.colorSize+this.colorSpacing); const color=this.colorPalette[i]; fill(color[0],color[1],color[2]); if(i===this.hoveredColor){ stroke(255); strokeWeight(3); } else { noStroke(); } if(this.targetGoblin.color[0]===color[0]&&this.targetGoblin.color[1]===color[1]&&this.targetGoblin.color[2]===color[2]){ stroke(255,255,0); strokeWeight(4); } ellipse(colorX+this.colorSize/2,colorY+this.colorSize/2,this.colorSize,this.colorSize); }

    // noStroke(); fill(you.ui_color[0], you.ui_color[1], you.ui_color[2]);
    // const displayName=(this.targetGoblin.name&&this.targetGoblin.name.trim())?this.targetGoblin.name:`Player ${Math.round(this.targetGoblin.id)}`;
    // // draw player name centered above the goblin sprite (right side)
    // push(); textAlign(CENTER, TOP); textSize(16); text(displayName, spriteX, this.y + 20); pop();
        pop();
    }

    cycleShape(dir){
        if (this.targetGoblin !== you) return;
        const shapes = this.getAvailableShapes();
        const currentIndex = shapes.indexOf(this.targetGoblin.shape);
        const nextIndex = (currentIndex + dir + shapes.length) % shapes.length;
        this.targetGoblin.shape = shapes[nextIndex];
        // Defer size determination to the Goblin class' setSize() so sizes remain authoritative
        try { if (typeof this.targetGoblin.setSize === 'function') this.targetGoblin.setSize(); } catch (e) {}
        sendMessage({ type:'update', g:{ i:this.targetGoblin.id, s:this.targetGoblin.shape } });
    }

    cycleBling(dir){
        // Picker should only change the local preference. Do not mutate the in-world goblin's
        // hasBling or blingType (those are authoritative from server winner logic).
        if (this.targetGoblin !== you) return;
        const BLING_KEYS = Object.keys(BLING_SPECS || {});
        if (!BLING_KEYS || !BLING_KEYS.length) return;
        const cur = this.selectedBling || this.targetGoblin.blingType || null;
        let idx = cur ? BLING_KEYS.indexOf(cur) : -1;
        idx = (idx + dir + BLING_KEYS.length) % BLING_KEYS.length;
        // Store selection locally for the picker preview and set the goblin's local
        // `blingType` so the choice persists while the client is running.
        this.selectedBling = BLING_KEYS[idx];
        try { this.targetGoblin.blingType = this.selectedBling; } catch (e) {}
    }

    cyclePet(dir){
        if (this.targetGoblin !== you) return;
        // Pet keys: include 'no' for none, then available pet sprites
        const PET_KEYS = ['no','pet_bunny','pet_butterfly','pet_croc','pet_mole','pet_puffle'].filter(k => k && (!k.startsWith('pet_') || (assets && assets.sprites && assets.sprites[k])));
        if (!PET_KEYS || !PET_KEYS.length) return;
        const cur = this.selectedPet || (this.targetGoblin.petKey || 'no');
        let idx = PET_KEYS.indexOf(cur);
        if (idx === -1) idx = 0;
        idx = (idx + dir + PET_KEYS.length) % PET_KEYS.length;
        this.selectedPet = PET_KEYS[idx];
        try {
            if (this.selectedPet === 'no') {
                // Clear local pet key and remove any local Pet instance
                this.targetGoblin.petKey = null;
                const idx = pets.findIndex(p => p.owner === this.targetGoblin);
                if (idx !== -1) pets.splice(idx, 1);
            } else {
                // Set local pet key and ensure a Pet instance exists/updated for this owner
                this.targetGoblin.petKey = this.selectedPet;
                let existingPet = pets.find(p => p.owner === this.targetGoblin);
                if (!existingPet) {
                    try { const np = new Pet(this.targetGoblin, this.selectedPet); pets.push(np); } catch (e) {}
                } else {
                    existingPet.spriteKey = this.selectedPet;
                    if (typeof existingPet.setSize === 'function') existingPet.setSize();
                }
            }
        } catch(e) {}
    }
}

export default ProfileDisplay;

