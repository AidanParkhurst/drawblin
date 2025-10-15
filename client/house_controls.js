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
  container.innerHTML = `
    <button class="house-controls__toggle" title="Collapse">▾</button>
    <div class="house-controls__title"></div>
    <div class="house-controls__buttons"></div>
  `;
  document.body.appendChild(container);
  titleEl = container.querySelector('.house-controls__title');
  buttonsWrap = container.querySelector('.house-controls__buttons');
  const toggleEl = container.querySelector('.house-controls__toggle');

  container.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-mode]');
    if (!btn) return;
    const mode = btn.getAttribute('data-mode');
    if (onSelect) onSelect(mode);
  });

  if (toggleEl) {
    toggleEl.addEventListener('click', (e) => {
      e.preventDefault();
      const collapsed = container.classList.toggle('house-controls--collapsed');
      toggleEl.setAttribute('aria-expanded', String(!collapsed));
      toggleEl.textContent = collapsed ? '▸' : '▾';
    });
  }

  updateHouseControlsVisibility(false);
}

export function updateHouseControlsVisibility(show) {
  visible = !!show;
  if (!container) return;
  container.style.display = visible ? 'block' : 'none';
  try {
    document.body.classList.toggle('house-mode', visible);
  } catch {}
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
  if (titleEl) titleEl.textContent = `Mode: ${modeTitle(currentMode)}`;
  if (!buttonsWrap) return;
  const all = ['freedraw', 'guessinggame', 'quickdraw'];
  const choices = all.filter(m => m !== currentMode);
  buttonsWrap.innerHTML = '';
  for (const m of choices) {
    const btn = document.createElement('button');
    btn.className = 'house-controls__btn';
    btn.setAttribute('data-mode', m);
    btn.textContent = `Play ${modeTitle(m)}`;
    buttonsWrap.appendChild(btn);
  }
}

export default {
  mountHouseControls,
  updateHouseControlsVisibility,
  onHouseModeSelected,
  setHouseMode,
};
