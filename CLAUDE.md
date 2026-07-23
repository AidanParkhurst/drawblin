# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

Drawblin(s) — a real-time multiplayer p5.js drawing game. Players control a goblin character
and draw around it; modes include Free Draw, Quick Draw (draw-and-vote), and a Guessing Game
(draw a prompt, others guess). No account required to play; optional Supabase auth unlocks
custom names and private "house" lobbies. Cosmetic purchases via Stripe. Frontend is static
(GitHub Pages, custom domain drawbl.in); backend is a Node WS/HTTP server on an Oracle Cloud VPS.

## Commands

- `npm run dev` — Vite dev server for `client/`.
- `npm run devhost` — same, bound to `--host` (for testing from another device, e.g. a phone).
- `npm run build` — production build (`NODE_ENV=production`) to `dist/`.
- `npm run deploy` — build then publish `dist/` to `gh-pages`.
- `npm run server` — run the realtime backend (`server/server.js`), listens on `HOST:PORT` (default `0.0.0.0:3000`).
- No test suite or linter is configured.

For local client↔server testing, edit `client/network.js`: comment/uncomment `BASE_URL` between
the `ws://localhost:3000` line and the production `wss://api.drawbl.in` line.

Stripe webhooks locally require the Stripe CLI: `stripe listen --forward-to localhost:3000/webhook/stripe`.
Env vars are loaded via `server/env.js`; see `AUTH.md` for the Supabase client vars
(`VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` in a repo-root `.env.local`).

## Architecture

**Client** (`client/`): static p5.js app, multi-page, built with Vite. Pages are declared
explicitly in `vite.config.js` (`build.rollupOptions.input`) — add new top-level HTML pages
there, not just as loose files. Static assets (including `CNAME`) live in `client/public/` and
are copied as-is. `vite.config.js` serves from repo root env (`envDir: ".."`) and uses base `/`
in production vs `./` in dev.

**Server** (`server/server.js`): Node/Express + `ws`. WebSocket endpoints: `/freedraw`,
`/quickdraw`, `/guessinggame`, plus mobile variants `/freedraw_mobile`, `/quickdraw_mobile`,
`/guessinggame_mobile`, and `/house?u=<ownerSlug>&me=<userId>`. HTTP: Stripe webhook
`POST /webhook/stripe` (needs raw body — never add JSON body-parsing middleware ahead of it),
and `/api/subscription/status|cancel|portal` (require `Authorization: Bearer <supabase_access_token>`,
resolved via the admin Supabase client in `server/supabase.js`).

**Lobbies** (`server/lobbies/`): base class `Lobby.js` tracks clients, maps sockets to user ids,
sanitizes input, and broadcasts. Each game mode has both a desktop and `*Mobile` lobby subclass
(`FreeDrawLobby`/`FreeDrawMobileLobby`, `QuickDrawLobby`/`QuickDrawMobileLobby`,
`GuessingGameLobby`/`GuessingGameMobileLobby`). Adding a mode means: subclass `Lobby`, add its
path(s) to `validPaths` and the switch in `findOrCreateLobby()` in `server/server.js`, then wire
the client `connect(gameType)` call and any mode-specific visibility/UI logic.

**House lobbies**: one lobby per owner, keyed by `shortUid(user.id)` (first 12 hex chars of the
Supabase UUID, lowercase, no dashes). Guests can only join while the owner is present. Owners
switch modes via `{type: 'house_switch_mode', mode, requesterUid}`; the server verifies ownership
before migrating clients (`switchHouseLobbyType`).

**Client networking** (`client/network.js`): single WebSocket connection via `connect(gameType, query)`
/ `sendMessage`. Entry point `client/index.js` orchestrates p5 setup, portals, UI, and networking.

Wire format is intentionally compact/sparse — preserve the short keys when touching this:
- Client → Server `update`: `{ type:'update', g:{ i:id, x, y, c:{x,y}, co:[r,g,b], ui:[r,g,b], t:tool, n:name, s:shape, p:petKey, lc:base64Lines? } }`. `lc` is included only when lines changed or a newcomer joined.
- Server → Client mirrors updates and emits control messages: `user_left`, `game_state`, `prompt_update`, `point_scored`, `house_unavailable`, `house_mode`.
- Drawing lines use a compact base64 packing (`encodeLinesCompact`/`decodeLinesCompact` in `client/index.js`); a global ordered registry dedupes and renders lines across users. Respect per-mode visibility rules (Quick Draw / Guessing Game hide others' in-progress drawings differently).

**Security**: server sanitizes/HTML-escapes chat and names (chat ~240 chars, names ~40 chars) and
rate-limits `chat`/`update` events per-socket and per-IP via token buckets.

**Payments/entitlements**: Stripe events land in Supabase (`server/payments.js`); entitlements are
granted idempotently via `tryGrantEntitlements()`, triggered by either `checkout.session.completed`
or `payment_intent.succeeded` (both merge into one `payments` row — handling is order-agnostic).
The price-ID → entitlement mapping is built dynamically from `STRIPE_PRICE_*` env vars in `env.js`;
adding an entitlement means adding one of those env vars (plus any DB schema change needed).
Client-side, `client/entitlements.js` fetches what the user has unlocked and gates
pets/bling/profile UI — only set `petKey` etc. when entitled.

**Auth** (`client/auth.js`, see `AUTH.md`): optional Supabase auth; the game is fully playable
logged-out. `initAuth()` / `getUser()` / `isLoggedIn()` / `signInWithGoogle()` /
`signInWithEmail()` / `signUpWithEmail()` / `signOut()`. Auth state changes fire a
window `auth:user-changed` event with `{ user, session }`.
