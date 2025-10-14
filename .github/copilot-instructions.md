## Drawblin – AI Coding Agent Instructions

Focus: real‑time multiplayer drawing game with multiple game modes (Free Draw, Quick Draw voting, Guessing Game phrase guessing, and user House lobbies) plus optional Supabase auth and Stripe-powered entitlements. Static client (Vite) + lightweight Node/Express + ws server.

### Architecture Snapshot
Client (`client/`): p5.js sketch (`index.js`) drives render + input. Game state is mostly client-side objects (Goblin, Line, Portal, Chat, Toolbelt, Pets). Networking is minimal: each player periodically sends a compact `update` (their goblin state + drawn lines) over a single WebSocket. Server performs no physics—just relays and runs game-mode state machines.

Server (`server/`): Single `server.js` boots Express (Stripe webhook + status) and a `ws` WebSocketServer multiplexed by URL path: `/freedraw`, `/quickdraw`, `/guessinggame`, `/house`. Each active connection is associated to a Lobby instance (subclass of `Lobby`). Game loop / timers live inside specific lobby classes (QuickDrawLobby, GuessingGameLobby). FreeDrawLobby is pass‑through. House lobbies allow an owner to hot‑swap the underlying lobby type (mode) in-place while retaining connected clients.

### Key Lobby Mechanics
`Lobby` base: tracks `clients`, `users` (socket→{id}), broadcasts JSON messages, and maps incoming `update` / `chat` events.
Quick Draw (`QuickDrawLobby.js`): cyclical states: waiting → drawing → pre-voting → voting (per artist rotation) → finished (celebration) → (auto next round or waiting). Voting interprets numeric chat (1–5) unless sender is artist. Results broadcast via `game_state` with `results` array of `{ artistId, votes, averageVote }`.
Guessing Game (`GuessingGameLobby.js`): waiting → drawing → reveal → (repeat rotation or back to waiting). Phrase prompts assembled from templates + tagged lexicon; non-literal tokens become “scorable words”. Guessers earn variable points per newly discovered word (inverse to prior find order); artist receives +1 per guessed placeholder. Words discovered are censored for other guessers; personalized prompt mask updates via `prompt_update`.
House Mode: `/house?u=<ownerShortUid>[&me=<fullUid>]`. Owner (short id matches) can send `house_switch_mode` to swap lobby class (freedraw/quickdraw/guessinggame) by re-instantiating a lobby with same id (see `switchHouseLobbyType`). Guests may only join if owner is currently connected.

### Message / State Protocol (Server ↔ Client)
Outbound (server → client) notable types:
- `game_state`: { state, time, prompt?, artistId?, results?, scores? }
- `chat`: { userId, content, guessed? } (QuickDraw votes echo “Voted!”)
- `update`: { goblin: { id, x, y, cursor, lines[], color, name, shape, ui_color, tool } }
- `user_left`: { userId }
- Guessing Game extras: `prompt_update`, `point_scored`
- House: `house_mode`, `house_unavailable`
Inbound (client → server): `update`, `chat` (content), `house_switch_mode` (owner only).

### Client Patterns & Conventions
- Central loop: `client/index.js` manages game-state branches per `lobby_type` and defers UI overlays via `_pendingHeader` / `_pendingScoreboard` so rendering order (world → overlays) is preserved.
- Goblin object lines are fully re-sent on any length change (naïve sync). Avoid large per-frame bursts; throttle line additions using `line_granularity` (~5px) and only transmit at heartbeat (150ms) or on structural change. Preserve this to limit bandwidth.
- Auth optional: guard any Supabase-dependent logic with `isAuthConfigured()` / `getUser()`. Do not break guest flow if env vars missing.
- House logic: detect via URL path `/house` + query param `u` (short slug). Keep slug creation consistent: lowercase uuid without dashes, first 12 chars (`shortUid` server, mirror in client when comparing).

### Environment & Build Workflows
Dev client: `npm run dev` (Vite serves from `client/` root). Multi-page: entries declared in `vite.config.js` (add new HTML pages to `rollupOptions.input`). Build: `npm run build` outputs to `dist/`. Deploy static site to GitHub Pages: `npm run deploy` (publishes `dist/` via `gh-pages`, homepage set to `./` for relative paths).
Server local run: `npm run server` (starts Express+ws on PORT or 3000). For full local integration update `client/network.js` BASE_URL to `ws://localhost:3000` (currently production URL). Keep this toggle minimal (consider env gating if modifying).

### Adding / Modifying Game Modes
1. Create new subclass of `Lobby` in `server/lobbies/`, implement timers & state transitions (`tick()` via interval). Provide `desiredWaitForPlayers()` if dynamic waiting.
2. Add path handling in `server/server.js` (both `verifyClient` validPaths and switch in `connection` handler & house switch function if house-compatible).
3. Extend client `index.js` to branch on new `lobby_type` for per-frame updates and header logic. Ensure house mode reset semantics clear old per-mode state.
4. Define message contract: emit `game_state` changes; keep message names consistent (snake_case currently used). Avoid breaking existing types.

### Common Pitfalls / Guardrails
- Never apply JSON body parsing to Stripe webhook route (maintain raw body for signature verification).
- When switching house modes, ensure old lobby loop is stopped (`stopGameLoop`) before discarding instance.
- Client may receive out-of-order `update` vs `game_state`; logic assumes idempotent state application—avoid adding ordering dependencies.
- Goblin line sync expects each line object with `{start._values[], end._values[]}` (from p5 vectors). If refactoring, maintain backward compatibility or add a translation layer.
- Guessing Game prompt masking relies on bracket semantics: artist sees bracketed full, others see underscores; revealed words get `[word]`. Preserve this formatting if adjusting UI.

### Auth & Profile Names
Profile display names stored in Supabase table `profiles` (id uuid PK, name text). On first auth without name, a random goblin name is generated and saved. Name changes emit `profile:name-updated` event; game listens to refresh and broadcast an `update`.

### Minimal Extension Examples
- To add a “Spectator” mode: subclass Lobby with `maxPlayers` high, ignore drawing inputs (filter in `handleMessage`), and broadcast only movement + chat.
- To add new entitlement: add env var STRIPE_PRICE_<NEW>, extend mapping in `payments.js` PRICE_TO_ENTITLEMENT, update schema (user_entitlements + events), and add client UI gating using future entitlements fetch (not yet implemented—would query Supabase).

### Style / Conventions Recap
- ES modules across client/server (`type: module`).
- Lowercase file names; classes PascalCase (Goblin, Portal) except utility modules.
- Game state strings are lowercase single tokens or hyphenated (e.g., `pre-voting`). Message fields use snake_case (e.g., `game_state`, `house_switch_mode`). Keep new fields consistent.
- Avoid adding heavy dependencies—runtime kept light: express, ws, stripe, supabase-js, p5.

### When Unsure
Prefer inspecting existing lobby implementation for flow templates; replicate broadcast shapes. Keep client resilient: wrap network feature additions with conservative null / type checks to avoid breaking guest sessions.

---
Feedback welcome: specify any unclear section (e.g., prompt generation, house mode switching, entitlement flow) to refine further.
