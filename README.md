Drawblin
=========

Static front-end (in `client/`) built with Vite and deployed to GitHub Pages via `gh-pages`.

Multi-page build
----------------
We currently ship two HTML entry points:

* `index.html` (main app)
* `login.html` (auth UI)

Vite auto-detects HTML files in the project root, but we explicitly declare them in `vite.config.js` (`build.rollupOptions.input`) to guarantee both are emitted during production builds and deployments. If you add a new top-level page (e.g. `about.html`), add it to the `input` map in `vite.config.js` as well:

```
input: {
  main: path.resolve(rootDir, 'index.html'),
  login: path.resolve(rootDir, 'login.html'),
  about: path.resolve(rootDir, 'about.html'),
}
```

Deploy
------
```
npm run deploy
```
This runs a production build to `dist/` and publishes that folder to the `gh-pages` branch.

## Payments & Entitlements

The server supports Stripe webhooks to grant user entitlements (no generic currency balance). Two-stage flow:
1. `checkout.session.completed` records user identity (email mapping).
2. `payment_intent.succeeded` confirms and applies entitlements.

Configure environment variables (see `.env.example`):

```
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_KEY=service_role_key

# Map these to your Stripe Price IDs
STRIPE_PRICE_PREMIUM_SUB=price_XXXXXXXXXXXXXXXX
STRIPE_PRICE_PET_PACK=price_XXXXXXXXXXXXXXXX
STRIPE_PRICE_WIN_BLING_PACK=price_XXXXXXXXXXXXXXXX
STRIPE_PRICE_MORE_GOBLINS_PACK=price_XXXXXXXXXXXXXXXX
```

Run the SQL in `server/sql/entitlements_schema.sql` inside Supabase to create:
- `payments` (lifecycle records)
- `user_entitlements` (current flags)
- `entitlement_events` (audit trail)

Webhook endpoint: `POST /webhook/stripe` (raw body required). Use Stripe CLI:
```
stripe listen --forward-to localhost:3000/webhook/stripe
```

Add the price IDs to product metadata / line items so they can be detected. The server infers entitlements by scanning `price_` values in metadata or charges.

Entitlement flags available:
- `has_premium` (subscription style)
- `pet_pack`
- `win_bling_pack`
- `more_goblins_pack`

Future improvements: implement revocation for canceled subscriptions, and handle refunds via `charge.refunded`.
Auth configuration details live in `AUTH.md`.
