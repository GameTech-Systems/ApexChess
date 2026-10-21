# 0004: Hosting and deploy

Date: 2026-10-21 · Status: provisional (S16, D11 default); confirm Cloudflare terms at signup.

- Cloudflare Workers with Static Assets serves `apps/web/dist` (`wrangler.jsonc`); unknown paths fall back to `index.html`.
- `.github/workflows/deploy.yml` builds and runs `wrangler deploy` on every push to `main`. It skips the deploy step until the repository secrets `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID` exist.
- Owner steps: create the Cloudflare account, add the two secrets, attach the custom domain apexchess.icu to the `apexchess` Worker (DNS on Cloudflare).
- Errors: an error boundary and an `index.html` load-failure fallback show a reload message instead of a blank page; `<noscript>` covers no JavaScript.
- Privacy page: in-app, from the start screen. States local-storage-only setups, no accounts, cookies, or analytics. Revisit when online play adds accounts or logs.
