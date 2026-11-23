# Outside review: moonshotai/kimi-k3.1-pro

2026-11-23 · changes 35272d28ddbef3c0073c47344918fa7a435a4a12..06cf475 · focus: S30 changes: per-address rate limits (apps/server/src/limits.ts, wrangler.jsonc), account deletion dropping pending challenges, accounts/room abuse tests; server auth, privacy, correctness

Unverified model output. Check each finding against the code before acting.

I can review this, but the provided diff is truncated and does not include `wrangler.jsonc`, `routes.ts`, or the room-abuse tests. Findings below are limited to what the supplied text supports.

## Findings

### 1. High — Recovery attempts can be distributed across addresses to bypass the only attempt limit
**Files:** `apps/server/src/limits.ts:30-39`; `docs/HANDOFF.md`, “Open questions for the owner”  
**Status:** Confirmed from the text that limiting is per address only; exploitation depends on an attacker having multiple addresses.

`RECOVER` uses `clientKey(headers)` as its sole key. There is no per-handle or per-account attempt counter. Consequently, changing source addresses gives an attacker fresh recovery attempts against the same handle. The new abuse test makes 25 attempts per handle but does not test address rotation.

This is especially important because recovery codes are account credentials, not merely expensive operations. A per-address limit helps against a single source but does not establish a bounded number of guesses per account.

**Concrete fix:** Add a persistent per-handle/per-account recovery-attempt limit, ideally using a normalized handle hash rather than retaining plaintext attempt history. Apply it before checking whether the handle exists, return the same generic response for existing and nonexistent handles, and expire/reset the counter on a defined schedule. Keep the per-address limit as an additional control. Add a test showing attempts from many addresses cannot exceed the per-handle allowance.

### 2. High — The new recovery test appears to contradict itself and may not exercise the intended successful path
**File:** `apps/server/src/accounts.test.ts`, added abuse block, approximately lines 374-390  
**Status:** Confirmed from the supplied test text; helper behavior is unavailable.

The test first performs 25 iterations over two handles and four wrong-code values. It then calls:

```ts
await recover(handle, "AAAA-AAAA-AAAA-AAAA")
```

inside `try/catch`, collecting error messages. Immediately afterward it expects:

```ts
(await recover("RookLover", codes[0]!)).token
```

to succeed.

If `recover` rejects for invalid codes, the earlier loop would reject on its first iteration unless `code()` is somehow involved in those calls—which it is not. If `recover` resolves with a failure result instead, the later `try/catch` collects no messages and `messages.size` is zero. Either interpretation makes the test internally inconsistent.

**Concrete fix:** Establish one contract for `accountAction`: either always return coded failures and assert those codes, or always throw and wrap every call in a helper that converts exceptions to codes. Use that same helper in both loops. Assert the generic failure body/code directly, then verify a valid code still succeeds.

### 3. Medium — Account deletion only removes challenges with exactly `purpose.accountId`
**File:** `apps/server/src/accounts.ts:406-418`  
**Status:** Confirmed that deletion is narrowly scoped; whether other challenge forms retain account identifiers cannot be determined from the supplied material.

The new deletion statement is:

```sql
DELETE FROM challenges
WHERE json_extract(purpose, '$.accountId') = ?
```

This removes only challenges whose account identifier is stored at that exact JSON path. Challenges associated through another field, nested structure, credential ID, or handle would survive. The test covers only a pending `passkey` challenge and therefore proves only that one shape is deleted.

There is also a schema-integrity concern: if `purpose` is not valid JSON, `json_extract` can cause the deletion batch to fail rather than reliably deleting the account.

**Concrete fix:** Prefer a typed, indexed `account_id` column on `challenges`, populated for every account-associated challenge, with a foreign key and `ON DELETE CASCADE`. If JSON must remain, enumerate every challenge purpose and add deletion tests for each one, including register, sign-in, passkey addition, and any future authenticated challenge. Add malformed/NULL-purpose coverage if the database does not guarantee valid JSON.

### 4. Medium — The deletion test’s “no table keeps a row that names it” assertion is weaker than its title
**File:** `apps/server/src/accounts.test.ts`, final added deletion test  
**Status:** Confirmed.

