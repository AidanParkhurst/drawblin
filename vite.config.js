import { defineConfig } from "vite";

// Vite configuration options
export default defineConfig({
    root: "client",
    // Load env files from the repo root (where .env.local currently lives)
    envDir: "..",
    base: process.env.NODE_ENV === 'production' ? '/drawblin/' : './',
    build: {
        outDir: "../dist",
        emptyOutDir: true,
    },
});