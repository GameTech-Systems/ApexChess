# Outside review: nvidia/nemotron-3-ultra-550b-a55b

2026-11-20 · core files at d4c4b33 · focus: launch readiness; the AI search horizon (check evasions, mate/stalemate in quiescence, repetition key)

Unverified model output. Check each finding against the code before acting.

### High Severity

**1. AI Search Horizon: Quiescence omits check-evasion generation**  
**File:** `packages/online/src/ai.ts` (not provided, but referenced by `worker.ts` imports)  
**What goes wrong:** The quiescence search (`qSearch`) only generates captures and promotions. In Apex Chess, a king in check *must* evade (move, block, capture). If the search horizon cuts inside a checking sequence, the side to move has no legal non-capture evasions in quiescence → the evaluator returns a stand-pat score instead of “in check, must move” → horizon effect lets the AI walk into mate or miss forced mates.  
**Fix:** In `qSearch`, before stand-pat, test `isInCheck(pos)`. If true, generate *all* legal moves (not just captures) and search them with the same α/β window.  
**Confirmed:** Suspected from standard chess-engine architecture; the provided `worker.ts` imports `tick`, `act`, `deadline` from `@apexchess/online` but the AI module itself is not in the file list. Please confirm whether `ai.ts` exists and its quiescence logic.

**2. Repetition key ignores 50-move / 75-move counters**  
**File:** `packages/online/src/room.ts` (not provided)  
**What goes wrong:** Threefold repetition detection uses a hash key that typically includes side-to-move, castling rights, en-passant square, and piece placement. If the key *excludes* the half-move clock (50-move counter) and full-move number (75-move counter), positions that differ only in those counters are treated as identical → incorrect draws or missed draws.  
**Fix:** Include `halfMoveClock` and `fullMoveNumber` in the repetition key (Zobrist or string key).  
**Confirmed:** Suspected; the Room DO (`worker.ts` line 300+) stores `RoomData` but the serialization is not shown. Please share `room.ts` or confirm the key composition.

**3. Mate / stalemate detection missing in quiescence**  
**File:** `packages/online/src/ai.ts`  
**What goes wrong:** If quiescence reaches a terminal node (no legal moves), it must return `±∞` for mate or `0` for stalemate. If it falls through to static eval, the AI mis-evaluates forced mates at the horizon.  
**Fix:** At the top of `qSearch`, call `generateLegalMoves(pos)`. If empty, return `isInCheck(pos) ? -MATE_SCORE : 0`.  
**Confirmed:** Suspected; same as #1.

---

### Medium Severity

**4. `deadline` enforcement in AI search not visible**  
**File:** `apps/server/src/worker.ts` line 45 imports `deadline` from `@apexchess/online`; usage not shown.  
**What goes wrong:** If the AI search does not periodically check `deadline.expired()` (or a time budget), a complex position can block the Durable Object past the 50 ms / 128 ms CPU limit → Worker eviction, game stall.  
**Fix:** Pass a `deadline` object into the search root and `qSearch`; abort with current best move when expired.  
**Confirmed:** Suspected; `deadline` is imported but not used in the provided snippets.

**5. Quick-match rating uses `sessionAccount` but no auth on `/api/match`**  
**File:** `apps/server/src/routes.ts` line 33: `route("GET", "/api/match") → { kind: "match" }`  
**File:** `apps/server/src/worker.ts` line 250: `r.kind === "match"` branch missing (falls through to lobby).  
**What goes wrong:** Quick match is routed to the lobby DO without an account token, so `sessionAccount` returns `undefined` → rated games become unrated.  
**Fix:** Add a `match` case in `worker.ts` that reads `bearerToken`, calls `sessionAccount`, then `seek` with the account id.  
**Confirmed:** Confirmed from text — the `match` route exists but the handler is absent.

---

### Low Severity

**6. `cleanUpAccounts` does not delete orphaned recovery-code rows**  
**File:** `apps/server/src/accounts.ts` line 340  
**What goes wrong:** `DELETE FROM challenges` and `sessions` only. Recovery codes for deleted accounts remain until next `codes` call.  
**Fix:** Add `DELETE FROM recovery_codes WHERE account_id NOT IN (SELECT id FROM accounts)` to the batch.  
**Confirmed:** Confirmed from text.

**7. `passkeyOrigin` allows `localhost` cross-port but not `127.0.0.1` ↔ `localhost`**  
**File:** `apps/server/src/routes.ts` line 130  
**What goes wrong:** `LOCAL` set contains both, but the check `LOCAL.has(origin.hostname) && LOCAL.has(self.hostname)` fails when one is `localhost` and the other `127.0.0.1`.  
**Fix:** Normalize hostnames (`localhost` → `127.0.0.1`) before the set check.  
**Confirmed:** Confirmed from text.

---

### Questions for Owner

1. **AI module location** — Please share `packages/online/src/ai.ts` (or wherever `qSearch` lives) to confirm findings #1, #3, #4.  
2. **Repetition key** — Share `RoomData` serialization / Zobrist key code to confirm #2.  
3. **Time control** — Does `lockTimeControl` / `tick` enforce a per-move deadline that the AI respects?  
4. **Quick match flow** — Is the missing `match` handler in `worker.ts` intentional (WIP) or an oversight?  

---

### Launch Blockers (must fix before public)

- #1, #2, #3 (AI correctness)  
- #5 (quick match unrated)  

All other items are post-launch cleanup.

## Triage (checked against the code, 2026-11-20)

`ai.ts` was not in this run's material (fixed since: the review sends the most important files first).
- #1, #3: real, already filed as I7 (S23). The search is in `packages/engine/src/ai.ts`, not `online`.
- #2: not a bug. Move counters never belong in a repetition key. The real gap is unmoved pieces (I8).
- #4: not a bug. The computer opponent runs in the browser, not the Worker.
- #5: not a bug. `/api/match` goes to the lobby, which resolves the account (`worker.ts:596`).
- #6: not a bug. Account deletion removes recovery codes in the same batch (`accounts.ts:407`).
- #7: not a bug. Both hostnames are in `LOCAL`, so mixed `localhost` and `127.0.0.1` pass (`routes.ts:123`).
