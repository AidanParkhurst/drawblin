import { defineConfig } from "vite";

// Vite configuration options
export default defineConfig({
    root: "client",
    base: process.env.NODE_ENV === 'production' ? '/drawblin/' : './',
    build: {
        outDir: "../dist",
        emptyOutDir: true,
    },
});