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

Auth configuration details live in `AUTH.md`.
