# Outside review: moonshotai/kimi-k3.1-pro

2026-11-20 · changes 70d636a..004264c · focus: S23 engine changes: quiescence evasions, mate scoring, repetition key, Web Worker computer move

Unverified model output. Check each finding against the code before acting.

I can review this, but the supplied material is incomplete: `packages/engine/src/ai.ts` is truncated at the key change, and the full `computer.ts`, `App.tsx`, and relevant engine definitions are not included. Findings below are limited to what the visible text supports.

## Findings

1. **High — Cancelling a worker search can leave its promise pending forever**  
   **File:** `apps/web/src/computer.ts`, `thinkMove`, especially `return { move, cancel: () => worker.terminate() };`  
   **What goes wrong:** `move` resolves only from `onmessage` or `onerror`. `cancel()` merely terminates the worker; it does not resolve or reject the promise. Any caller awaiting a cancelled search can remain suspended indefinitely. The new test checks termination but never awaits the cancelled promise, so it misses this.  
   **Concrete fix:** Settle the promise on cancellation, preferably with `undefined`, and make settlement idempotent across message, error, and cancellation paths. Clear the handlers and terminate in every path. Add a test that awaits `thinkMove(request()).move` after cancellation and asserts it resolves to `undefined`.  
   **Status:** Confirmed from the visible code.

2. **High — Worker failure can still freeze the page, contrary to the stated fallback guarantee**  
   **File:** `apps/web/src/computer.ts`, `worker.onerror`  
   **What goes wrong:** On worker error, the handler synchronously calls `resolve(onPage())`. `onPage()` performs the entire search before `resolve` is called, on the UI thread. Thus a worker load/runtime failure reintroduces the exact multi-second main-thread stall this change is intended to remove. The comment says the page “never freezes,” which is not true on this path.  
   **Concrete fix:** Prefer reporting failure and letting the UI retry with an explicitly bounded fallback. If an on-page fallback is required, defer it and enforce a small time/node budget; do not run the normal hard-level search synchronously in an error handler. Add an error-path responsiveness test or, at minimum, a test proving the fallback is deferred rather than executed inside `onerror`.  
   **Status:** Confirmed from the visible code.

3. **Medium — The worker tests do not exercise the real worker or its serialization boundary**  
   **Files:** `apps/web/src/computer.test.ts`, `thinkMove` tests; `apps/web/src/computer.worker.ts`  
   **What goes wrong:** `FakeWorker.postMessage` directly calls `answer()` in the test thread. It does not load `computer.worker.ts`, verify Vite’s worker build, or demonstrate that the real `ResolvedRuleset` and `GameState` survive worker cloning with everything `bestMove` needs. Consequently, the tests can pass while the production worker fails to load or produce a move. The fallback test also stubs `Worker` to `undefined`, so it does not cover the production error fallback.  
   **Concrete fix:** Add a browser-level integration test against the built application that requests a computer move through the real module worker and verifies the returned move is legal. Add a worker-error test that forces construction/loading failure and verifies the UI remains usable and the promise settles.  
   **Status:** Confirmed as a test-coverage gap; whether production serialization fails is only suspected.

4. **Medium — The central S23 engine claims are not reviewable from the supplied diff**  
   **File:** `packages/engine/src/ai.ts`, beginning around the truncated `repetitionKey` change  
   **What goes wrong:** The diff stops before the implementations of quiescence, mate scoring, draw handling, repetition detection, and node-budget behavior. The tests show intended outcomes but cannot establish that the implementation is correct—for example, whether mate distance remains correct through quiescence, whether repetition is scored at the correct occurrence, or whether an exhausted budget can return an illegal/unsearched move.  
   **Concrete fix:** The next review must include the complete `ai.ts` diff plus `positionKey`, `placementKey`, `result`, and move-generation definitions. Add direct tests for mate-in-N distance ordering, threefold rather than merely twofold occurrence semantics, stalemate/checkmate at quiescence entry, and budget exhaustion during the first iteration.  
   **Status:** Confirmed missing review material; no underlying engine defect is asserted.

5. **Low — The new repetition test constructs an artificial history rather than testing a played repetition sequence**  
   **File:** `packages/engine/src/ai.test.ts`, `repeat` helper in the “repetition key matches the game’s” describe block  
   **What goes wrong:** It manually combines positions, `unmoved`, `quietPlies`, and history entries. This can validate the fixture’s assumptions without proving that normal `play`/`makeMove` history produces the same search behavior, or that an actual threefold repetition is recognized during a real sequence.  
   **Concrete fix:** Build the position by playing a legal reversible move sequence through the public game API, then compare search behavior before and after the pawn’s first-move rights change. Assert the game’s own repetition/result logic and the search agree on that sequence.  
   **Status:** Confirmed from the test construction.

## Questions for the owner

- Should cancelling a computer search resolve quietly, reject with a cancellation error, or be handled entirely by the React effect’s `live` flag? The API currently does not define this.
- Is an on-page full-strength search an acceptable fallback when workers fail, given the stated requirement that the page never freezes?
- Does “repetition” in search mean the same threefold rule as the game, and should a twofold occurrence inside search be treated as an immediate draw because the side to move can force the third occurrence? The visible test appears to assume the latter, but the implementation is unavailable.
