// Minimal Supabase auth wrapper
// Non-invasive: game works without calling anything here.
import { createClient } from '@supabase/supabase-js';

// Lazy-initialized singleton
let supabase = null;
let currentSession = null;
let currentUser = null;
let _inited = false;

// Read keys from global injected by index.html (vite env replacement optional later)
function getConfig() {
  const url = import.meta.env?.VITE_SUPABASE_URL;
  const anon = import.meta.env?.VITE_SUPABASE_ANON_KEY;
  console.log("Supabase Config:", { url, anon });
  if (!url || !anon) return null;
  return { url, anon };
}

export function isAuthConfigured() {
  return !!getConfig();
}

export function getClient() {
  if (supabase) return supabase;
  const cfg = getConfig();
  if (!cfg) return null;
  supabase = createClient(cfg.url, cfg.anon);
  return supabase;
}

export async function initAuth() {
  if (_inited) return { user: currentUser, session: currentSession };
  _inited = true;
  const client = getClient();
  if (!client) return { user: null, session: null };

  const { data } = await client.auth.getSession();
  currentSession = data?.session || null;
  currentUser = currentSession?.user || null;

  // Subscribe to auth changes
  client.auth.onAuthStateChange((_event, session) => {
    currentSession = session;
    currentUser = session?.user || null;
    window.dispatchEvent(new CustomEvent('auth:user-changed', { detail: { user: currentUser, session } }));
  });

  return { user: currentUser, session: currentSession };
}

export function getUser() {
  return currentUser;
}

export function getSession() {
  return currentSession;
}

export async function signInWithGoogle(redirectTo) {
  const client = getClient();
  if (!client) throw new Error('Supabase auth not configured');
  return client.auth.signInWithOAuth({ provider: 'google', options: { redirectTo } });
}

export async function signOut() {
  const client = getClient();
  if (!client) return;
  await client.auth.signOut();
}

export async function signUpWithEmail(email, password) {
  const client = getClient();
  if (!client) throw new Error('Supabase auth not configured');
  return client.auth.signUp({ email, password });
}

export async function signInWithEmail(email, password) {
  const client = getClient();
  if (!client) throw new Error('Supabase auth not configured');
  return client.auth.signInWithPassword({ email, password });
}

// Convenience: await ready before use in other modules
export async function ready() {
  return initAuth();
}

// Optional: expose minimal state for UI badges
export function isLoggedIn() {
  return !!currentUser;
}

export default {
  initAuth,
  getClient,
  getUser,
  getSession,
  isLoggedIn,
  isAuthConfigured,
  signInWithGoogle,
  signUpWithEmail,
  signInWithEmail,
  signOut,
  ready,
  getProfileName,
  upsertProfileName,
};

