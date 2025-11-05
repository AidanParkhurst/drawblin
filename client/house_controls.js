// Simple left-side host controls for House lobbies
// Renders a small panel with buttons to switch lobby mode.

let container = null;
let visible = false;
let onSelect = null;
let titleEl = null;
let buttonsWrap = null;
let currentMode = null;

export function mountHouseControls() {
  if (container) return; // already mounted
    container = document.createElement('div');
    container.id = 'house-controls';
    // Title is an opener button (like Play). Buttons appear in a dropdown below when opened.
    container.innerHTML = `
      <button class="house-controls__title" aria-expanded="false">Free Draw</button>
      <div class="house-controls__buttons"></div>
    `;
  document.body.appendChild(container);
  // On mobile we want the house controls to sit below the chat/header so they don't overlap.
  const updateMobilePosition = () => {
    try {
      if (window.innerWidth <= 720) {
        const chatEl = document.getElementById('chat');
        let top = 8;
        if (chatEl) {
          const r = chatEl.getBoundingClientRect();
          // If body has house-mode class (controls visible), place the control
          // on the same top row as the chat (centered horizontally). Otherwise
          // place it a bit below the chat so it doesn't overlap.
          if (typeof document !== 'undefined' && document.body && document.body.classList.contains('house-mode')) {
            top = Math.max(8, Math.round(r.top));
            // center horizontally when showing house-mode
            container.style.left = '50%';
            container.style.transform = 'translateX(-50%)';
          } else {
            top = Math.max(8, Math.round(r.bottom + 8));
            container.style.left = '';
            container.style.transform = '';
          }
        }
        container.style.top = `${top}px`;
      } else {
        // Reset to stylesheet default when not mobile
        container.style.top = '';
        container.style.left = '';
        container.style.transform = '';
      }
    } catch (e) { /* ignore measurement errors */ }
  };
  // Reposition on resize so orientation changes update placement
  window.addEventListener('resize', updateMobilePosition);
  // Run once now
  updateMobilePosition();
    titleEl = container.querySelector('.house-controls__title');
    buttonsWrap = container.querySelector('.house-controls__buttons');

    // Prevent pointer events from leaking through to the canvas (match other menus)
    const swallow = (el) => {
      if (!el) return;
      const isInteractive = (e) => {
        const t = e.target;
        return t && t.closest && t.closest('input, textarea, select, button, a, [role="button"], [contenteditable="true"]');
      };
      const cancel = (e) => { e.stopPropagation(); if (!isInteractive(e) && e.cancelable) e.preventDefault(); };
      const stopOnly = (e) => { e.stopPropagation(); };
      ['pointerdown','mousedown','touchstart','touchmove','wheel','dragstart']
        .forEach((t) => el.addEventListener(t, cancel, { passive: false }));
      ['pointerup','mouseup','touchend']
        .forEach((t) => el.addEventListener(t, stopOnly));
    };
    // Swallow everything inside the control so interactions don't start drawing on the canvas
    swallow(container);

    // Clicking the title toggles the dropdown of mode buttons (behaves like the Play menu)
    if (titleEl) {
      // Stop propagation on pointer/touch events for the title so they don't reach canvas
      ['pointerdown','mousedown','touchstart','touchmove','wheel','dragstart']
        .forEach((t) => titleEl.addEventListener(t, (ev) => ev.stopPropagation(), { passive: false }));
      ['pointerup','mouseup','touchend']
        .forEach((t) => titleEl.addEventListener(t, (ev) => ev.stopPropagation()));

      // Open/close helpers that also manage outside click / Escape handlers
      const closeMenu = () => {
        container.classList.remove('open');
        if (titleEl) titleEl.setAttribute('aria-expanded', 'false');
        if (buttonsWrap) buttonsWrap.style.display = 'none';
        try { document.removeEventListener('mousedown', onDocClick); } catch (e) {}
        try { document.removeEventListener('keydown', onKeyDown); } catch (e) {}
      };
      const openMenu = () => {
        container.classList.add('open');
        if (titleEl) titleEl.setAttribute('aria-expanded', 'true');
        if (buttonsWrap) buttonsWrap.style.display = 'flex';
        // One-time outside click closer per open (use mousedown for immediacy)
        setTimeout(() => {
          try { document.addEventListener('mousedown', onDocClick); } catch (e) {}
          try { document.addEventListener('keydown', onKeyDown); } catch (e) {}
        }, 0);
      };

      // Handlers need to be hoisted so we can remove them later
      const onDocClick = (ev) => {
        if (!container) return;
        if (ev.target === titleEl || container.contains(ev.target)) return;
        closeMenu();
      };
      const onKeyDown = (ev) => { if (ev.key === 'Escape') closeMenu(); };

      titleEl.addEventListener('click', (e) => {
        e.preventDefault(); e.stopPropagation();
        if (container.classList.contains('open')) closeMenu(); else openMenu();
      });
    }

    // Click handler for option buttons
    container.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-mode]');
      if (!btn) return;
      const mode = btn.getAttribute('data-mode');
      if (onSelect) onSelect(mode);
      // Close dropdown after selection
      container.classList.remove('open');
      if (titleEl) titleEl.setAttribute('aria-expanded', 'false');
      if (buttonsWrap) buttonsWrap.style.display = 'none';
    });

    updateHouseControlsVisibility(false);

  
}

export function updateHouseControlsVisibility(show) {
  visible = !!show;
  if (!container) return;
  container.style.display = visible ? 'block' : 'none';
  try {
    document.body.classList.toggle('house-mode', visible);
  } catch {}
  // Ensure position is updated when visibility changes (mobile)
  try { if (typeof window !== 'undefined' && window.innerWidth <= 720) {
    const chatEl = document.getElementById('chat');
    if (chatEl && container) {
      const r = chatEl.getBoundingClientRect();
      if (typeof document !== 'undefined' && document.body && document.body.classList.contains('house-mode')) {
        container.style.top = `${Math.max(8, Math.round(r.top))}px`;
        container.style.left = '50%';
        container.style.transform = 'translateX(-50%)';
      } else {
        container.style.top = `${Math.max(8, Math.round(r.bottom + 8))}px`;
        container.style.left = '';
        container.style.transform = '';
      }
    }
  } } catch (e) {}
}

export function onHouseModeSelected(handler) {
  onSelect = typeof handler === 'function' ? handler : null;
}

function modeTitle(mode) {
  switch ((mode || '').toLowerCase()) {
  case 'quickdraw': return 'Team Draw';
  case 'guessinggame': return 'Guessing Game';
  case 'freedraw':
  default: return 'Free Draw';
  }
}

export function setHouseMode(mode) {
  currentMode = (mode || '').toLowerCase();
  if (!container) return;
  if (titleEl) titleEl.textContent = `${modeTitle(currentMode)}`;
  if (!buttonsWrap) return;
  const all = ['freedraw', 'guessinggame', 'quickdraw'];
  const choices = all.filter(m => m !== currentMode);
  buttonsWrap.innerHTML = '';
  for (const m of choices) {
    const btn = document.createElement('button');
    btn.className = 'house-controls__btn';
    btn.setAttribute('data-mode', m);
    // Button text should be the mode title only ("Play" is implied)
    btn.textContent = modeTitle(m);
    buttonsWrap.appendChild(btn);
  }
}

export default {
  mountHouseControls,
  updateHouseControlsVisibility,
  onHouseModeSelected,
  setHouseMode,
};
