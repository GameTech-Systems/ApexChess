# Outside review: nvidia/nemotron-3-ultra-550b-a55b

2026-11-23 · changes 35272d28ddbef3c0073c47344918fa7a435a4a12..06cf475 · focus: S30 changes: per-address rate limits (apps/server/src/limits.ts, wrangler.jsonc), account deletion dropping pending challenges, accounts/room abuse tests; server auth, privacy, correctness

Unverified model output. Check each finding against the code before acting.

### High Severity

**1. Account deletion leaves passkeys and recovery codes in the database**  
**File:** `apps/server/src/accounts.ts`, line 413  
**What goes wrong:** The `DELETE FROM accounts` statement runs, but the preceding batch deletes from `passkeys`, `recovery_codes`, `sessions`, and `ratings` using `account.id`. However, `account.id` is the internal integer primary key, while `passkeys.account_id` and `recovery_codes.account_id` are text columns storing the account's public ID (the `id` column from `accounts` is `INTEGER PRIMARY KEY`, but the code uses `account.id` which is the integer). The schema (from prior context) shows `passkeys.account_id` and `recovery_codes.account_id` reference `accounts.id` (integer). But the test `deletes the account's pending challenges too` checks that no table keeps a row naming the account's public ID (`id` from `rows("accounts")[0]!.id as string`). The test passes because it only checks `challenges` table and string matching. The passkeys and recovery codes remain orphaned.  
**Fix:** Ensure the batch uses the correct column. If `passkeys.account_id` and `recovery_codes.account_id` are integers referencing `accounts.id`, the current code is correct. But the test uses `id` as string (public ID). Need to verify schema. Since I cannot run tools, I suspect the schema uses integer foreign keys. The test's string match would not catch integer rows.  
**Confirmed from text:** No (schema not in diff). Suspected from test logic mismatch.

**2. Rate limit bindings in `wrangler.jsonc` not validated for correct namespace isolation**  
**File:** `apps/server/src/limits.test.ts`, lines 89–106  
**What goes wrong:** The test checks that each limit has its own `namespace_id` and that limits are tighter than `LIMITER`. However, it does not verify that the `namespace_id` values are actually distinct per binding (only that the set size equals the number of bindings). If two bindings share a namespace, they share counters, breaking per-endpoint isolation.  
**Fix:** Change `expect(new Set(config.ratelimits.map((l) => l.namespace_id)).size).toBe(by.size);` to explicitly assert each `namespace_id` is unique per binding name.  
**Confirmed from text:** Yes (test code visible).

**3. `overLimit` checks general limit first, then specific limit — but both consume a request**  
**File:** `apps/server/src/limits.ts`, lines 33–38  
**What goes wrong:** `overLimit` calls `env.LIMITER.limit({ key })` and then `env[name].limit({ key })`. Each call increments the respective counter. A request that hits the specific limit first still consumes a general limit token. This is intentional (defense in depth), but the test `still applies the general limit to a limited endpoint` expects this. However, if the general limit is exhausted, the specific limit is never checked — the request is rejected at general limit. That's correct.  
**No bug found.** The order is correct: general first, then specific.

---

### Medium Severity

**4. Recovery code brute-force not limited per handle, only per address**  
**File:** `apps/server/src/accounts.test.ts`, lines 370–390 (test)  
**What goes wrong:** The test `repeated wrong recovery codes never sign in, burn a real code, or say whether the handle exists` sends 25 wrong codes for both an existing and non-existing handle from the same address. It expects no lockout and same error message. This confirms the design: rate limit is per address only. An attacker can try many codes for many handles from one IP. The owner accepted this (HANDOFF.md: "Recovery attempts are limited per address only, not per handle; a per-handle lockout would need a table. Default: leave as is.").  
**Risk:** Credential stuffing via recovery codes.  
**Fix:** If owner wants per-handle tracking, add a `recovery_attempts` table. Otherwise, document as accepted risk.  
**Confirmed from text:** Yes (HANDOFF.md and test).

**5. Account deletion does not remove `handle_reports` rows referencing the deleted handle**  
**File:** `apps/server/src/accounts.ts`, line 413 (deletion batch)  
**What goes wrong:** The deletion batch does not include `handle_reports`. HANDOFF.md says: "`handle_reports` rows are kept when the reported account is deleted (reports are others' data). Default: keep." This is intentional. But the test `deletes the account's pending challenges too` checks that no table keeps a row naming the account's public ID or handle. It iterates `sqlite_master` tables and asserts no match for `id|RookLover|cred-1|sessionHash`. If `handle_reports` exists and stores the reported handle, the test would fail. The test passes only if `handle_reports` is not in `sqlite_master` (maybe not created in test DB) or doesn't store the handle.  
**Fix:** Ensure test DB includes `handle_reports` and verify behavior matches policy.  
**Confirmed from text:** Partially (HANDOFF.md states policy; test may not cover it).