// Bind to a fixed login button in index.html (id: login-button)
async function bindLoginButton() {
  await initAuth();
  const btn = document.getElementById('login-button');
  if (!btn) return; // Silent if not present

  const menuEl = document.getElementById('account-menu');
  const nameInput = document.getElementById('account-name-input');
  const saveBtn = document.getElementById('account-save-name');
  const signoutBtn = document.getElementById('account-signout');
  // Prevent UI clicks from reaching p5 global mouse handlers
  const swallow = (el) => {
    if (!el) return;
    const isInteractive = (e) => {
      const t = e.target;
      return t && t.closest && t.closest('input, textarea, select, button, [contenteditable="true"]');
    };
    const cancel = (e) => { 
      e.stopPropagation(); 
      if (!isInteractive(e) && e.cancelable) e.preventDefault(); 
    };
    const stopOnly = (e) => { e.stopPropagation(); };
    // Block down/move that could start drawing; allow click/keyup to reach internal handlers
    ['pointerdown','pointermove','mousedown','mousemove','touchstart','touchmove','wheel','dragstart']
      .forEach((t) => el.addEventListener(t, cancel, { passive: false }));
    // Optionally stop bubbling of mouseup/touchend without canceling default
    ['pointerup','mouseup','touchend']
      .forEach((t) => el.addEventListener(t, stopOnly));
  };
  // Swallow everything inside the menu; it should never leak to the canvas
  swallow(menuEl);
  // For the button: allow its click to work, but block pointer/mouse from reaching canvas
  if (btn) {
    const cancel = (e) => { e.stopPropagation(); if (e.cancelable) e.preventDefault(); };
    const stopOnly = (e) => { e.stopPropagation(); };
    // Prevent drawing start but keep clicks functional
    ['pointerdown','pointermove','mousedown','mousemove','touchstart','touchmove','wheel','dragstart']
      .forEach((t) => btn.addEventListener(t, cancel, { passive: false }));
    ['pointerup','mouseup','touchend']
      .forEach((t) => btn.addEventListener(t, stopOnly));
  }
  const toggleMenu = (show) => { if (!menuEl) return; menuEl.style.display = show ? 'block' : 'none'; };
  const closeMenu = () => toggleMenu(false);
  const openMenu = async () => {
    const user = getUser();
    if (!user || !menuEl) return;
    toggleMenu(true);
    try {
      const profName = await getProfileName();
      if (nameInput) nameInput.value = profName?.trim() || '';
    } catch {
      if (nameInput) nameInput.value = '';
    }
    // One-time outside click closer per open
    const onDocClick = (ev) => {
      if (!menuEl) return;
      if (ev.target === btn || menuEl.contains(ev.target)) return;
      closeMenu();
      document.removeEventListener('mousedown', onDocClick);
    };
    setTimeout(() => document.addEventListener('mousedown', onDocClick), 0);
  };

  const render = (u) => {
    btn.textContent = u ? 'Account' : 'Login';
    if (u) {
      btn.removeAttribute('href');
      btn.style.cursor = 'pointer';
      btn.onclick = (e) => { e.preventDefault(); openMenu(); };
    } else {
      closeMenu();
      btn.setAttribute('href', './login');
      btn.onclick = null;
    }
    // Optional tooltip
    if (u?.email) btn.title = u.email; else btn.removeAttribute('title');
  };

  render(getUser());
  window.addEventListener('auth:user-changed', (evt) => { closeMenu(); render(evt.detail?.user || null); });
  if (signoutBtn) {
    signoutBtn.onclick = async (e) => { e.preventDefault(); await signOut(); closeMenu(); };
  }
  if (saveBtn && nameInput) {
    const submit = async () => {
      const newName = (nameInput.value || '').trim().slice(0, 40);
      if (!newName) return;
      const saved = await upsertProfileName(newName);
      if (saved) {
        // Notify listeners (e.g., index.js to update goblin name)
        window.dispatchEvent(new CustomEvent('profile:name-updated', { detail: { name: saved } }));
      }
    };
    saveBtn.onclick = async (e) => { e.preventDefault(); await submit(); };
    nameInput.addEventListener('keydown', async (e) => {
      if (e.key === 'Enter') { e.preventDefault(); await submit(); }
    });
  }
}

// Attempt immediate bind and also on DOMContentLoaded
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', bindLoginButton, { once: true });
} else {
  // eslint-disable-next-line no-console
  bindLoginButton();
}

// --- Profile helpers (names) ---
// Expected Supabase schema: table "profiles" with columns: id (uuid, PK, references auth.users.id), name (text)
export async function getProfileName() {
  const client = getClient();
  if (!client || !currentUser) return null;
  const { data, error } = await client
    .from('profiles')
    .select('name')
    .eq('id', currentUser.id)
    .single();
  if (error) {
    console.warn('getProfileName error:', error.message);
    return null;
  }
  return data?.name || null;
}

export async function upsertProfileName(name) {
  const client = getClient();
  if (!client || !currentUser) return null;
  const { data, error } = await client
    .from('profiles')
    .upsert({ id: currentUser.id, name }, { onConflict: 'id' })
    .select('name')
    .single();
  if (error) {
    console.warn('upsertProfileName error:', error.message);
    return null;
  }
  return data?.name || null;
}
