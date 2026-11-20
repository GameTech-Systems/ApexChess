# Outside review: moonshotai/kimi-k3.1-pro

2026-11-20 · changes 004264c893f31a42f7741c5225a4192e7a889b47..69b6e7f · focus: S24 (beta labels, privacy text) and S26 (static info pages from docs/RULES.md in scripts/info-pages.mjs, sitemap, build script)

Unverified model output. Check each finding against the code before acting.

I can review the S24 changes, but the S26 implementation is missing: `scripts/info-pages.mjs` and its tests are not included. I can only flag risks visible from the sitemap, build command, and `docs/RULES.md`.

## Findings

1. **High — The privacy text still implies the archive is anonymous, despite acknowledging re-identification**
   **File:** `apps/web/src/Privacy.tsx:29-38`
   **What goes wrong:** The paragraph still calls the retained record an “anonymous copy” and says it “names no account,” while also admitting that distinctive setups and moves can identify a player. The new wording is also awkward and potentially misleading: “someone who knows what you played could be recognised by someone who knows that game” appears to say the observer, rather than the player, is recognised. Keeping indefinite, potentially identifiable game records under an “anonymous” label overstates the privacy protection.
   **Concrete fix:** Replace “anonymous copy” with “pseudonymous game record” or “game record without direct account identifiers.” Rewrite the warning directly, for example: “The record contains no account name, IP address, room code, ticket, clock times, or time of day. However, distinctive setups and moves may allow someone who already knows about a game to associate the record with a player. Treat archived games as pseudonymous, not anonymous. They are retained indefinitely, including after the room is deleted.”
   **Status:** Confirmed from the supplied text.

2. **High — S26 cannot be verified as implemented, and the build now has a new unreviewed publishing step**
   **Files:** `apps/web/package.json:8`; missing `scripts/info-pages.mjs`
   **What goes wrong:** The build invokes `node ../../scripts/info-pages.mjs dist`, but neither that script nor generated-page tests are supplied. Consequently, there is no evidence that the five sitemap URLs are actually generated, that their content faithfully reflects `docs/RULES.md`, or that a failed generation prevents deployment. Publishing the sitemap entries without corresponding files would produce indexed 404s.
   **Concrete fix:** Before marking S26 complete, add a build test that runs the real script against a temporary output directory and asserts that `how-to-play/index.html`, `rules/index.html`, `45-degree-chess/index.html`, `custom-setups/index.html`, and `about/index.html` exist and are nonempty. Fail the build on missing source documents or unescaped/unwritable output. Include the script in the next review.
   **Status:** Confirmed missing review material; broken output is only suspected.

3. **Medium — The privacy test locks in wording rather than the required privacy meaning**
   **File:** `apps/web/src/beta.test.tsx:27-35`
   **What goes wrong:** The test checks exact phrases such as “kept with no end date” and “could be recognised by someone who knows.” It does not reject the remaining “anonymous copy” claim, and a future edit could preserve the tested phrases while restoring misleading implications elsewhere. It also does not test the indefinite-retention statement independently of that exact wording.
   **Concrete fix:** Assert the substantive constraints: no description of the archive as anonymous, an explicit pseudonymous/re-identification warning, and explicit indefinite retention after room deletion. Prefer a few robust assertions over exact sentence fragments.
   **Status:** Confirmed from the supplied test.

4. **Medium — No tests cover the new static-page navigation or sitemap/build contract**
   **Files:** `apps/web/src/App.tsx:270-276`; `apps/web/public/sitemap.xml:8-12`; `apps/web/package.json:8`
   **What goes wrong:** The new footer links leave the single-page app for static directory URLs. Nothing shown verifies that those URLs work in production, that the sitemap and generator share one route list, or that the info-page generator runs before deployment artifacts are finalized. These are precisely the integration points most likely to fail in S26.
   **Concrete fix:** Add a post-build smoke test that requests every sitemap URL from the built site and checks for HTTP 200, expected headings, and valid canonical links. Generate the sitemap route entries from the same page manifest used by `info-pages.mjs`, or at least test that the two lists match.
   **Status:** Confirmed as a test-coverage gap; production failure is only suspected.

5. **Medium — Static rules pages risk publishing provisional rules as settled rules**
   **File:** `docs/RULES.md:1-3, 52-58`; missing `scripts/info-pages.mjs`
   **What goes wrong:** `RULES.md` explicitly labels the ruleset as draft and distinguishes owner decisions from provisional defaults. If S26 extracts or paraphrases sections without preserving those labels, public pages could contradict the app’s “draft” badge and present provisional event or pawn behavior as final.
   **Concrete fix:** Render the draft status and relevant *(Dn)* / *(provisional, Dn)* markers on the public rules page. Add a test that generated rules HTML contains the draft version and provisional labels. Avoid maintaining a second hand-written rules summary unless it has a documented source-of-truth and consistency test.
   **Status:** Suspected implementation risk; the generator is unavailable.

6. **Low — Beta coverage is inconsistent between events and the general header**
   **Files:** `apps/web/src/Event.tsx:54-59`; `apps/web/src/Leaderboard.tsx:7-12`; `apps/web/src/Online.tsx:210-217`; `apps/web/src/beta.tsx:2-3`
   **What goes wrong:** Events and leaderboards receive the full warning that ratings, leaderboards, and events “may be reset or change,” while rated quick match receives only a prefixed “Beta:”. The header badge puts the warning in `title`, which is not reliably available to touch users and is easy to miss. Users may enter rated play without seeing the reset warning that D22’s provisional default appears intended to communicate.
   **Concrete fix:** Use `BETA_NOTE` or a short visible equivalent at the rated quick-match entry point, and make the header warning accessible through visible text or a keyboard/touch-accessible description rather than `title` alone.
   **Status:** Confirmed from the supplied components; the exact required prominence is a product decision.

7. **Low — The new Beta tests do not exercise the actual app header or rated-play UI**
   **File:** `apps/web/src/beta.test.tsx:8-25`
   **What goes wrong:** The badge test renders `BetaBadge` directly, so it would pass if `App` stopped rendering it or passed the wrong ruleset. The quick-match changes in `Online.tsx` have no test at all.
   **Concrete fix:** Add an `App`-level test asserting that the live ruleset id/version appears in the header, and an `OnlineLobby` test for signed-in and signed-out rated-play messaging.
   **Status:** Confirmed as a test-coverage gap.

## Questions for the owner

- Is indefinite retention of pseudonymous complete game records the intended final policy, or only the provisional D23 default? The public privacy text should not present a provisional default as a settled commitment without that distinction being understood.
- Should `/rules/` reproduce `docs/RULES.md` verbatim, including internal decision ids and links to `BUILD-PLAN.md`, or should those internal markers be translated into player-facing draft/provisional wording?
- What are the intended source documents for `/how-to-play/`, `/45-degree-chess/`, `/custom-setups/`, and `/about/`? Only `docs/RULES.md` is supplied, so their factual content and canonical URLs cannot be checked.
- Should the Beta warning be merely visible, or must users explicitly acknowledge that ratings and event results may be reset?