**6. `limits.test.ts` fakes `RateLimit` but real Cloudflare bindings have different semantics**  
**File:** `apps/server/src/limits.test.ts`, lines 10–20  
**What goes wrong:** The fake `limit` function increments a counter per key and returns `success: n <= max`. Real Cloudflare rate limits are sliding window, not fixed counter. The test validates logic but not timing behavior (e.g., burst at window boundary).  
**Fix:** Accept as unit test limitation; add integration test note in HANDOFF.md.  
**Confirmed from text:** Yes (test uses fake).

---

### Low Severity

**7. `wrangler.jsonc` parsing in test strips comments and trailing commas — fragile**  
**File:** `apps/server/src/limits.test.ts`, lines 91–94  
**What goes wrong:** The test reads `wrangler.jsonc`, removes `//` comments and trailing commas via regex, then parses as JSON. This breaks if JSONC has block comments `/* */` or strings containing `//`.  
**Fix:** Use a proper JSONC parser (e.g., `jsonc-parser`) or validate deployed bindings via Cloudflare API in CI.  
**Confirmed from text:** Yes (regex visible).

**8. `SESSION_MS` used in test but not defined in diff**  
**File:** `apps/server/src/accounts.test.ts`, line 11 (import) and line 400 (usage)  
**What goes wrong:** `SESSION_MS` is imported from `./accounts` but not shown in diff. If missing, test fails.  
**Fix:** Ensure `accounts.ts` exports `SESSION_MS`.  
**Confirmed from text:** Suspected (import present, definition not in diff).

**9. `route` function in `limits.test.ts` may not cover all endpoints**  
**File:** `apps/server/src/limits.test.ts`, lines 22–35  
**What goes wrong:** The test checks `limitFor` for known routes but does not verify all `/api` routes are routed. A new endpoint could miss rate limiting.  
**Fix:** Add a test that enumerates all routes from `routes.ts` and asserts `limitFor` returns a value or `undefined` intentionally.  
**Confirmed from text:** Suspected (test only checks listed cases).

---

### Questions for Owner

1. **D21:** Publish ruleset 1.0 or stay on draft 0.1 for beta? (HANDOFF.md)  
2. **Recovery rate limit:** Confirm per-address only is acceptable; no per-handle lockout.  
3. **`handle_reports` retention:** Confirm keeping reports after account deletion is desired.  
4. **Rate limit values:** All limits in `wrangler.jsonc` are provisional — confirm before launch.  
5. **D17 confirmation:** Needed per HANDOFF.md.  
6. **D25 (PGN tags):** Required before S33.  

---

### Launch Blockers

- **None confirmed**, but:
  - Rate limit values in `wrangler.jsonc` are provisional — must be finalized.
  - Account deletion orphan risk (passkeys/recovery_codes) if schema uses public ID as FK — must verify schema.
  - No integration test for real Cloudflare rate limit behavior.

---

### Missing Tests

1. **Account deletion:** Verify `passkeys`, `recovery_codes`, `sessions`, `ratings`, `challenges`, and `handle_reports` are cleaned per policy.
2. **Rate limits:** Test sliding window behavior (burst at period boundary) with real bindings (requires Cloudflare test env).
3. **Recovery codes:** Test that a used code cannot be reused even across sessions (covered in `a recovery code works once`).
4. **Session expiry:** Test `SESSION_MS` boundary (covered in `refuses a session at its expiry moment`).
5. **Route coverage:** Automated test that every `/api` route has a `limitFor` decision.
