// Web Audio based low-latency SFX manager
// Provides: initAudio (lazy), playPop, playThud, playDragGrain
// Falls back to HTMLAudio elements in assets.sfx if decoding fails.

import popUrl from './assets/sfx/pop.mp3';
import dragUrl from './assets/sfx/drag.mp3';
import thudUrl from './assets/sfx/thud.mp3';
import tapUrl from './assets/sfx/tap.mp3';
import tapWoodUrl from './assets/sfx/tap_wood.mp3';
import { assets } from './assets.js';

let ctx = null;
let buffers = { pop: null, drag: null, thud: null, tap: null, tap_wood: null };
// Track active drag grain sources so we can cut them off immediately when user stops drawing
let activeDrag = [];
let decodePromise = null;
let unlocked = false; // user gesture gate

function ensureContext() {
  if (!ctx) {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return null;
    ctx = new AudioCtx({ latencyHint: 'interactive' });
  }
  if (ctx && ctx.state === 'suspended' && unlocked) {
    ctx.resume().catch(()=>{});
  }
  return ctx;
}

async function decodeAll() {
  if (decodePromise) return decodePromise;
  const context = ensureContext();
  if (!context) return null;
  async function fetchDecode(url) {
    const resp = await fetch(url);
    const arr = await resp.arrayBuffer();
    return await context.decodeAudioData(arr.slice(0));
  }
  decodePromise = Promise.all([
    fetchDecode(popUrl).catch(()=>null),
    fetchDecode(dragUrl).catch(()=>null),
    fetchDecode(thudUrl).catch(()=>null),
    fetchDecode(tapUrl).catch(()=>null),
    fetchDecode(tapWoodUrl).catch(()=>null)
  ]).then(([pop, drag, thud, tap, tap_wood]) => { buffers.pop = pop; buffers.drag = drag; buffers.thud = thud; buffers.tap = tap; buffers.tap_wood = tap_wood; return buffers; });
  return decodePromise;
}

export async function initAudio() {
  unlocked = true;
  ensureContext();
  // Prime decode in background; no await required by caller
  decodeAll().catch(()=>{});
}

function playFromBuffer(name, { volume = 1.0, playbackRate = 1.0, track = false } = {}) {
  const context = ensureContext();
  if (!context || !buffers[name]) {
    // Fallback to HTMLAudio if available
    try {
      const tag = assets?.sfx?.[name];
      if (tag) { tag.volume = volume; tag.currentTime = 0; tag.play().catch(()=>{}); }
    } catch {}
    return;
  }
  const src = context.createBufferSource();
  src.buffer = buffers[name];
  src.playbackRate.value = playbackRate;
  const gain = context.createGain();
  gain.gain.value = volume;
  src.connect(gain).connect(context.destination);
  try { src.start(0); } catch {}
  if (track) {
    activeDrag.push({ src, gain, startedAt: context.currentTime, duration: src.buffer?.duration || 0 });
    // Auto prune when naturally ended
    const endTime = (src.buffer?.duration || 0) + 0.05;
    try { src.stop(context.currentTime + endTime); } catch {}
    src.onended = () => {
      activeDrag = activeDrag.filter(o => o.src !== src);
    };
  }
}

// Public play helpers with tuned volumes
export function playPop() {
  // Slight random pitch for variation
  playFromBuffer('pop', { volume: 0.35, playbackRate: 0.92 + Math.random()*0.16 });
}
export function playThud() {
  playFromBuffer('thud', { volume: 0.45, playbackRate: 0.95 + Math.random()*0.1 });
}
// Called frequently while drawing; distanceFactor (0..1) to scale volume/pitch
export function playDragGrain(distanceFactor = 0.5) {
  // If a drag source is already active, just update its gain / playbackRate (no stacking)
  if (activeDrag.length > 0) {
    const ctxLocal = ensureContext();
    if (ctxLocal) {
      const current = activeDrag[0];
      if (current && current.gain) {
        const targetVol = 0.18 + 0.12 * distanceFactor;
        try {
            current.gain.gain.cancelScheduledValues(ctxLocal.currentTime);
            current.gain.gain.setTargetAtTime(targetVol, ctxLocal.currentTime, 0.015);
        } catch {}
      }
      if (current && current.src) {
        try {
          const newRate = 0.9 + 0.2 * distanceFactor * Math.random();
          current.src.playbackRate.setValueAtTime(newRate, ctxLocal.currentTime);
        } catch {}
      }
    }
    return; // Do not spawn another grain
  }
  // No active drag playback – start one short grain
  const vol = 0.18 + 0.12 * distanceFactor;
  const rate = 0.9 + 0.2 * distanceFactor * Math.random();
  playFromBuffer('drag', { volume: vol, playbackRate: rate, track: true });
}
// Immediately silence any lingering drag grains (called on mouse release)
export function stopDragImmediate() {
  const context = ensureContext();
  if (!context) { activeDrag = []; return; }
  for (const { src, gain } of activeDrag) {
    try {
      // Fast 30ms fade to avoid click
      const now = context.currentTime;
      gain.gain.cancelScheduledValues(now);
      gain.gain.setValueAtTime(gain.gain.value, now);
      gain.gain.linearRampToValueAtTime(0, now + 0.03);
      src.stop(now + 0.04);
    } catch {}
  }
  activeDrag = [];
}

// Footstep tap system --------------------------------------------------------
// Each goblin calls schedule/run for taps using its walk cycle. We keep a small
// per-goblin throttle so taps do not spam when frame timing fluctuates.
const lastTapByGoblin = new Map(); // goblinId -> last tap time (performance.now())

export function playTap(goblinId, intensity = 1) {
  // intensity 0..1 influences volume & pitch slightly
  const now = performance.now();
  const last = lastTapByGoblin.get(goblinId) || 0;
  // Minimum interval ~110ms (≈ ~9 taps/sec max) to avoid machine-gun
  if (now - last < 110) return;
  lastTapByGoblin.set(goblinId, now);
  const vol = 0.18 + 0.10 * intensity; // softer base
  // Lower overall pitch (deeper tap): shift base down & narrow random spread
  const rate = 0.78 + 0.12 * Math.random();
  // Prefer wood tap if loaded, fallback to original tap
  if (buffers.tap_wood) {
    playFromBuffer('tap_wood', { volume: vol, playbackRate: rate });
  } else {
    playFromBuffer('tap', { volume: vol, playbackRate: rate });
  }
}

export function clearTapState(goblinId) {
  lastTapByGoblin.delete(goblinId);
}

// Auto-bind a one-time user gesture to unlock/resume audio context
(function bindGesture(){
  const handler = () => { initAudio(); window.removeEventListener('pointerdown', handler); window.removeEventListener('keydown', handler); };
  window.addEventListener('pointerdown', handler, { once: true });
  window.addEventListener('keydown', handler, { once: true });
})();

export function audioReady() { return !!ctx; }
