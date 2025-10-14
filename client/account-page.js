import { ready as authReady, isAuthConfigured, getUser, getClient } from './auth.js';
import { fetchEntitlements } from './entitlements.js';

function el(tag, attrs = {}, children = []) {
  const e = document.createElement(tag);
  for (const [k,v] of Object.entries(attrs)) {
    if (k === 'class') e.className = v;
    else if (k === 'text') e.textContent = v;
    else if (k.startsWith('on') && typeof v === 'function') e.addEventListener(k.slice(2), v);
    else e.setAttribute(k, v);
  }
  for (const c of [].concat(children)) { if (c) e.appendChild(typeof c === 'string' ? document.createTextNode(c) : c); }
  return e;
}

async function render() {
  const mount = document.getElementById('account-content');
  if (!mount) return;
  mount.innerHTML = '';

  if (!isAuthConfigured()) {
    mount.appendChild(el('div', { class: 'account-card center' }, [el('div', { class: 'field-value', text: 'Auth not configured.' })]));
    return;
  }

  await authReady();
  const user = getUser();
  if (!user) {
    const btn = el('button', { class: 'btn-primary' , text: 'Sign in to view account details' });
    btn.addEventListener('click', () => { window.location.assign('./login'); });
    const wrap = el('div', { class: 'account-card center' }, [btn]);
    mount.appendChild(wrap);
    return;
  }

  // Signed-in — fetch entitlements and profile name from profiles table
  const ents = await fetchEntitlements(true) || {};
  let profileName = '';
  try {
    const client = getClient();
    if (client) {
      const { data, error } = await client.from('profiles').select('name').eq('id', user.id).maybeSingle();
      if (!error) profileName = (data?.name || '').trim();
    }
  } catch {}
  const identityBlock = el('section', { class: 'identity-block' }, [
    el('div', { class: 'identity-grid' }, [
      el('div', {}, [
        el('div', { class: 'field-label', text: 'Goblin Name' }),
        el('div', { class: 'field-value', text: profileName || '(not set)' })
      ]),
      el('div', {}, [
        el('div', { class: 'field-label', text: 'Email' }),
        el('div', { class: 'field-value', text: (user.email || '(unknown)') })
      ])
    ])
  ]);

  // Membership card
  let premiumText = 'Not a premium member';
  let renewalText = '';
  // We don't track renewal in client; show a hint or hook later to a server endpoint if needed
  if (ents?.has_premium) {
    premiumText = 'Premium member';
    renewalText = 'Renews automatically';
  }
  const cancelBtn = ents?.has_premium ? el('button', { class: 'btn-outline', text: 'Cancel membership' }) : null;
  let manageBtn = null;
  if (cancelBtn) {
    cancelBtn.addEventListener('click', async () => {
      cancelBtn.disabled = true;
      cancelBtn.textContent = 'Cancelling...';
      try {
        const token = (await getClient())?.auth?.session()?.access_token;
        const resp = await fetch('/api/subscription/cancel', { method: 'POST', headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' } });
        if (!resp.ok) {
          const j = await resp.json().catch(()=>({}));
            alert('Cancel failed: ' + (j.error || resp.status));
        } else {
          const j = await resp.json();
          alert('Subscription set to cancel at period end.');
          // Re-render to reflect state
          await render();
          return;
        }
      } catch (e) {
        alert('Cancel error: ' + (e?.message || e));
      } finally {
        cancelBtn.disabled = false;
        cancelBtn.textContent = 'Cancel membership';
      }
    });
    manageBtn = el('button', { class: 'btn-outline', text: 'Manage billing' });
    manageBtn.addEventListener('click', async () => {
      manageBtn.disabled = true; manageBtn.textContent = 'Opening portal...';
      try {
        const token = (await getClient())?.auth?.session()?.access_token;
        const resp = await fetch('/api/subscription/portal', { method: 'POST', headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' } });
        if (!resp.ok) {
          const j = await resp.json().catch(()=>({}));
          alert('Portal error: ' + (j.error || resp.status));
        } else {
          const j = await resp.json();
          if (j.url) window.location.href = j.url;
        }
      } catch (e) {
        alert('Portal error: ' + (e?.message || e));
      } finally {
        manageBtn.disabled = false; manageBtn.textContent = 'Manage billing';
      }
    });
  }
  const memberRow = el('div', { class: 'account-card account-card--row account-row' }, [
    el('div', {}, [
      el('div', { class: 'account-row-title', text: premiumText }),
      el('div', { class: 'account-row-sub', text: renewalText }),
    ]),
    cancelBtn,
    manageBtn
  ].filter(Boolean));

  // Packs as separate cards; attempt to resolve purchase dates from entitlement_events
  const packCards = [];
  const addPack = (title, purchasedAt) => {
    const row = el('div', { class: 'account-card account-card--row account-row' }, [
      el('div', {}, [
        el('div', { class: 'account-row-title', text: title }),
        el('div', { class: 'account-row-sub', text: purchasedAt ? `Purchased on ${purchasedAt}` : 'Included with Premium' })
      ])
    ]);
    packCards.push(row);
  };
  // If user has any packs, try to fetch their grant dates from entitlement_events
  const hasAnyPacks = Boolean(ents?.pet_pack || ents?.win_bling_pack || ents?.more_goblins_pack);
  let packDates = { pet_pack: null, win_bling_pack: null, more_goblins_pack: null };
  if (hasAnyPacks) {
    try {
      const client = getClient();
      if (client) {
        const { data, error } = await client
          .from('entitlement_events')
          .select('entitlement, created_at')
          .eq('user_id', user.id)
          .eq('kind', 'grant')
          .in('entitlement', ['pet_pack','win_bling_pack','more_goblins_pack']);
        if (!error && Array.isArray(data)) {
          // Use earliest grant date per entitlement
          for (const row of data) {
            const key = row.entitlement;
            const prev = packDates[key];
            const ts = row.created_at ? new Date(row.created_at) : null;
            if (ts) {
              if (!prev || ts < prev) packDates[key] = ts;
            }
          }
        }
      }
    } catch {}
  }
  const fmt = (d) => d instanceof Date ? d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' }) : null;
  // Build pack cards: show Purchased on <date> if user owns that pack; otherwise include if premium
  if (ents?.pet_pack || ents?.has_premium) addPack('Companion Critter Collection', ents?.pet_pack ? fmt(packDates.pet_pack) : null);
  if (ents?.win_bling_pack || ents?.has_premium) addPack('Big Win Bling Bundle', ents?.win_bling_pack ? fmt(packDates.win_bling_pack) : null);
  if (ents?.more_goblins_pack || ents?.has_premium) addPack('More Goblins', ents?.more_goblins_pack ? fmt(packDates.more_goblins_pack) : null);
  if (!packCards.length) packCards.push(el('div', { class: 'muted', text: 'No packs purchased' }));

  // Headers outside cards
  mount.appendChild(identityBlock);
  mount.appendChild(el('h2', { class: 'account-h2', text: 'Membership' }));
  mount.appendChild(memberRow);
  mount.appendChild(el('h2', { class: 'account-h2', text: 'Packs' }));
  for (const c of packCards) mount.appendChild(c);
}

window.addEventListener('DOMContentLoaded', render);
window.addEventListener('auth:user-changed', render);
