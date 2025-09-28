// Lightweight client-side fetch & cache of user entitlements.
// Requires Supabase auth to be configured.
import { getClient, getUser, isAuthConfigured, ready as authReady } from './auth.js';

let _cache = null; // { has_premium, pet_pack, win_bling_pack, more_goblins_pack, fetched_at }
let _pending = null;

export async function fetchEntitlements(force = false) {
  if (!isAuthConfigured()) return null;
  await authReady();
  const user = getUser();
  if (!user) { _cache = null; return null; }
  if (!force && _cache && Date.now() - _cache.fetched_at < 30000) return _cache; // 30s cache
  if (_pending) return _pending;
  const client = getClient();
  if (!client) return null;
  _pending = client.from('user_entitlements')
    .select('has_premium, pet_pack, win_bling_pack, more_goblins_pack')
    .eq('user_id', user.id)
    .maybeSingle()
    .then(({ data, error }) => {
      _pending = null;
      if (error) { console.warn('fetchEntitlements error:', error.message); return null; }
      _cache = { ...(data || {}), fetched_at: Date.now() };
      return _cache;
    });
  return _pending;
}

export function entitlementCache() { return _cache; }

// Subscribe to auth changes to clear cache
if (typeof window !== 'undefined') {
  window.addEventListener('auth:user-changed', () => { _cache = null; });
}

export function hasPremium() { return Boolean(_cache?.has_premium); }
export function hasPetPack() { return Boolean(_cache?.pet_pack || _cache?.has_premium); }
export function hasBlingPack() { return Boolean(_cache?.win_bling_pack || _cache?.has_premium); }

export default { fetchEntitlements, entitlementCache, hasPremium, hasPetPack, hasBlingPack };
