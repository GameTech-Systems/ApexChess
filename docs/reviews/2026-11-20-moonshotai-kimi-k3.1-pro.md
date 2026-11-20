# Outside review: moonshotai/kimi-k3.1-pro

2026-11-20 · core files at 3810486 · focus: launch readiness; the AI search horizon (check evasions, mate/stalemate in quiescence, repetition key)

Unverified model output. Check each finding against the code before acting.

I can review the AI search and launch-readiness issues from the supplied code, but the material is incomplete: `setup.ts` is truncated, and the rules data, tests, server, and deployment files are absent. Findings below are confirmed from the text unless marked otherwise.

## Findings

1. **High — Quiescence can return a normal evaluation in checkmate or stalemate positions.**  
   **File:** `packages/engine/src/ai.ts`, `Search.quiesce`, especially the stand-pat return and captures/promotions-only loop.  
   **What goes wrong:** At the depth limit, quiescence never determines whether the side to move has any legal move. If there are no legal moves, or only quiet check evasions, it returns the static evaluation/alpha instead of mate or stalemate. A side can therefore prefer a line that is actually checkmated, or fail to distinguish stalemate from a favorable position. The six-ply cap has the same problem when it cuts off a forced sequence.  
   **Concrete fix:** Detect terminal positions before stand-pat. Generate legal moves, or at least use a correct legal-move existence check; return `-MATE + ply` for checkmate and `0` for stalemate. While in check, search all legal evasions rather than only captures/promotions, and do not let stand-pat override a terminal result. Add a separate quiescence mate score using total search ply.  
   **Tests:** Depth-0/1 positions where the side to move is checkmated, stalemated, and in check with only quiet evasions; compare search results with `result()` and a full legal-move search.

2. **High — The search’s repetition key omits information that changes legal moves.**  
   **Files:** `packages/engine/src/ai.ts`, `repetitionKey` and `Search` constructor; `packages/engine/src/game.ts`, `positionKey`.  
   **What goes wrong:** The real game key includes sorted legal moves, but the search key contains only turn and piece placement. Positions with identical placement can have different legal moves because `unmoved` affects `firstMove` movements, and `ply < 2` affects `firstMoveCaptures`. Search can consequently score a non-repetition as a draw. The constructor also assumes every history key has the same three-part format, coupling AI behavior to an internal serialization detail.  
   **Concrete fix:** Use one shared position-key implementation for game history and search, including all state that affects legal moves. If performance requires a cheaper key, include at least turn, placement, relevant unmoved state, and first-move capture state, and prove it equivalent for repetition purposes.  
   **Tests:** Same placement with different `unmoved` arrays under two-square pawn movement; same placement at different opening plies with captures forbidden; verify search repetition decisions match `game.ts`.

3. **High — Search does not consistently apply the game’s automatic draw rules.**  
   **File:** `packages/engine/src/ai.ts`, `Search.negamax`, `Search.quiesce`, and `bestMove`.  
   **What goes wrong:** Repetition is treated as a draw on the first recurrence, regardless of `ruleset.draws.repetitions`; the configured threshold is not used. Quiescence checks neither repetition nor insufficient material, and its move-rule handling is absent. The main search also hardcodes a first-recurrence draw rather than reproducing `result()`. This can make the AI avoid or pursue moves based on evaluations that disagree with the actual game outcome.  
   **Concrete fix:** Centralize terminal/draw evaluation in a search-safe helper using the configured repetition count, move-rule count, and insufficient-material rules. Track occurrence counts rather than using `seen.includes`. Apply the same logic at every node, including quiescence and root move selection.  
   **Tests:** Rulesets with repetition thresholds of 2 and 3; a second occurrence that must remain ongoing; a third occurrence that must draw; captures/promotions in quiescence leading to automatic draws.

4. **High — A node-budget stop can leave the root with an arbitrary move rather than the deepest completed iteration’s move.**  
   **File:** `packages/engine/src/ai.ts`, `bestMove`, root loop and `chosen` initialization.  
   **What goes wrong:** `chosen` starts as `root[0]`. If the budget is exhausted before the first iteration completes, that move is returned even though no iteration finished. This contradicts the `maxNodes` documentation and can produce a move selected only by generation/ordering heuristics. With a very small budget, the search may also perform substantial work before the stop is observed at the root.  
   **Concrete fix:** Define and test the intended behavior for an uncompleted first iteration. Either return a explicitly documented fallback after a fast legal-move policy, or guarantee completion of depth 1 before honoring the budget; do not describe the result as the deepest completed iteration when none exists. Check the budget between root moves and before starting each iteration.  
   **Tests:** `maxNodes` values 0, 1, and just below/above depth-1 completion; verify deterministic fallback and that the returned move is legal.

