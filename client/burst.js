// Lightweight particle burst effect (small colored circles popping out and fading)
// Usage:
//   import { spawnBurst, updateBursts } from './burst.js';
//   spawnBurst(x, y, [r,g,b], { count: 6 });
//   // Call once per frame (e.g., inside draw)
//   updateBursts();
//
// Color can be [r,g,b] array or a p5.Color. The effect is quick and subtle by default.

class Particle {
  constructor(x, y, color, opts = {}) {
    const {
      speedMin = 140,
      speedMax = 260,
      sizeMin = 3,
      sizeMax = 6,
      lifeMin = 260, // ms
      lifeMax = 420, // ms
      drag = 0.88,   // per 16ms step (approx). Higher = slows faster
    } = opts;

    const angle = Math.random() * Math.PI * 2;
    const speed = speedMin + Math.random() * (speedMax - speedMin);

    this.x = x + (Math.random() - 0.5) * 2; // tiny jitter so not perfectly stacked
    this.y = y + (Math.random() - 0.5) * 2;
    this.vx = Math.cos(angle) * speed;
    this.vy = Math.sin(angle) * speed;

    this.size = sizeMin + Math.random() * (sizeMax - sizeMin);
    this.baseSize = this.size;

    this.life = lifeMin + Math.random() * (lifeMax - lifeMin); // total lifetime (ms)
    this.age = 0;

    this.drag = drag;
    this.color = color;
  }

  update(dt) {
    // Integrate simple motion with drag
    // Convert drag from ~per 16ms basis to this frame's factor
    const dragFactor = Math.pow(this.drag, dt / 16);
    this.vx *= dragFactor;
    this.vy *= dragFactor;

    this.x += this.vx * (dt / 1000);
    this.y += this.vy * (dt / 1000);

    this.age += dt;

    // Shrink slightly as it fades
    const t = Math.min(this.age / this.life, 1);
    this.size = this.baseSize * (1 - 0.6 * t);
  }

  get done() {
    return this.age >= this.life;
  }

  draw() {
    const t = Math.min(this.age / this.life, 1);
    // Ease the alpha out quickly near the end
    const alpha = 255 * (1 - t) * (1 - 0.25 * t);

    push();
    noStroke();

    const [r, g, b] = colorToRgb(this.color);
    fill(r, g, b, alpha);
    ellipse(this.x, this.y, this.size, this.size);

    pop();
  }
}

class Burst {
  constructor(x, y, color, options = {}) {
    const {
      count = 8,
      speedMin = 140,
      speedMax = 260,
      sizeMin = 3,
      sizeMax = 6,
      lifeMin = 260,
      lifeMax = 420,
      drag = 0.88,
    } = options;

    this.particles = new Array(count).fill(0).map(() => new Particle(x, y, color, {
      speedMin, speedMax, sizeMin, sizeMax, lifeMin, lifeMax, drag
    }));
  }

  updateAndDraw(dt) {
    for (const p of this.particles) {
      p.update(dt);
      p.draw();
    }
    // Keep only those not done
    this.particles = this.particles.filter(p => !p.done);
  }

  get done() {
    return this.particles.length === 0;
  }
}

// Simple manager so callers don't need to track burst lifetimes
const activeBursts = [];

export function spawnBurst(x, y, color, options = {}) {
  activeBursts.push(new Burst(x, y, color, options));
}

export function updateBursts() {
  const dt = (typeof deltaTime === 'number' && !isNaN(deltaTime)) ? deltaTime : 16;
  for (const b of activeBursts) b.updateAndDraw(dt);
  // prune finished
  for (let i = activeBursts.length - 1; i >= 0; i--) {
    if (activeBursts[i].done) activeBursts.splice(i, 1);
  }
}

export default Burst;

// Helpers
function colorToRgb(c) {
  // Accept [r,g,b] arrays or p5.Color
  if (Array.isArray(c) && c.length >= 3) return [c[0], c[1], c[2]];
  try {
    // p5 color -> [r,g,b]
    return [red(c), green(c), blue(c)];
  } catch {
    // Fallback to white
    return [255, 255, 255];
  }
}
