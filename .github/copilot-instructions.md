# Drawblin – AI coding agent notes

Purpose: help an AI be productive immediately in this repo by knowing the architecture, workflows, and project-specific patterns. Keep edits aligned with these conventions.

## Big picture
- Client: static p5.js app under `client/` built with Vite (multi-page). Deployed to GitHub Pages via `gh-pages` (`npm run deploy`). Config in `vite.config.js` with explicit HTML inputs (index, login, house, shop, account, tos, privacy).
- Realtime server: Node/Express + `ws` in `server/server.js`. WebSocket endpoints: `/freedraw`, `/quickdraw`, `/guessinggame`, `/house?u=<ownerSlug>&me=<userId>`. HTTP: Stripe webhook `POST /webhook/stripe` (raw body), subscription APIs under `/api/subscription/*` using Supabase auth Bearer tokens.
- Payments/entitlements: Stripe events recorded in Supabase; entitlements granted idempotently (see `server/payments.js`). Env loading in `server/env.js`. Admin Supabase client in `server/supabase.js` (used by server and payments logic).

## Dev workflow
- Client dev: `npm run dev` (serves `client/`). Add new top-level pages by updating `build.rollupOptions.input` in `vite.config.js`.
- Server dev: `npm run server` (listens on `HOST:PORT`, defaults `0.0.0.0:3000`). For local WS testing, set `client/network.js` BASE_URL to `ws://localhost:3000` (the file has a commented local URL next to the production one).
- Deploy static site: `npm run deploy` (builds to `dist/` and publishes to `gh-pages`). Static assets (including `CNAME`) live in `client/public/` and are copied as-is.
- Stripe webhooks locally: require raw body; run Stripe CLI: `stripe listen --forward-to localhost:3000/webhook/stripe`. Ensure env vars exist (see README and `server/env.js`).

## Server architecture & patterns
- Lobbies: base class `server/lobbies/Lobby.js` (tracks `clients`, maps sockets to user ids, sanitizes inputs, broadcasts). Game types extend it (e.g., `FreeDrawLobby.js`). New modes should extend Lobby, then update `validPaths` and `findOrCreateLobby()` in `server/server.js`.
- House lobbies: one lobby per owner. Owner slug is `shortUid(user.id)` = first 12 hex chars of Supabase UUID (lowercase, no dashes). Guests can only join if owner is present. Owners can switch modes via `{type: 'house_switch_mode', mode, requesterUid}`; server verifies ownership and migrates clients (`switchHouseLobbyType`).
- Security: server sanitizes chat/name, HTML-escapes outgoing content, and rate-limits by socket and IP (token buckets) for `chat` and `update` events.
- Subscription APIs: `/api/subscription/status|cancel|portal` require `Authorization: Bearer <supabase_access_token>`; server resolves the user via admin Supabase.

## Client architecture & patterns
- Entry `client/index.js` orchestrates p5 setup, portals, UI, and networking. Networking is in `client/network.js` (single WS connection, `connect(gameType, query)` and `sendMessage`).
- Message shapes are compact and sparse:
  - Client → Server update: `{ type:'update', g:{ i:id, x, y, c:{x,y}, co:[r,g,b], ui:[r,g,b], t:tool, n:name, s:shape, p:petKey, lc:base64Lines? } }`. Include lines only when changed or when newcomers joined.
  - Server → Client mirrors updates and emits control messages: `user_left`, `game_state`, `prompt_update`, `point_scored`, `house_unavailable`, `house_mode`.
- Drawing data: compact line packing in `encodeLinesCompact`/`decodeLinesCompact` in `client/index.js` using a base64 wire format; a global ordered registry deduplicates and renders lines across users. Respect per-mode visibility rules when rendering (QuickDraw/GuessingGame).
- Entitlements gate features (pets/bling/profile UI). Fetch via `client/entitlements.js`; only set `petKey` when allowed.

## Payments & entitlements
- Env in `server/env.js` (Stripe keys, Supabase URL/service key, and Stripe price IDs). Mapping from Stripe price IDs → entitlements is built dynamically in `server/payments.js` from env vars. To add a new entitlement, add an env var `STRIPE_PRICE_*`, include it in `env.js` exports, and it will be mapped in `payments.js`; update DB schema if needed.
- Webhook handling is order-agnostic: both `checkout.session.completed` and `payment_intent.succeeded` merge into a single `payments` row, then call an idempotent `tryGrantEntitlements()`.

## Conventions & gotchas
- Keep updates sparse and compact; prefer `g` short keys. Names are max ~40 chars, chat ~240; server trims and escapes.
- Do not break Stripe raw body parsing by adding JSON middleware before `/webhook/stripe`.
- Adding pages: place HTML in `client/` root and add to `vite.config.js` inputs; static assets go in `client/public/`.
- When adding a new game mode, wire it end-to-end: Lobby subclass, `validPaths`/creation, client `connect('mymode')`, and client UI/visibility logic.

If anything here is unclear or seems out of date (e.g., BASE_URL or new modes), tell me what you’re changing and I’ll refine these notes.
