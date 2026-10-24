# Agent-to-agent MCP sprint — status

- **Start:** 2026-10-24 13:41 PDT · **Target end:** ~16:41 PDT (spec: 3 h; working token-efficiently) · **Freeze:** ~16:11
- **Branch:** `agent-sprint` (from `main` @ 0ca6dd8)
- **Backend:** Convex **local anonymous deployment** (`npx convex dev`); Convex Cloud is NOT configured in this workspace → I1 recorded as local, cloud deployment BLOCKED until `npx convex login && npx convex deploy`.
- **MCP SDK:** `@modelcontextprotocol/sdk` 1.32.2 (v1 API: McpServer, StreamableHTTPServerTransport, Client, StreamableHTTPClientTransport).

## Baseline (13:42)
Working: web console, Convex functions, Moss/Apify/Factory/x402 integrations, protected toy evaluators, e2e (23 steps).
Missing for this spec: MCP service, agent principals/scopes, local connector with disclosure gate, two distinct sample repos, quotes/entitlements/spend policy, Factory-as-repair-agent loop driven by MCP retrieval, agent activity console, adversarial checks.

## Owners
| Owner | Task | Status |
| --- | --- | --- |
| Lead | Contracts, Convex MCP backend (principals, quotes, policy, entitlements, outcomes, events), MCP HTTP service, connector, Factory repair loop, console, docs | in progress |
| Worker B | `sample-repos/` repo-a + repo-b with protected tests and fixed reference for A | queued |
