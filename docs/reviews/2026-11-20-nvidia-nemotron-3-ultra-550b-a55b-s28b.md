# Outside review: nvidia/nemotron-3-ultra-550b-a55b

2026-11-20 · changes 004264c893f31a42f7741c5225a4192e7a889b47..69b6e7f · focus: S24 (beta labels, privacy text) and S26 (static info pages from docs/RULES.md in scripts/info-pages.mjs, sitemap, build script)

Unverified model output. Check each finding against the code before acting.

## Outside review: S24 (beta labels, privacy) & S26 (static info pages)

### High

1. **Sitemap lists info pages that the build does not create**  
   **File:** `apps/web/public/sitemap.xml` (lines 7–11)  
   **What goes wrong:** The sitemap declares five static URLs (`/how-to-play/`, `/rules/`, `/45-degree-chess/`, `/custom-setups/`, `/about/`). `scripts/info-pages.mjs` is added to the build (package.json) but its output is not verified here. If the script fails or writes to the wrong paths, these URLs 404 in production and Search Console will flag them.  
   **Fix:** In `scripts/info-pages.mjs`, ensure it writes `dist/how-to-play/index.html`, `dist/rules/index.html`, `dist/45-degree-chess/index.html`, `dist/custom-setups/index.html`, `dist/about/index.html`. Add a post-build check (e.g., in `write-version.mjs` or a new step) that `fs.existsSync` each file.  
   **Status:** Suspected — `info-pages.mjs` not provided; only the build hook is visible.

2. **Privacy text still claims “no account” for archived games while accounts exist**  
   **File:** `apps/web/src/Privacy.tsx` (lines 33–37)  
   **What goes wrong:** The new text says “it names no account”. The app has passkey-based accounts (D16) and rated games are tied to accounts. If an archived game is linked to a rated game, the account handle could be inferred. The statement is inaccurate and weakens the privacy posture.  
   **Fix:** Change to: “Archived games do not store your account handle. A game’s setups and moves can be close to unique, so someone who knows what you played could be recognised by someone who knows that game; treat an archived game as pseudonymous, not untraceable.”  
   **Status:** Confirmed from the diff and `docs/RULES.md` (rated play exists).

3. **Beta badge shows a hard-coded ruleset version; no source of truth**  
   **File:** `apps/web/src/beta.tsx` (line 7), `App.tsx` (line 242)  
   **What goes wrong:** `BetaBadge` receives `current={{ id: "standard", version: "0.1.0 }}` hard-coded in `App.tsx`. The ruleset version lives in `rules/` data (per `docs/RULES.md` “draft 0.1”). If the data version changes, the badge lies.  
   **Fix:** Export the active ruleset id/version from the engine package (e.g., `packages/engine/src/ruleset.ts`) and import it in `App.tsx`.  
   **Status:** Confirmed from the diff — the value is a literal.

### Medium

4. **`info-pages.mjs` must render `docs/RULES.md` faithfully; no test verifies this**  
   **File:** `scripts/info-pages.mjs` (not provided)  
   **What goes wrong:** S26 requires static pages generated from `docs/RULES.md`. If the script uses a markdown renderer that strips tables, mis-renders the setup code, or drops the `(Dn)` annotations, the published rules diverge from the source.  
   **Fix:** Add a test (e.g., in `scripts/info-pages.test.mjs`) that runs the script on a fixture markdown and asserts the output HTML contains key structures: the board table, the setup code `K/BR/RQB/PPPP/PPNPP/5N`, the pawn movement rules, and the decision markers.  
   **Status:** Suspected — script not in context.

5. **No `changefreq`/`priority` on new sitemap entries**  
   **File:** `apps/web/public/sitemap.xml` (lines 7–11)  
   **What goes wrong:** The home page has `<changefreq>weekly</changefreq><priority>1.0</priority>`; the five new URLs have neither. Not a blocker, but inconsistent and may affect crawl budget.  
   **Fix:** Add `<changefreq>monthly</changefreq><priority>0.8</priority>` to each new `<url>`.  
   **Status:** Confirmed from the diff.

6. **Beta note on rated quick match says “Beta: you are signed in…” — ambiguous whether rating is active**  
   **File:** `apps/web/src/Online.tsx` (lines 213–215)  
   **What goes wrong:** The text “Beta: you are signed in, so a quick match against another signed-in player is rated, unless it is untimed” reads like a guarantee. D22 default is “keep them on, marked Beta (provisional)”. If the owner later disables rated play in beta, this string becomes wrong.  
   **Fix:** Soften to: “Beta: rated quick matches are enabled for signed-in players (may be reset or changed).”  
   **Status:** Confirmed from the diff and `docs/BUILD-PLAN.md` D22.

### Low

7. **Beta badge tooltip uses `title` attribute — not accessible on touch/keyboard**  
   **File:** `apps/web/src/beta.tsx` (line 11)  
   **What goes wrong:** `title={BETA_NOTE}` only shows on hover. Mobile users and keyboard-only users never see the full note.  
   **Fix:** Use a visible `(i)` icon with `aria-describedby` pointing to a hidden element, or put the full note in the badge text (it’s short).  
   **Status:** Confirmed from the diff.

8. **Privacy test checks for absence of old string but not presence of new retention wording**  
   **File:** `apps/web/src/beta.test.tsx` (lines 28–31)  
   **What goes wrong:** The test asserts `not.toContain("cannot be linked back to you")` and checks for “could be recognised”. It does not assert “kept with no end date” (that’s in a separate test) nor that the account disclaimer is accurate (see finding 2).  
   **Fix:** Extend the privacy test to assert the exact revised sentence from finding 2.  
   **Status:** Confirmed from the diff.

---

### Questions for the owner

- **Q1:** Should the Beta badge’s ruleset version be sourced from the engine package at build time, or is a manual constant acceptable for the beta period?  
- **Q2:** Does `scripts/info-pages.mjs` already exist and pass a local build? If not, S26 is blocked until it’s written and tested.  
- **Q3:** The privacy text says “archived games are kept with no end date”. Is that the final policy, or should a retention period (e.g., 2 years) be stated? D23 default is “no end date (as built)”.
