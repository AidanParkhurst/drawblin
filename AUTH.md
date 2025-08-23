Auth overview

- Optional accounts via Supabase; game remains playable without login.
- UI: small Login link on the main page (top-right) and dedicated login.html.

Setup

1) Create a Supabase project, enable Google provider (optional), and copy the Project URL and anon key.
2) For local dev with Vite: create a file named .env.local in the repo root with:

   VITE_SUPABASE_URL=YOUR_URL
   VITE_SUPABASE_ANON_KEY=YOUR_ANON_KEY

   Alternatively, set window.SUPABASE_URL and window.SUPABASE_ANON_KEY in client/index.html.

3) Start dev server and open /login.html to test.

Client API (client/auth.js)

- initAuth(): initializes silently and subscribes to auth changes.
- getUser(): returns current user or null.
- isLoggedIn(): boolean.
- signInWithGoogle(redirectTo): starts OAuth flow.
- signInWithEmail(email, password)
- signUpWithEmail(email, password)
- signOut()

Events

- window event 'auth:user-changed' fired on any auth state change. Detail contains { user, session }.
