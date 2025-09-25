import { defineConfig } from "vite";
import path from 'path';

// Vite configuration options
// NOTE: We explicitly declare multiple HTML entry points (index + login) so that
// both pages are generated during the static build for GitHub Pages. While Vite
// normally auto-detects HTML in the project root, explicit inputs avoid any
// accidental omission during refactors or tool upgrades.
const rootDir = path.resolve(process.cwd(), 'client');

export default defineConfig({
    root: rootDir,
    // Load env files from the repo root (where .env.local currently lives)
    envDir: "..",
    // For custom domain (drawbl.in) we serve from root '/' in production.
    // During local dev we keep relative './' so opening via file/ or dev server is fine.
    base: process.env.NODE_ENV === 'production' ? '/' : './',
    // Static assets (including CNAME) copied as-is
    publicDir: path.resolve(rootDir, 'public'),
    build: {
        outDir: path.resolve(rootDir, '../dist'),
        emptyOutDir: true,
        rollupOptions: {
            input: {
                main: path.resolve(rootDir, 'index.html'),
                login: path.resolve(rootDir, 'login.html'),
                house: path.resolve(rootDir, 'house.html'),
                shop: path.resolve(rootDir, 'shop.html'),
            }
        }
    },
});