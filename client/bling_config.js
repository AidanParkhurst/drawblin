// Central configuration for positioning & scaling bling across heterogeneous goblin sprites.
// Coordinate system: origin (0,0) is the center of the goblin body image as drawn.
// X units are in rendered body width; Y units are in rendered body height.
// So an anchor at {x:0, y:-0.5} is top-center; {x:0, y:0.5} is bottom-center.

// Per-shape anchor maps (normalized coordinates). Tweak these numbers (live with debug mode) instead of trial + refresh.
export const SHAPE_ANCHORS = {
  manny:   { headTop:{x:-0.1, y:-0.52}, face:{x:-0.1, y:-0.21}, chest:{x:-0.15, y:0.06}, waist:{x:-0.15, y:0.27}, offHand:{x:-0.7,y:0.2} },
  stanley: { headTop:{x:0.05, y:-0.55}, face:{x:0.1, y:-0.3}, chest:{x:0.05, y:-0.05}, waist:{x:0, y:0.2}, offHand:{x:-0.7,y:0.2} },
  ricky:   { headTop:{x:-0.1, y:-0.50}, face:{x:-0.1, y:-0.18}, chest:{x:-0.1, y:0.15}, waist:{x:-0.1, y:0.2}, offHand:{x:-0.7,y:0.2} },
  blimp:   { headTop:{x:-0.1, y:-0.6}, face:{x:-0.1, y:-0.3}, chest:{x:-0.1, y:0}, waist:{x:-0.1, y:0.2}, offHand:{x:-0.7,y:0.2} },
  hippo:   { headTop:{x:0, y:-0.6}, face:{x:0.05, y:-0.3}, chest:{x:0, y:0.02}, waist:{x:-0.05, y:0.2}, offHand:{x:-0.7,y:0.2} },
  grubby:  { headTop:{x:0, y:-0.53}, face:{x:0.1, y:-0.3}, chest:{x:0, y:0.08}, waist:{x:-0.05, y:0.2}, offHand:{x:-0.7,y:0.2} },
  bricky:  { headTop:{x:-0.05, y:-0.53}, face:{x:0, y:-0.22}, chest:{x:-0.02, y:0.07}, waist:{x:0, y:0.2}, offHand:{x:-0.7,y:0.2} },
  reggie:  { headTop:{x:-0.15, y:-0.55}, face:{x:-0.1, y:-0.34}, chest:{x:-0.15, y:-0.03}, waist:{x:-0.15, y:0.15}, offHand:{x:-0.7,y:0.2} },
  sticky:  { headTop:{x:-0.05, y:-0.6}, face:{x:0, y:-0.16}, chest:{x:0, y:0.1}, waist:{x:0, y:0.26}, offHand:{x:-0.75,y:0.2} },
  yogi:    { headTop:{x:-0.1, y:-0.55}, face:{x:-0.05, y:-0.25}, chest:{x:-0.05, y:0}, waist:{x:-0.09, y:0.22}, offHand:{x:-0.8,y:0.2} },
};

// Per-bling specifications: which anchor to attach to, base width as fraction of body width,
// extra offset deltas (dx, dy) in body units, and behavior flags.
export const BLING_SPECS = {
  crown:  { anchor:'headTop', width:0.55, dy:-0.04, bob:true },
  halo:   { anchor:'headTop', width:0.68, dy:-0.12, bob:true },
  shades: { anchor:'face',    width:0.78, dy:0.00 },
  chain:  { anchor:'chest',   width:0.95, dy:0.08 },
  belt:   { anchor:'waist',   width:0.88, dy:0.00 },
  trophy: { anchor:'offHand', width:0.55, dx:0.02, dy:-0.02, stick:true },
};

