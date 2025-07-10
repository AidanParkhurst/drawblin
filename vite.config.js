import { defineConfig } from "vite";

// Vite configuration options
export default defineConfig({
    root: "client",
    base: "./",
    build: {
        outDir: "../dist",
        emptyOutDir: true,
    },
});