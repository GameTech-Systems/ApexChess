# Outside review: nvidia/nemotron-3-ultra-550b-a55b

2026-11-20 · changes 70d636a..004264c · focus: S23 engine changes: quiescence evasions, mate scoring, repetition key, Web Worker computer move

Unverified model output. Check each finding against the code before acting.

### High

**1. Missing `positionKey` export from engine package**  
`packages/engine/src/ai.ts:10` imports `positionKey` from `./game`, but `packages/engine/src/game.ts` does not export it (only `placementKey` is exported in the diff). The engine build will fail.  
**Fix:** Export `positionKey` from `packages/engine/src/game.ts`.  
**Confirmed from diff:** the import exists but no corresponding export is shown.

**2. Web Worker path resolution may fail in production build**  
`apps/web/src/computer.ts:63` uses `new URL("./computer.worker.ts", import.meta.url)`. Vite’s `worker: { format: "es" }` emits the worker as a separate chunk; the relative URL works in dev but can 404 after `vite build` if the chunk name changes or if the worker is not copied to `dist`.  
**Fix:** Use `new URL("./computer.worker.ts?worker", import.meta.url)` (Vite’s explicit worker query) or `new URL("computer.worker.ts", import.meta.url)` with `worker: { plugins: [] }` and ensure the worker is listed in `build.rollupOptions.input`.  
**Suspected:** common Vite pitfall; not directly visible in diff.

**3. `thinkMove` does not reject on worker error — silent fallback masks failures**  
`apps/web/src/computer.ts:70-73` catches `onerror` and resolves with `onPage()` without logging. If the worker fails to load (CSP, network, MIME type), the page silently falls back, hiding deployment problems.  
**Fix:** Log the error (`console.error("Computer worker failed", e)`) before fallback; optionally surface a non-blocking toast so the owner sees it in production.  
**Confirmed from diff:** `onerror` handler swallows the event.

---

### Medium

**4. `computerMove` still exported and used in tests but no longer used in UI**  
`apps/web/src/computer.ts` exports `computerMove`; `App.tsx` no longer imports it. Dead export inflates bundle and confuses future readers.  
**Fix:** Remove `export` from `computerMove` (keep it unexported for `answer`/`thinkMove` internal use) or delete if truly unused.  
**Confirmed from diff:** `App.tsx` imports `thinkMove` only.

**5. `seededRandom` imported but not re-exported from engine**  
`apps/web/src/computer.ts:4` imports `seededRandom` from `@apexchess/engine`. The engine’s `ai.ts` does not export it in the diff (only `bestMove`, `randomMove`, `evaluate`, `pieceValues`, `chooseSetup`, `seededRandom` are listed in the test import, but the actual export list in `ai.ts` is not shown).  
**Fix:** Verify `seededRandom` is exported from `packages/engine/src/ai.ts`; if not, add it.  
**Suspected:** test imports it, so it likely exists, but the diff truncates the export list.

**6. `maxNodes: 0` behavior under-specified**  
`ai.ts` comment says “when spent, the deepest finished iteration's move is played, or the first move in search order… if no iteration finished.” With `maxNodes: 0`, no iteration finishes; the code must still return a legal move. The test `plays a legal move with a node budget of 0 or 1` passes, but the comment implies the first move in *search order* (captures/promotions first) — not necessarily a good move.  
**Fix:** Clarify in the comment that `maxNodes: 0` returns the first legal move in generation order (which is captures/promotions first), and ensure the implementation matches.  
**Confirmed from diff:** comment and test exist; implementation not shown.

---

### Low

**7. `computer.worker.ts` has no `self.onerror` handler**  
If `answer` throws (e.g., malformed `MoveRequest`), the worker dies silently; the page’s `onerror` fires but receives no detail.  
**Fix:** Add `self.onerror = (e) => { console.error(e); self.postMessage(null); }` in the worker.  
**Confirmed from diff:** worker only sets `onmessage`.

**8. `vite.config.ts` worker format `es` requires `type: "module"` in worker script**  
`computer.worker.ts` uses `import` statements; `worker: { format: "es" }` is correct, but the worker file must be treated as a module. Vite does this automatically for `.ts` workers with `format: "es"`. No action needed, but verify the built worker starts with `import` not `require`.  
**Suspected:** standard Vite behavior.

**9. `deploy.yml` smoke test script not reviewed**  
`scripts/smoke.mjs` is invoked but not in the diff. If it fails, deploy fails (good), but a bug in the smoke test could block valid deploys.  
**Fix:** Ensure `scripts/smoke.mjs` is version-controlled and tested separately.  
**Not in diff:** listed for completeness.

---

### Questions for owner

1. **`pawnFirstMove: "two"` repetition test** (`ai.test.ts:200`) expects that a pawn with a two-square first move *changes* the repetition key. Does the current `positionKey` include the pawn’s “has moved” state for *all* pawns, or only the side to move? The test implies the former. Confirm this matches the intended rules (D3).  
2. **Hard level time increase** (HANDOFF: “~1.4 s a move, was ~0.75 s”). Is this acceptable for the target UX, or should the node cap be lowered?  
3. **Web Worker CSP**: Does the deployed CSP (`apps/web/public/_headers`) allow `worker-src blob:` or `worker-src 'self'`? The worker is same-origin, so `'self'` suffices, but verify.  
4. **`seededRandom` determinism across environments**: The test assumes the same seed produces the same move on the page and in the worker. Confirm the PRNG is pure (no `Math.random` leakage).  

---

### Launch blockers (from this diff)

- **#1** (missing export) will break `pnpm build` → CI fails → deploy blocked.  
- **#2** (worker URL) may break computer moves in production only; not caught by CI.  
- **#3** (silent worker failure) hides production issues.  

Fix #1 immediately; #2 and #3 before or during S22 verification.
