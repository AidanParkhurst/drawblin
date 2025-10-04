import { assets } from './assets.js';

class Pet {
  constructor(owner, spriteKey = 'empty_hand') {
    this.owner = owner;
    // If default placeholder requested, pick a random real pet sprite if available
    const available = ['pet_bunny','pet_butterfly','pet_croc','pet_mole','pet_puffle'].filter(k => assets?.sprites?.[k]);
    this.spriteKey = (spriteKey === 'empty_hand' && available.length) ? random(available) : spriteKey;
    // Start near the owner with a small offset
    this.x = owner.x - 24;
    this.y = owner.y + 18;
    this.velocity = createVector(0, 0);
    this.max_speed = 6;
    this.accel = 0.35;
    this.friction = 0.9;
  	// Distance handling
  	this.stopRadius = 75; // closer personal space before fully stopping

    // Follow delay bookkeeping
    // Removed artificial delay: keep fields for possible future use but neutralize
    this.followDelayMs = 0;
    this.lastOwnerPos = createVector(owner.x, owner.y); // retained (could be used for effects later)
    this.lastOwnerMoveAt = 0;

    // Simple movement animation akin to goblins
    this.walk_cycle = 0;
	  this.walk_speed = 0.30;
	  this.bounce_height = 4; // keep bounce similar
    this.tilt_angle = 10; // stronger tilt

    // Per-sprite size (analogous to goblin setSize())
    this.size = 24; // default fallback width
    this.setSize();

    // Persistent hover animation phase (used only by certain pets like butterfly)
    this.hover_cycle = 0; // in radians
    // Slower gentle hover: effective full cycle ~3s (hover_speed * TWO_PI ≈ 0.0021 rad/ms)
    this.hover_speed = 0.00035; // base factor (multiplied by TWO_PI in update)
    this.hover_height = 3; // peak offset in px (smaller, subtler)
  }

  // Size mapping allows visual balance across differently proportioned pet sprites
  setSize() {
    const key = this.spriteKey;
    // Chosen widths tuned to relative canvas presence; tweak as needed
    const map = {
      'pet_butterfly': 26, // wings feel light; a bit wider
      'pet_bunny': 30,
      'pet_croc': 50,      // longer body
      'pet_mole': 40,      // small, low profile
      'pet_puffle': 24     // tiny puff
    };
    if (map[key]) this.size = map[key];
  }

  update(delta) {
    if (!this.owner) return;

    // Immediate follow logic (no temporal wait). Moves whenever outside stopRadius.
    const toOwner = createVector(this.owner.x - this.x, this.owner.y - this.y);
    const dist = toOwner.mag();
    if (dist > this.stopRadius) {
      // Arrival-esque scaling of speed so it eases in smoothly
      const dir = toOwner.copy().normalize();
      const excess = dist - this.stopRadius; // distance outside comfort zone
      const ramp = constrain(excess / 140, 0, 1); // scale 0..1 over ~140px
      const targetSpeed = this.max_speed * (0.35 + 0.65 * ramp); // never completely crawl
      // Adjust acceleration based on ramp for snappier start then smoothing
      const accelMag = this.accel * (0.6 + 0.8 * ramp);
      this.velocity.add(dir.mult(accelMag));
      // Limit toward dynamic target speed
      if (this.velocity.mag() > targetSpeed) {
        this.velocity.setMag(targetSpeed);
      }
    }

    // Friction and integrate
    this.velocity.mult(this.friction);
    this.x += this.velocity.x;
    this.y += this.velocity.y;

    // Advance animation phase at a consistent rate based on delta
    const dtMs = (typeof delta === 'number' ? delta : 16);
    const moving = this.velocity.mag() > 0.3;
    if (moving) this.walk_cycle += this.walk_speed * (dtMs / 16.666);

    // Advance hover cycle regardless of movement so idle animation keeps going
    this.hover_cycle += this.hover_speed * dtMs * TWO_PI; // keep cycle in radians
    if (this.hover_cycle > TWO_PI) this.hover_cycle -= TWO_PI; // wrap
  }

  display() {
    const sprite = assets?.sprites?.[this.spriteKey] || assets?.sprites?.empty_hand;
    if (!sprite) return;

    // Bounce and tilt similar to goblin; scale amplitude with current speed for consistency
    const speed = Math.min(1, (createVector(this.velocity.x, this.velocity.y).mag()) / this.max_speed);
    const amp = speed; // 0..1 scales amplitude to zero near stop
    let bounceOffset = Math.sin(this.walk_cycle * 2) * this.bounce_height * amp;
    // Gentle hover for butterfly even when idle (fades as movement bounce takes over)
    if (this.spriteKey === 'pet_butterfly') {
      const hoverAmpFactor = 1 - amp * 0.9; // fade more aggressively with movement
      const hoverOffset = Math.sin(this.hover_cycle) * this.hover_height * hoverAmpFactor;
      bounceOffset += hoverOffset;
    }
    // Stronger tilt (remove 0.5 dampening); slight phase lead retained
    let tiltOffset = Math.sin(this.walk_cycle * 2 + Math.PI/4) * this.tilt_angle * amp;
    const faceLeft = this.owner && (this.owner.x < this.x);

    push();
    imageMode(CENTER);
    noStroke();
    // Lightly tint toward owner's color for cohesion
    if (Array.isArray(this.owner?.color)) {
      tint(this.owner.color[0], this.owner.color[1], this.owner.color[2], 200);
    }
    translate(this.x, this.y + bounceOffset);
    rotate(radians(tiltOffset));
    if (faceLeft) {
      scale(-1, 1);
    }
    // Size based on chosen sprite proportions
    const h = this.size * (sprite.height / sprite.width);
    image(sprite, 0, 0, this.size, h);
    pop();
  }
}

export default Pet;
