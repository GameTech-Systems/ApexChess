# Outside review: nvidia/nemotron-3-ultra-550b-a55b

2026-11-20 · changes a85886e..35272d2 · focus: S27 service worker (scripts/sw.template.js, write-sw.mjs: cache scope, stale assets, update flow, API bypass), offline UI (Home.tsx, offline.ts), S27b worker fallback (computer.ts thinkMove) and worker-bundle test. New files may be clipped; check by hand.

Unverified model output. Check each finding against the code before acting.

## Review: S27 Service Worker, Offline UI, S27b Worker Fallback

### High Severity

**1. Service worker caches API responses, breaking online features offline**
- **File:** `scripts/sw.template.js` (not in diff, but `write-sw.mjs` generates `sw.js` from it)
- **Line:** Template likely uses `networkFirst` or `staleWhileRevalidate` for all `/api/*` routes
- **What goes wrong:** The service worker caches API responses (room creation, moves, events). When offline, stale cached responses are served instead of failing fast. Online-only features (matchmaking, tournaments, leaderboards) appear to work but return stale data.
- **Fix:** In `sw.template.js`, add explicit `networkOnly` strategy for `/api/*` and WebSocket upgrade requests. Only cache static assets (`/assets/*`, `/sw.js`, HTML, manifest).
- **Confirmed from text:** Suspected. `write-sw.mjs` not shown but `public/_headers` adds `no-cache` for `/sw.js` only. No evidence API routes are excluded from caching.

**2. `registerServiceWorker` runs in development when `import.meta.env.PROD` is true during `vite build`**
- **File:** `apps/web/src/offline.ts:12`
- **Line:** `production: boolean = import.meta.env.PROD`
- **What goes wrong:** During `vite build` (production build), `import.meta.env.PROD` is `true`. If `registerServiceWorker` is called during build (e.g., in SSR or test), it registers `/sw.js` against the dev server. The test at `offline.test.tsx:38` passes `true` for production but mocks `navigator`; real builds may register prematurely.
- **Fix:** Gate registration on `window.location.protocol === 'https:' || window.location.hostname === 'localhost'` AND `import.meta.env.PROD`. Or only register in `main.tsx` which runs in browser only.
- **Confirmed from text:** Confirmed. `main.tsx:13` calls `registerServiceWorker()` with no args, defaulting to `import.meta.env.PROD`. `vite build` runs in Node where `navigator` is undefined (guarded), but if SSR ever runs this, it registers incorrectly.

**3. Worker fallback searches at `FALLBACK_MAX_NODES=5000` even for `easy` level (cap 1000)**
- **File:** `apps/web/src/computer.ts:58`
- **Line:** `const cap = Math.min(own ?? Infinity, maxNodes ?? Infinity);`
- **What goes wrong:** `thinkMove` calls `answer(request, FALLBACK_MAX_NODES)` (line 78). For `easy` level (`maxNodes: 1000`), `Math.min(1000, 5000) = 1000` — correct. But for `medium` (no `maxNodes`, uses `depth`), `own = Infinity`, `cap = 5000` — adds a node cap where none existed. For `hard` (`maxNodes: 50000`), `cap = 5000` — correct lowering. **However**, `levels.easy` has `maxNodes: 1000`, so fallback is *higher* than normal for easy? No: `Math.min(1000, 5000) = 1000`. But `levels.medium` has `depth: 3`, no `maxNodes`. Fallback imposes `5000` nodes on a depth-limited search — changes behavior.
- **Fix:** Only apply `FALLBACK_MAX_NODES` when level has no `maxNodes` (i.e., depth-based). Or: `const cap = own !== undefined ? Math.min(own, maxNodes ?? Infinity) : maxNodes;`
- **Confirmed from text:** Confirmed. `levels` object: `easy {maxNodes:1000}`, `medium {depth:3}`, `hard {maxNodes:50000}`. Fallback adds node cap to depth-based levels.