The test checks serialized table contents for the account ID, handle, one credential string, and session hash. It does not establish referential integrity or detect orphaned rows whose relationship is stored under another identifier. It also depends on the fake database exposing `sqlite_master` and behaving like D1/SQLite for JSON extraction and batch transactions.

Additionally, `handle_reports` is intentionally retained according to the handoff. If a report stores the reported handle, the blanket assertion that no table contains `RookLover` will conflict with that policy once such a report exists.

**Concrete fix:** Assert exact row counts per relevant table before and after deletion, including challenges and reports. Add foreign-key enforcement where appropriate. Separately test the documented report-retention policy instead of using a universal substring assertion.

### 5. Medium — Rate limiting is fail-closed only if every binding is present and functional; there is no production integration coverage
**Files:** `apps/server/src/worker.ts:66-73, 219-223`; `apps/server/src/limits.test.ts`, final describe block  
**Status:** Confirmed as a testing gap; production failure is not confirmed.

`Env` now requires four additional bindings, and every limited request directly accesses `env[name].limit(...)`. A missing binding in any deployed environment will produce a runtime exception. The tests use fakes and inspect configuration names, but the handoff explicitly says Worker rate-limit bindings are not run by Vitest.

The configuration test also strips comments and trailing commas with regular expressions rather than parsing JSONC with the actual Wrangler configuration loader, so it can drift from deployment behavior.

**Concrete fix:** Add a deployment preflight using `wrangler deploy --dry-run` or an equivalent configuration validation, plus a deployed smoke test for each limited endpoint. Validate configuration with Wrangler’s own parser. Consider a controlled fail-closed error path with logging if a binding is absent, rather than an unhandled property-access exception.

### 6. Medium — The endpoint-limit tests do not verify HTTP behavior or routing integration
**Files:** `apps/server/src/limits.test.ts`; `apps/server/src/worker.ts:219-223`  
**Status:** Confirmed as missing coverage.

Despite the describe title “endpoint limits answer 429,” the tests call `overLimit` directly. They do not invoke the Worker and verify:

- status 429 and the public error body;
- that limited requests never reach account/room handlers;
- ordering relative to body parsing and authentication;
- behavior when a limiter throws;
- actual `cf-connecting-ip` handling;
- WebSocket upgrade behavior;
- binding behavior in a real Worker environment.

**Concrete fix:** Add Worker-level tests with mocked bindings and spies on downstream handlers. Assert 429, no handler invocation, no sensitive response differences, and correct behavior for missing/forwarded IP headers. Keep at least one deployed smoke test because local fakes cannot reproduce Cloudflare binding semantics.

### 7. Low — Per-address limiting can deny shared-network users, while the error always says to wait a minute
**Files:** `apps/server/src/limits.ts:30-39`; `apps/server/src/worker.ts:222-223`; `apps/server/src/limits.test.ts`, configuration assertions  
**Status:** Confirmed from the text; practical impact depends on actual configured periods and traffic.

All users behind the same `clientKey` share an allowance. The configuration test permits periods of either 10 or 60 seconds, but the response always says “Wait a minute.” That message can be inaccurate and gives no distinction between general and endpoint-specific limits.

**Concrete fix:** Use a generic “Too many requests; try again shortly” message or return an accurate `Retry-After` where supported. Choose and document limits with shared networks in mind, and monitor 429 rates as already noted in the handoff.

## Questions for the owner

1. What is the intended recovery-code security model: should guesses be bounded per account, per handle, or only per source address? The handoff calls per-handle lockout undecided, so this should not be treated as a confirmed rules requirement.
2. Should account deletion retain handle reports even when they contain the deleted handle? The handoff says reports are others’ data, but the privacy implications of retaining the handle itself are not specified.
3. Are rate limits intended to fail closed if a binding is unavailable, or should availability take precedence?

## Missing tests most worth adding

- Recovery attempts distributed across many source addresses against one handle.
- Every challenge purpose deleted with its account, including concurrent finish/delete attempts.
- Worker-level 429 responses and proof that downstream handlers are not called.
- Missing or throwing rate-limit bindings.
- Real deployed binding smoke tests.
- Shared-IP behavior and accurate retry responses.
- Room/event abuse coverage in the supplied diff was mentioned but not shown, so its adequacy cannot be assessed.
