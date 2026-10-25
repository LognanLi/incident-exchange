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
- 14:17 console “Run two-agent demo” clicked in Chrome → job succeeded in 43 s: A 3/5→5/5, B 2/5→5/5 (new Factory Droid session), runner_verified; B reused its existing entitlement (no second payment).

- 14:25 independent review: 15 defects, 2 critical (runner isolation, slug identity). Gate re-opened.
- 14:31 runner isolation rebuilt (child process + `--permission`, pinned suite hashes); 4 attacks fail.
- 14:35–14:44 signed demo sessions; operator-only reset/demo; simulator policy flag; no silent fallback; testnet-only accruals; double-purchase guard; evidence one-per-run + revision bound; diff scan; candidate content check; rate limit after auth; case-insensitive denies.
- 14:39 a demo reset was issued from a browser session on the cloud deployment (demo data only); data re-created by the rehearsal.
- 14:44 rehearsal 92 s; 14:46 live attacks 9/9; 69 + 14 tests.
- 15:00 UI redesign merged into PR #2.
- 15:20–16:00 final push: isolated e2e 23/23 (disposable local Convex); OS network sandbox (macOS sandbox-exec) for all candidate execution, refuse-without-sandbox; remote HTTPS MCP on Convex with OAuth client_credentials (13/13); Moss root cause fixed, semantic search verified with a paraphrase.
- 15:35 web console published on Convex: https://quirky-robin-694.convex.site/ (static files in Convex storage, served by an HTTP action; access-code sessions). Simulated-payment walkthrough on the hosted site delegated to a tester.

## Requirement results
P1–P5 PASS · M1 PASS (real SDK client over HTTP) · M2 PASS · M3 PASS · M4 PASS · M5 PASS (generation guard; cloud state persists) · C1–C5 PASS (C2 live Base Sepolia) · S1–S8 PASS per SECURITY.md (S7 uses signed demo sessions, not real sign-in; execution sandbox verified on macOS only) · I1 PASS (Convex Cloud **dev** deployment; also hosts the web console and remote MCP) · I2 Moss live for Q&A and for semantic search on the cloud deployment (fixed 2026-10-24 17:45 PDT; labeled keyword fallback only on Moss failure) · I3 PASS · I4 PASS (live Droid artifacts) · I5 Armadin unavailable · Q1–Q4 PASS.
Remote HTTPS MCP: live on Convex HTTP actions with OAuth client_credentials (13/13 remote checks). Not done: end-user OAuth (authorization code + PKCE), Linux sandbox verification. Moss semantic search on cloud: working since 17:45 (queries run in a child worker process with a writable model cache).

## Next three tasks
1. Run candidate execution in a container/VM (Docker is installed here but the daemon was not running) and verify the Linux `unshare` path in CI.
2. ~~Make the Convex Moss action load its embedding model on the cloud runtime~~ Done 2026-10-24 17:45 PDT (branch `moss-cloud-fix`).
3. Add end-user OAuth (authorization code + PKCE) and per-client rate limits on the remote endpoint.
