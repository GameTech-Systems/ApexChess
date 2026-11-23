import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import react from "@vitejs/plugin-react";
import { defineConfig, type Plugin } from "vite";
import { pageHtml } from "./src/pageHtml";
import { ROUTE_PATHS, ROUTE_TITLES, type Route } from "./src/routes";

/** After a build, write <page>/index.html for every address, so crawlers and share previews see each page's own tags. */
function pageFiles(): Plugin {
  let outDir = "dist";
  return {
    name: "apex-page-files",
    apply: "build",
    configResolved(c) {
      outDir = resolve(c.root, c.build.outDir);
    },
    closeBundle() {
      const index = readFileSync(join(outDir, "index.html"), "utf8");
      for (const route of Object.keys(ROUTE_PATHS) as Route[]) {
        const dir = join(outDir, ROUTE_PATHS[route]);
        mkdirSync(dir, { recursive: true });
        writeFileSync(
          join(dir, "index.html"),
          pageHtml(index, ROUTE_PATHS[route], ROUTE_TITLES[route]),
        );
      }
    },
  };
}

// `pnpm dev:server` runs the online-play Worker on 8787; `pnpm dev` forwards /api to it.
export default defineConfig({
  plugins: [react(), pageFiles()],
  // The computer's search runs in a module worker (src/computer.worker.ts).
  worker: { format: "es" },
  server: { proxy: { "/api": { target: "http://127.0.0.1:8787", ws: true } } },
});