5. **Medium — Mate scores from quiescence are not distance-correct.**  
   **File:** `packages/engine/src/ai.ts`, `negamax` terminal return and `quiesce` signature.  
   **What goes wrong:** Full-search mate uses `-MATE + ply`, but quiescence has no access to the overall ply. Once terminal handling is added there, using a local quiescence ply or a constant would make mate ordering inconsistent and could cause the AI to prefer a slower mate or fail to distinguish mate distances.  
   **Concrete fix:** Pass the absolute search ply into quiescence and use a single mate-scoring convention throughout.  
   **Tests:** Forced mate in one versus mate in two, including a capture at the depth boundary; verify the faster mate is selected.

6. **Medium — `randomMove` can return `undefined` for an ongoing position with no generated moves, and its random index is not explicitly guarded.**  
   **File:** `packages/engine/src/ai.ts`, `randomMove`.  
   **What goes wrong:** The function relies on `result()` to establish that legal moves exist, then indexes `moves[...]`. That is valid only if `result()` and `legalMoves()` always agree and the supplied random source honors its contract. The current code does not make the empty-list case explicit.  
   **Concrete fix:** Return `undefined` immediately when `moves.length === 0`; clamp or validate the random value if external random sources are supported.  
   **Tests:** Ongoing nonterminal positions, terminal positions, and random sources returning values extremely close to 1.

7. **Medium — AI evaluation can be expensive enough to block a launch UI or server worker.**  
   **File:** `packages/engine/src/ai.ts`, `tables`, `reach`, and `bestMove`.  
   **What goes wrong:** Table construction generates moves and attacked squares for every piece, side, and board square. Search is synchronous and has no time or cancellation interface; `maxNodes` is optional and defaults to infinity. This is a launch risk if called on a UI thread or in a request handler, especially with custom rulesets.  
   **Concrete fix:** Run search in a worker or isolated job, impose a deadline and cancellation, and always set a finite node/time budget in production. Cache immutable ruleset tables safely and measure worst-case custom setups.  
   **Confirmation:** The synchronous/unbounded behavior is confirmed; user-facing blocking is suspected because callers were not supplied.  
   **Tests:** Production-depth latency on the slowest supported device/worker, cancellation, and concurrent games.

8. **Medium — No supplied tests demonstrate that AI outcomes agree with the rules engine.**  
   **Files:** `packages/engine/src/ai.ts`, `game.ts`; no test files supplied.  
   **What goes wrong:** The highest-risk behavior—check evasions, mate/stalemate at quiescence, repetition, move-rule draws, and budget interruption—is exactly where the implementations diverge.  
   **Concrete fix:** Add differential tests against a simple full-width reference search on small positions, plus targeted regression tests for every case above. Run them for both sides, custom setups, promotions, far-edge pawns, and nondefault parameters.

## Questions for the owner

- Should AI search treat a repetition as a draw only at the configured automatic threshold, or intentionally use a more conservative “any recurrence is draw” heuristic? The current code and documentation imply different behavior.
- When the node budget expires before depth 1 completes, is an ordered legal-move fallback acceptable, or must the AI always complete depth 1?
- Is quiescence intended to be captures/promotions only except while in check? That is a reasonable design, but the required mate/stalemate behavior should be stated explicitly.
- Are AI searches ever run synchronously in the browser or server request path, and what is the launch latency budget?

No security or privacy vulnerability is confirmed from the supplied engine files. Launch should be blocked on the terminal-position and draw-handling defects, with regression tests, before relying on the AI for rated or public play.

## Triage (checked against the code, 2026-11-20)

- #1, #5: real, filed as I7 (S23).
- #2: real, filed as I8 (S23).
- #3: partly real. Counting the first repeat as a draw is a normal search shortcut. Missing draw checks in quiescence go to S23.
- #4: unlikely at the set levels (depth 1 fits well inside 25,000 nodes). S23 adds a test for a tiny budget.
- #6: low; S23 adds the empty-list guard.
- #7: real, filed as I14. The computer moves on the main thread (`apps/web/src/computer.ts:29`); S23 moves it to a Web Worker.
- #8: not accurate. `packages/engine/src/ai.test.ts` exists, but it has no horizon cases; S23 adds them.
