// server/env.js
// Centralized environment variable loading & validation.
// Uses dotenv in development; on production platforms you can set real env vars.
import dotenv from 'dotenv';

if (!process.env.NO_DOTENV) {
  dotenv.config();
}

function requireEnv(name, { optional = false } = {}) {
  const v = process.env[name];
  if (!v && !optional) {
    console.warn(`[env] Missing required environment variable ${name}`);
  }
  return v;
}

export const STRIPE_WEBHOOK_SECRET = requireEnv('STRIPE_WEBHOOK_SECRET', { optional: false });
export const STRIPE_SECRET_KEY = requireEnv('STRIPE_SECRET_KEY', { optional: false });
export const SUPABASE_SERVICE_KEY = requireEnv('SUPABASE_SERVICE_KEY', { optional: false });
export const SUPABASE_URL = requireEnv('SUPABASE_URL', { optional: false });

// Optional: specific price IDs -> entitlements
export const STRIPE_PRICE_PET_PACK = requireEnv('STRIPE_PRICE_PET_PACK', { optional: true });
export const STRIPE_PRICE_WIN_BLING_PACK = requireEnv('STRIPE_PRICE_WIN_BLING_PACK', { optional: true });
export const STRIPE_PRICE_MORE_GOBLINS_PACK = requireEnv('STRIPE_PRICE_MORE_GOBLINS_PACK', { optional: true });
export const STRIPE_PRICE_PREMIUM_SUB = requireEnv('STRIPE_PRICE_PREMIUM_SUB', { optional: true });

export function summarizeEnv() {
  return {
    STRIPE_WEBHOOK_SECRET: STRIPE_WEBHOOK_SECRET ? 'set' : 'missing',
    STRIPE_SECRET_KEY: STRIPE_SECRET_KEY ? 'set' : 'missing',
    SUPABASE_SERVICE_KEY: SUPABASE_SERVICE_KEY ? 'set' : 'missing',
    SUPABASE_URL: SUPABASE_URL ? 'set' : 'missing'
    ,PET_PACK: STRIPE_PRICE_PET_PACK ? 'set' : 'missing'
    ,WIN_BLING_PACK: STRIPE_PRICE_WIN_BLING_PACK ? 'set' : 'missing'
    ,MORE_GOBLINS_PACK: STRIPE_PRICE_MORE_GOBLINS_PACK ? 'set' : 'missing'
    ,PREMIUM_SUB: STRIPE_PRICE_PREMIUM_SUB ? 'set' : 'missing'
  };
}