// Problem: sprite pixel width != actual torso/body width (noses, arms, negative space).
// Solution: introduce a per-shape "core body width" factor (relative to goblin.size) and optional
// per-bling overrides to narrow or widen individual accessories. This isolates sizing from raw sprite bounds.
//
// Heuristics (initial guesses):
// - slim shapes (ricky, sticky) => smaller core (0.82 - 0.85)
// - medium baseline (manny, stanley, reggie, yogi, bricky) => ~0.90
// - bulky (hippo, grubby, blimp) => slightly larger (0.95 - 1.00)
// Fine tune by toggling F7 and calling window.__blingAdjustWidth('shape','bling',delta)
export const SHAPE_WIDTH_PROFILE = {
  manny:   { core:0.70, perBling:{belt:0.55, chain:0.5} },
  stanley: { core:0.90, perBling:{chain:0.45} },
  ricky:   { core:0.83, perBling:{ chain:0.68, shades:0.70 } },
  blimp:   { core:0.98, perBling:{ chain:0.75 } },
  hippo:   { core:0.97, perBling:{ belt:1.07 }},
  grubby:  { core:0.95, perBling:{ belt:1.0 } },
  bricky:  { core:0.90, perBling:{ chain:0.65}},
  reggie:  { core:0.90, perBling:{ chain:0.75}},
  sticky:  { core:0.84, perBling:{ chain:0.55, shades:0.72 } },
  yogi:    { core:0.90, perBling:{ chain:0.65, shades:0.98}},
};

// Compute final bling width in pixels given shape & bling type.
export function computeBlingWidth(shape, blingType, baseSpecWidth, goblinSize) {
  const profile = SHAPE_WIDTH_PROFILE[shape] || { core:0.9 };
  const core = profile.core ?? 0.9;
  const per = profile.perBling?.[blingType];
  // Final fraction = base spec width * core * (optional per-bling override if present expressed as absolute fraction of size)
  // If per override exists treat it as absolute fraction of size (already tuned), else multiply.
  const fraction = per != null ? per : (baseSpecWidth * core);
  return goblinSize * fraction;
}

export function resolveBlingLayout(shape, type) {
  const anchors = SHAPE_ANCHORS[shape] || SHAPE_ANCHORS['manny'];
  const spec = BLING_SPECS[type];
  if (!spec) return null;
  const anchor = anchors[spec.anchor] || { x:0, y:0 };
  return { anchor, spec };
}

// Debug utilities: toggle window.__blingDebug = true to show anchor points & active bling box.
export function installBlingDebugOnce() {
  if (typeof window === 'undefined') return;
  if (window.__blingDebugInstalled) return;
  window.__blingDebugInstalled = true;
  window.addEventListener('keydown', (e) => {
    if (e.key === 'F7') { window.__blingDebug = !window.__blingDebug; }
  });
  console.info('[bling] Press F7 to toggle bling anchor debug overlay.');
  // Runtime helper to adjust core width: window.__blingAdjustWidth('ricky', null, +0.01)
  window.__blingAdjustWidth = (shape, bling, delta) => {
    const p = SHAPE_WIDTH_PROFILE[shape];
    if (!p) { console.warn('No shape', shape); return; }
    if (bling) {
      p.perBling = p.perBling || {}; p.perBling[bling] = (p.perBling[bling] ?? BLING_SPECS[bling]?.width ?? 0.8) + delta;
      console.log('Updated perBling width', shape, bling, p.perBling[bling]);
    } else {
      p.core = (p.core ?? 0.9) + delta;
      console.log('Updated core width', shape, p.core);
    }
  };
  window.__blingDumpProfile = () => JSON.parse(JSON.stringify(SHAPE_WIDTH_PROFILE));
  // Expose anchors & specs for direct console tweaking: e.g. SHAPE_ANCHORS.manny.headTop.y -= 0.01
  Object.defineProperty(window, 'SHAPE_ANCHORS', { value: SHAPE_ANCHORS, configurable: false, writable: false });
  Object.defineProperty(window, 'BLING_SPECS', { value: BLING_SPECS, configurable: false, writable: false });
  Object.defineProperty(window, 'SHAPE_WIDTH_PROFILE', { value: SHAPE_WIDTH_PROFILE, configurable: false, writable: false });
  console.info('[bling] Globals exposed: SHAPE_ANCHORS, BLING_SPECS, SHAPE_WIDTH_PROFILE');
  // Quick anchor tweak helper: window.__blingNudgeAnchor('manny','headTop',{y:-0.01})
  window.__blingNudgeAnchor = (shape, anchor, deltaObj) => {
    const map = SHAPE_ANCHORS[shape];
    if (!map) { console.warn('No shape', shape); return; }
    const a = map[anchor];
    if (!a) { console.warn('No anchor', anchor, 'for shape', shape); return; }
    if (deltaObj.x) a.x += deltaObj.x;
    if (deltaObj.y) a.y += deltaObj.y;
    console.log('Anchor updated', shape, anchor, a);
  };
}
