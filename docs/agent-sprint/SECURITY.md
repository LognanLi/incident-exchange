# Security (SECURITY GATE)

**Never “injection-proof.”** Capabilities are enforced outside the model; heuristics only route content to review.

## Trust boundaries
Agent ↔ MCP service (bearer token, scopes) · MCP service ↔ Convex (service secret) · runner ↔ Convex (runner secret: append runs/events only) · payment signer (Convex Node action holding CDP wallet; agents never see keys) · local connector (filesystem, disclosure gate, patch policy) · Factory Droid (isolated temp workspace with only `src/`, tools Read/LS/ApplyPatch, autonomy low, env limited to PATH/HOME/FACTORY_API_KEY).

## Adversarial results
Automated: `tests/agent-security.test.ts` (12) and `tests/connector-policy.test.ts` (8) — all pass. Live through the MCP endpoint: `node connector/attack-check.mjs` (9/9 pass, 2026-10-24 14:16 PDT, cloud `quirky-robin-694`).

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
| Malicious Markdown | console renders text only; no `dangerouslySetInnerHTML` anywhere in `src/` (test) | PASS |
| Stale completion | runner record with pre-reset generation → `FORBIDDEN` (test); job updates ignored when stale/canceled | PASS |
| False claimed success | outcome without runner evidence → `reported_unverified` (live + test) | PASS |

## Residual risks
- Dev service tokens, not OAuth; HTTP on 127.0.0.1 (no TLS) — remote HTTPS deployment **BLOCKED** (no hosting).
- Factory Droid runs on the developer machine with a working-directory restriction + tool allowlist; not a VM/container sandbox. The protected runner uses a separate Node process but candidate code is executed (sample repo only).
- Pattern scanning can miss novel secrets/identifiers; human review remains the default for publication.
- Concurrency of acquisitions verified sequentially; true parallel races rely on Convex transaction serialization (not separately load-tested).
- Demo reviewer approval in `connector/demo.mjs` is a presenter-authorized policy, labeled as such.
