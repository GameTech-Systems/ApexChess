import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

// `pnpm dev:server` runs the online-play Worker on 8787; `pnpm dev` forwards /api to it.
export default defineConfig({
  plugins: [react()],
  server: { proxy: { "/api": { target: "http://127.0.0.1:8787", ws: true } } },
});