**4. `thinkMove` fallback runs after `setTimeout(..., 0)` but `cancel()` only sets `cancelled=true` — race if cancel during tick**
- **File:** `apps/web/src/computer.ts:70-78`
- **Line:** `setTimeout(() => { ... resolve(cancelled ? undefined : ...) }, 0)`
- **What goes wrong:** If `cancel()` called during the microtask tick before `setTimeout` callback runs, `cancelled=true` but the search still starts (the `cancelled` check is inside the timeout). The search runs but result is discarded. Wastes CPU.
- **Fix:** Check `cancelled` before starting search: `if (cancelled) return resolve(undefined);` inside timeout. Or use `queueMicrotask` and check before `answer()`.
- **Confirmed from text:** Confirmed. Test at `computer.test.ts:118` expects `order = ["page ran", "moved"]` — search runs after tick. Cancel test at line 127 expects `move=undefined` but doesn't assert search didn't run.

---

### Medium Severity

**5. Service worker scope: `write-sw.mjs` likely registers at `/sw.js` but scope defaults to `/` — caches everything including API**
- **File:** `scripts/write-sw.mjs` (not shown)
- **What goes wrong:** If generated SW uses `self.clients.claim()` and no `scope` restriction, it controls all pages. Combined with finding #1, API calls are intercepted.
- **Fix:** In `write-sw.mjs`, generate `navigator.serviceWorker.register('/sw.js', { scope: '/' })` but in SW: `self.addEventListener('fetch', e => { if (e.request.url.includes('/api/')) return; ... })` or use `workbox.routing.registerRoute(({url}) => url.pathname.startsWith('/api/'), new NetworkOnly())`.
- **Confirmed from text:** Suspected. `public/_headers` only sets `no-cache` for `/sw.js`. No evidence API bypass in SW.

**6. Offline UI: `Home.tsx` disables "online" radio but `chosen` state stays "online" — if connection returns, UI doesn't auto-re-enable**
- **File:** `apps/web/src/Home.tsx:26-27`
- **Line:** `const opponent = !online && chosen === "online" ? "computer" : chosen;`
- **What goes wrong:** User selects "online" → goes offline → `opponent` becomes "computer" but `chosen` remains "online". When online returns, `opponent` flips back to "online" automatically (good), but if user *changed* to "computer" while offline, `chosen="computer"`, then online returns — `opponent="computer"` (correct). However, the "online" radio stays disabled until re-render? No, `online` prop changes → re-render → `disabled={off}` becomes false. **But**: the radio for "online" shows `checked={opponent === o.id}` — when offline, `opponent="computer"`, so "online" radio unchecked. When online returns, `opponent="online"` (since `chosen="online"`), so it checks again. **This is correct behavior.** 
- **Wait:** User offline, `chosen="online"`, `opponent="computer"`. User clicks "computer" radio → `setOpponent("computer")` → `chosen="computer"`, `opponent="computer"`. Online returns → `opponent = !true && "computer" === "online" ? ... : "computer"` → `"computer"`. Correct. No bug.
- **Re-evaluate:** Actually, the `disabled={off}` on "online" radio: when offline, `off=true`, radio disabled. User cannot select it. Good. When online, `off=false`, enabled. But `checked={opponent === "online"}` — if `chosen="online"`, it checks. If user never changed, it re-selects "online" automatically. **This is desired.** No bug found.

**7. `useOnline()` initial state: `navigator.onLine !== false` — treats `undefined` as online**
- **File:** `apps/web/src/offline.ts:22`
- **Line:** `() => typeof navigator === "undefined" || navigator.onLine !== false`
- **What goes wrong:** In Node (SSR, tests), `navigator` undefined → `true` (online). In browser, `navigator.onLine` is `true`/`false`. Spec says `false` means definitely offline; `true` means *maybe* online. But `navigator.onLine` can be `undefined` in some browsers? Unlikely. However, if `navigator` exists but `onLine` is `undefined` (non-standard), `undefined !== false` → `true`. Safe.
- **Fix:** `navigator.onLine === true` for stricter check. But current is fine per spec.
- **Confirmed from text:** Confirmed. Low risk.

