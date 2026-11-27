# Outside review: nvidia/nemotron-3-ultra-550b-a55b

2026-11-27 · changes 9b664da..100cfb1

Unverified model output. Check each finding against the code before acting.

# Outside Review — Apex Chess (PR #48 + S32)

## High severity

### 1. Tutorial lesson 5 (setup) uses invalid setup codes
**File:** `apps/web/src/lessons.json`, lines 173–180  
**What goes wrong:** The three setup codes in the "pick-setup" task are not valid chord-by-chord encodings per the rules.  
- Option A: `B/KR/RQB/PPPP/PPNPP/5N` — chord 1 has two pieces (`B` and `K`?), but h1 must hold only the king.  
- Option B: `K/BR/RQB/PPPP/PPN1P/4PN` — chord 6 (`4PN`) has two pieces beyond the front chord.  
- Option C: `K/RB/BQR/PPPP/PNPNP/2P3` — chord 2 (`RB`) puts rook on g1 and bishop on h2; chord 3 (`BQR`) has three pieces on three squares (valid), but chord 6 (`2P3`) puts a pawn beyond the front chord — only one piece allowed.  
None of the three options satisfy both Player's Choice rules. The task marks option C (index 2) as correct, but it violates the "one piece beyond front chord" rule.  
**Fix:** Replace with three valid codes, exactly one of which is legal. Example legal: `K/BR/RQB/PPPP/PPNPP/5N` (default). Example illegal (king not on h1): `BR/K/RQB/PPPP/PPNPP/5N`. Example illegal (two pieces beyond): `K/BR/RQB/PPPP/PPNPP/4PN`.  
**Confirmed from:** `docs/RULES.md` sections 3 and 4 (default setup code, Player's Choice rules).

### 2. Tutorial lesson 5 "build-setup" task has no validation
**File:** `apps/web/src/lessons.json`, lines 182–186; `apps/web/src/Tutorial.tsx` (not in diff, but implied)  
**What goes wrong:** The task kind `"setup"` with a prompt to "build your own" has no `answer` field and no validation logic shown. The lesson will accept any arrangement, including illegal ones (king off corner, wrong piece count, >1 piece beyond front chord).  
**Fix:** Either (a) make this a free-play sandbox with no correctness check, or (b) add client-side validation in `Tutorial.tsx` that runs the engine's setup legality check and only marks "done" when legal.  
**Suspected:** The diff does not include `Tutorial.tsx`; only `lessons.json` is new. If `Tutorial.tsx` lacks validation, this is a bug.

### 3. `checkLive` blocks room creation for retired rulesets, but `resolveRuleset` still returns them
**File:** `packages/online/src/room.ts` lines 105–118; `packages/engine/src/catalog.ts` lines 10–22  
**What goes wrong:** `catalog` now includes both `standard-0.1.0` and `standard-1.0.0` for boards, pieces, and rulesets. `resolveRuleset` (not shown, but implied by "last match wins") will resolve `standard@0.1.0` if requested. `checkLive` throws if `status === "retired"`. However, the ruleset JSON files (`standard-0.1.0.json`, `standard-1.0.0.json`) are not in the diff — their `status` field is unknown. If `standard-0.1.0` has `status: "retired"` but `standard-1.0.0` does not, a user with a stale link containing `ruleset=standard@0.1.0` gets an error instead of being silently upgraded to 1.0.0.  
**Fix:** In `resolveRuleset`, if the requested version is retired and a live version of the same id exists, auto-resolve to the live version and log a warning. Only throw if no live version exists.  
**Question for owner:** What is the `status` field in each ruleset JSON? Is `standard-0.1.0` marked retired?

---

## Medium severity

### 4. Tutorial lesson 3 (pawns) — promotion task uses dark king on e5, not a8
**File:** `apps/web/src/lessons.json`, lines 124–133  
**What goes wrong:** The position for "pawn-promote" has `"dark": { "e5": "king" }`. Per rules, dark's king starts at a8 and cannot move to e5 in a legal game (king moves one square). This is a made-up position that misrepresents the board geometry. The pawn promotes on a8 regardless of where the opposing king is, but the lesson should use a legal position.  
**Fix:** Change dark king to a8 (or any reachable square, but a8 is correct for a fresh game).  
**Confirmed from:** `docs/RULES.md` section 1 (kings start at h1 and a8).

### 5. Tutorial lesson 4 (check) — "mate-in-one" position has dark king on a8 but light queen on b1, knight on d6
**File:** `apps/web/src/lessons.json`, lines 148–157  
**What goes wrong:** Position: light king h1, queen b1, knight d6; dark king a8. Answer: `b1-b7`. On the turned board, b7 is on the same file as a8? Need to verify geometry. The hint says "queen next to the king where the knight guards it." From b1 to b7 is along the b-file (slant). The knight on d6 — does it guard b7? On a turned board, knight moves are standard L-shapes in (file, rank) coordinates. d6 to b7 is -2 files, +1 rank: a knight move. So knight guards b7. Queen on b7 attacks a8 along the file. Dark king on a8 has no escape (a7, b8, b7 all covered?). This may be correct, but the position is unusual (dark king alone on a8, light queen on b1).  
**Suspected:** The position is legal but contrived. Not a bug, but verify with engine test.

### 6. `lessons.json` hardcodes ruleset `standard@1.0.0`; test will break on new version
**File:** `apps/web/src/lessons.json` line 3; `docs/HANDOFF.md` line 14  
**What goes wrong:** The lessons file embeds `"ruleset": { "id": "standard", "version": "1.0.0" }`. When a new ruleset version ships (e.g., 1.0.1), `tutorial.test.ts` will fail because the lessons reference the old version. The handoff notes this: "A new ruleset version makes `tutorial.test.ts` fail on purpose: review `lessons.json` text and positions, then bump its `ruleset`." This is a maintenance burden and a source of CI failures.  
**Fix:** Decouple lessons from a specific version. Either (a) make lessons work with any version of `standard` (resolve to latest live), or (b) version the lessons file itself (e.g., `lessons-1.0.0.json`) and load the matching one.  
**Confirmed from:** `docs/HANDOFF.md`.

### 7. Missing HSTS preload and CSP headers
**File:** `apps/web/public/_headers` lines 7–11  
**What goes wrong:** Added `Strict-Transport-Security: max-age=31536000` but missing `includeSubDomains` and `preload`. No `Content-Security-Policy` header at all. For a game handling auth (passkeys), CSP is a launch blocker.  
**Fix:**  
```
Strict-Transport-Security: max-age=31536000; includeSubDomains; preload
Content-Security-Policy: default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self' wss:; frame-ancestors 'none'; form-action 'self'
```
Adjust `connect-src` for WebSocket endpoints.  
**Confirmed from:** Security best practices; diff shows only HSTS added.

### 8. Tutorial lesson 2 (lines) — rook capture task uses d4-d7, but d7 is not on the same file on a turned board?
**File:** `apps/web/src/lessons.json`, lines 68–77  
**What goes wrong:** Position: light rook d4, dark pawn d7. Answer: `d4-d7`. In standard coordinates, d4 to d7 is same file, +3 ranks. On the turned board, files run on the slant. The lesson says "Rooks travel along files and ranks, on the slant." So d4 to d7 is along the d-file — correct. But the hint says "The pawn is on the d file, the same file as the rook." This is correct per rules.  
**Suspected:** Not a bug, but verify engine allows this move.

---

## Low severity

### 9. Sitemap includes `/tutorial/` but no `lastmod` or `changefreq`
**File:** `apps/web/public/sitemap.xml` line 10  
**What goes wrong:** Other URLs have `<lastmod>` and `<priority>`; the new tutorial entry has neither.  
**Fix:** Add `<lastmod>2026-11-27</lastmod><priority>0.8</priority>`.

### 10. `FEEDBACK_QUESTION` and `FEEDBACK_URL` in `beta.tsx` but not used in all feedback entry points
**File:** `apps/web/src/beta.tsx` lines 5–10; `apps/web/src/About.tsx` lines 44–55; `apps/web/src/App.tsx` line 370  
**What goes wrong:** About page uses both; App header links only to `FEEDBACK_URL` (GitHub Discussions) without the question. Inconsistent.  
**Fix:** Add the question text next to the header link, or make the header link open a pre-filled discussion.

### 11. Tutorial lesson 1 (board) — "Click light's king corner" answer is h1, but the board is turned 45°; h1 is at the bottom?
**File:** `apps/web/src/lessons.json`, lines 13–22  
**What goes wrong:** The prompt says "Light's corner is the light corner at the bottom of the board, nearest you." On a turned board, h1 is a light square at one end of the long diagonal. If the board is rendered with h1 at the bottom (nearest the light player), this is correct. But the visual orientation in `Tutorial.tsx` must match.  
**Suspected:** Not a code bug, but a UX risk if the board rendering differs from the lesson text.

---

## Questions for the owner

1. **Ruleset status field:** What is the `status` value in `rules/rulesets/standard-0.1.0.json` and `standard-1.0.0.json`? (Needed to verify finding #3.)
2. **Tutorial validation:** Does `Tutorial.tsx` validate the "build-setup" task against the engine's setup legality? If not, should it?
3. **Lesson versioning:** Should `lessons.json` be versioned per ruleset, or should lessons always target the latest live `standard` ruleset?
4. **CSP policy:** What are the exact WebSocket and API endpoints for `connect-src`? Any inline scripts/styles that need nonces?
5. **Promotion task king position:** Is the dark king on e5 in lesson 3 intentional (to show promotion works regardless of king position), or a mistake?

---

## Launch blockers (must fix before public launch)

- #1 (tutorial teaches wrong rules)
- #2 (tutorial accepts illegal setups)
- #3 (retired ruleset links break instead of upgrading)
- #7 (missing CSP, incomplete HSTS)

## Recommended test additions

- `tutorial.test.ts`: assert each lesson's `answers` are exactly the legal moves per engine for the given position.
- `tutorial.test.ts`: assert "build-setup" task rejects illegal arrangements.
- `online.test.ts`: request room with `ruleset=standard@0.1.0` → should auto-upgrade to 1.0.0 or clear error.
- Security scan: CSP header present and effective; HSTS preload eligible.
