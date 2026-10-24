# Security (SECURITY GATE)

**Never “injection-proof.”** Capabilities are enforced outside the model; heuristics only route content to review.

## Trust boundaries
Agent ↔ MCP service (bearer token, scopes) · MCP service ↔ Convex (service secret) · runner ↔ Convex (runner secret: append runs/events only) · payment signer (Convex Node action holding CDP wallet; agents never see keys) · local connector (filesystem, disclosure gate, patch policy) · Factory Droid (isolated temp workspace with only `src/`, tools Read/LS/ApplyPatch, autonomy low, env limited to PATH/HOME/FACTORY_API_KEY).

## Adversarial results
Automated: `tests/agent-security.test.ts` (14), `tests/connector-policy.test.ts` (9), `tests/session.test.ts` (2) — all pass. Live through the MCP endpoint: `node connector/attack-check.mjs` (9/9 pass, 2026-10-24 14:46 PDT, cloud `quirky-robin-694`).

**Correction (14:30).** An independent review (`REVIEW.md`) found the earlier all-PASS table overstated two items: (1) candidate code ran in the same process as the protected tests, so a candidate could patch `assert` and fake 5/5; (2) the web app trusted a public org slug, so anyone could call Convex as the reviewer and read paid content. Both are fixed below; earlier "runner_verified" results from before 14:44 should not be relied on.

| Spec check | Evidence | Result |
| --- | --- | --- |
| Secret in source log | Agent A run: local gate dropped the canary line before network; staged bundle grep for canary/host/email/name = 0; server scan rejects `ix_canary_…` with categories only (live + test); DB/events dump contains no canary (test) | PASS |
| Prompt injection in guide | Live submit → `quarantined`; reviewer approve blocked; not searchable (test); Factory prompt wraps retrieved text as untrusted data (test) | PASS |
| Payee/budget injection | Live acquire with different payee → `FORBIDDEN`, no purchase; catalog guide over 0.01 policy → `BUDGET_EXCEEDED` | PASS |
| Cross-tenant read | Other contributor → `NOT_FOUND_OR_FORBIDDEN`; buyer → `FORBIDDEN` (scope) | PASS |
| Paywall bypass | `get_resolution` w/o purchase → `ENTITLEMENT_REQUIRED`; paid fix text absent from search/preview (test) | PASS |
| Wrong payment audience | B's purchase does not entitle principal C (test); x402 seller binds amount/payee to stored purchase | PASS |
| Retry/replay | same `clientRequestId` → same purchase; one accrual (test); Agent B rerun reused entitlement, no new payment (live) | PASS |
| Concurrent spend | reservation counts pending + settled; maxPurchases cap enforced (test, sequential; Convex OCC serializes mutations) | PASS (sequential) |
| Path traversal/symlink | symlink, traversal, non-editable file, new file → rejected (test) | PASS |
| Test tampering | candidate with tests rejected by runner guard; tests live outside the workspace (test) | PASS |
| Candidate vs. test process (S5) | Candidate now runs in a child process under Node `--permission` (reads limited to its dir + harness; no fs-write/child-process/worker); tests talk to it over IPC and keep all state. Attacks: assert monkeypatch → 2/5 (baseline), write to protected test → denied, `execSync` → denied, suite edited → refused by pinned `protectedSuiteSha256` | PASS |
| Candidate content (S3/S4) | Connector rejects candidates that add imports, `eval`/`Function`/dynamic `import()`, `require`, `process`, or `fetch`/WebSocket (test; live Factory patch accepted) | PASS |
| Web identity (S7/M4) | Convex requires an HMAC-signed demo session minted only by the local runner (`/session`, Origin required); bare slugs → "Demo session required" (live: `playbooks.get`, `overview`, `auditLog`, `demo.reset`); forged/tampered/expired tokens refused (test) | PASS (demo sessions, not real sign-in) |
| Simulator & earnings (S8) | Simulator only if the operator policy sets `allowSimulator`; missing CDP → `PROVIDER_UNAVAILABLE` (no silent fallback); only settled testnet sales accrue, simulated shown separately (test) | PASS |
| Double purchase | Second acquire of the same revision returns the existing purchase server-side (test) | PASS |
| Evidence reuse | One verified outcome per runner run; run must match the purchased revision (test) | PASS |
| Diff leakage (S1/S2) | Runner diffs/notes scanned; credential-like content refused and not stored (test) | PASS |
| Presenter endpoint | `/agent-demo` requires an allowed Origin and a reviewer session (live) | PASS |
| Malicious Markdown | console renders text only; no `dangerouslySetInnerHTML` anywhere in `src/` (test) | PASS |
| Stale completion | runner record with pre-reset generation → `FORBIDDEN` (test); job updates ignored when stale/canceled | PASS |
| False claimed success | outcome without runner evidence → `reported_unverified` (live + test) | PASS |

## Residual risks
- Dev service tokens, not OAuth; HTTP on 127.0.0.1 (no TLS) — remote HTTPS deployment **BLOCKED** (no hosting).
- Factory Droid runs on the developer machine with a working-directory restriction + tool allowlist; not a VM/container sandbox.
- Node's permission model has no network control: the runner's child process could open sockets. The connector content check blocks `fetch`/WebSocket/new imports, but obfuscated code could evade a pattern check. An OS-level sandbox is the real fix.
- Demo sessions are a stand-in for sign-in: anyone who can reach the local runner from an allowed browser origin can mint one. Not a production identity system.
- MCP rate limiting: per-token after authentication plus a global failed-auth cap (30/min); in-memory, single process.
- Pattern scanning can miss novel secrets/identifiers; human review remains the default for publication.
- Concurrency of acquisitions verified sequentially; true parallel races rely on Convex transaction serialization (not separately load-tested).
- Demo reviewer approval in `connector/demo.mjs` is a presenter-authorized policy, labeled as such.
