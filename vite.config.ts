import { defineConfig } from "vite";
import { svelte } from "@sveltejs/vite-plugin-svelte";

// A porta é fixa porque `tauri.conf.json` aponta o devUrl para ela.
export default defineConfig({
  plugins: [svelte()],
  clearScreen: false,
  server: { port: 1420, strictPort: true },
  // O Cargo cuida de src-tauri; o Vite não deve reagir a mudanças lá.
  envPrefix: ["VITE_", "TAURI_"],
  build: { target: "safari15", sourcemap: true },
});