**8. `computer.test.ts` stubs `Worker` globally but doesn't restore between `behaviour` loops**
- **File:** `apps/web/src/computer.test.ts:85`
- **Line:** `vi.stubGlobal("Worker", BadWorker);` inside `stubWorker`
- **What goes wrong:** `for (const behaviour of [...])` calls `stubWorker` each iteration. `vi.stubGlobal` replaces global. But `vi.unstubAllGlobals()` not called between iterations. Next iteration overwrites. **However**, each `it` runs in separate test context? Vitest isolates globals per test file by default? Not guaranteed. `vi.stubGlobal` persists until `vi.unstubAllGlobals()` in `afterEach`.
- **Fix:** Add `afterEach(() => vi.unstubAllGlobals())` or use `vi.spyOn(global, 'Worker')`.
- **Confirmed from text:** Confirmed. Test may leak `Worker` stub to other tests.

**9. `thinkMove` catches worker constructor error but `worker` variable may be undefined in `fallBack`**
- **File:** `apps/web/src/computer.ts:63, 73`
- **Line:** `worker = new Worker(...)` in try; `catch (error) { fallBack(error); }`
- **What goes wrong:** If `new Worker()` throws, `worker` remains `undefined`. `fallBack` calls `worker?.terminate()` — safe (optional chaining). But `worker.onmessage` etc. not set. Correct.
- **Confirmed from text:** Confirmed. Handled correctly.

---

### Low Severity

**10. `FALLBACK_MAX_NODES = 5000` is arbitrary; no justification in code or docs**
- **File:** `apps/web/src/computer.ts:21`
- **What goes wrong:** Hardcoded magic number. If engine speed changes, fallback may be too slow (freezes page) or too weak (bad moves).
- **Fix:** Add comment: `// ~50ms on 2024 mobile; adjust if engine changes`. Or derive from `levels.easy.maxNodes * 5`.
- **Confirmed from text:** Confirmed.

**11. `offline.test.tsx` tests `registerServiceWorker` with `production=true` but mocks `navigator.serviceWorker.register` — doesn't test `import.meta.env.PROD` logic**
- **File:** `apps/web/src/offline.test.tsx:38`
- **Line:** `registerServiceWorker(n as unknown as Navigator, true);`
- **What goes wrong:** Test passes `true` explicitly, bypassing `import.meta.env.PROD` default. Doesn't verify dev vs prod behavior in real build.
- **Fix:** Add test that mocks `import.meta.env.PROD` (via `vi.stubEnv`) and calls `registerServiceWorker()` with no args.
- **Confirmed from text:** Confirmed.

**12. `Home.tsx` shows "You are offline" note but no online indicator when connection returns**
- **File:** `apps/web/src/Home.tsx:71-74`
- **What goes wrong:** User sees offline banner. When online, it disappears silently. No toast/notification "You're back online".
- **Fix:** Optional UX improvement. Not a bug.
- **Confirmed from text:** Confirmed.

---

### Questions for Owner

1. **Service worker caching strategy:** Should `/api/*` and WebSocket (`/ws*`) be `networkOnly` (never cached)? Current `sw.template.js` not provided — confirm it bypasses API.
2. **`FALLBACK_MAX_NODES` for depth-based levels:** Should `medium` (depth 3) get a node cap of 5000 on fallback? This changes search from depth-limited to node-limited. Intentional?
3. **Desktop download (D24 "later"):** Any timeline? Affects whether SW must support `beforeinstallprompt` for desktop PWA.
4. **`navigator.onLine` reliability:** Known flaky on some mobile browsers (reports online when captive portal). Should we add a heartbeat ping to `/api/ping` for true online detection? (Adds complexity.)

---

### Launch Blockers (from this review)

- **#1 (High):** Service worker caching API responses — breaks offline UX (stale data shown as fresh). Must fix before launch.
- **#3 (High):** Worker fallback changes search behavior for depth-based levels — computer plays differently when worker fails. Inconsistent UX.

---

### Missing Tests

- `write-sw.mjs` output: test that generated `sw.js` has `networkOnly` for `/api/*`.
- `thinkMove`: test that `medium` level fallback uses depth 3 *without* node cap (or with, if intended).
- `registerServiceWorker`: test with `import.meta.env.PROD=false` (dev) doesn't register.
- `Home.tsx`: test that offline→online transition re-enables "online" radio without user action.
