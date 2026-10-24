# Agent-to-agent MCP sprint — status

- **Start:** 2026-10-24 13:41 PDT · **Target end:** ~16:41 PDT (spec: 3 h; working token-efficiently) · **Freeze:** ~16:11
- **Branch:** `agent-sprint` (from `main` @ 0ca6dd8)
- **Backend:** Convex Cloud dev deployment `quirky-robin-694` (deploy key in `.env.local`), synced 13:55 with existing data preserved.
- **MCP SDK:** `@modelcontextprotocol/sdk` 1.32.2 (v1 API: McpServer, StreamableHTTPServerTransport, Client, StreamableHTTPClientTransport).

## Baseline (13:42)
Working: web console, Convex functions, Moss/Apify/Factory/x402 integrations, protected toy evaluators, e2e (23 steps).
Missing for this spec: MCP service, agent principals/scopes, local connector with disclosure gate, two distinct sample repos, quotes/entitlements/spend policy, Factory-as-repair-agent loop driven by MCP retrieval, agent activity console, adversarial checks.

## Owners
| Owner | Task | Status |
| --- | --- | --- |
| Lead | Contracts, Convex MCP backend (principals, quotes, policy, entitlements, outcomes, events), MCP HTTP service, connector, Factory repair loop, console, docs | in progress |
| Worker B | `sample-repos/` repo-a + repo-b with protected tests and fixed reference for A | done 13:45 |

## Progress
- 13:55 cloud synced; secrets: CDP present; APIFY/MOSS copied from local; FACTORY_RUNNER_SECRET reused; MCP_SERVICE_SECRET generated.
- 13:58 real MCP client: initialize/list/call OK.
- 14:02 Agent A: 3/5 → 5/5, gate, approval, MCP submit (clean); reviewer approved → published.
- 14:04 Agent B: x402 settled; Factory candidate 0/5 → rejected. 14:06 after documenting repo B interface: 5/5 accepted, runner_verified.
- 14:16 live adversarial 9/9; security tests 20/20; console built.
