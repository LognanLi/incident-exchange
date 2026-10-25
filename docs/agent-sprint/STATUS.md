# Agent-to-agent MCP sprint — status

## Submission synchronization — 2026-10-25

Current state and mismatches are in [SUBMISSION_AUDIT.md](SUBMISSION_AUDIT.md). Audit baseline `main` is `f1388f9`, with no open PRs or uncommitted work. The synchronization changes expose presenter mode on hosted Agents/access gate, handle presenter links in an already-open tab, connect real agent Factory invocations to sponsor status, and correct stale operational/sponsor claims. The owner merges PRs manually; release only merged `main` using [DEPLOY.md](../DEPLOY.md).

The main product has 11 MCP tools and two published repair scenarios. Viewer mode intentionally has no Run demo; live execution requires the local runner and an operator session. No shared reset, new credentials, production target or unnecessary payment is part of this work.

## Historical sprint log — 2026-10-24

Earlier branches, “in progress” rows and next tasks below are retained history.

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
- 17:30–18:40 (Claude, branches `moss-cloud-fix` → PR #7 and `sprint-cleanup`): Moss semantic search fixed on cloud (child worker with writable model cache); remote MCP and token endpoint rate limits; Linux `unshare` sandbox verified in Docker; approved duplicate cleanup applied (kept `…k58gxmf0`, deactivated `…w98gxb3w` and `…298gxbmt`, deleted 5 quarantined attack-check drafts; dry run first, via `maintenance.dedupeWebhookGuides`); live two-agent run 18:33 passed (Moss search, new x402 settlement `0xf5469b05…`, Factory 5/5, `runner_verified`); recording refreshed and console republished; Zen presenter check user-reported only (see PRESENTING.md).
- 18:45–19:05 presenter readiness: `main` (08318d3) confirmed identical to the deployed functions and web bundle. Diagnosis: the hosted Zen check never ran presenter mode (no presenter flag in Zen's site data). Primary presenter path is now `localhost:5173`. Run demo failed from non-reviewer roles (runner refusal) and now always starts as the Review Desk. **18:59:02 the shared data was reset by an operator session through the one-click Demo → Reset button** (old guides and purchase records gone; on-chain txs remain; the user chose to keep the fresh state). Reset now asks for confirmation. Live run started from Zen at 19:01 passed (runner log + console), and the recording was refreshed from it.
- 15:35 web console published on Convex: https://quirky-robin-694.convex.site/ (static files in Convex storage, served by an HTTP action; access-code sessions). Simulated-payment walkthrough on the hosted site delegated to a tester.

## Requirement results
P1–P5 PASS · M1 PASS (real SDK client over HTTP) · M2 PASS · M3 PASS · M4 PASS · M5 PASS (generation guard; cloud state persists) · C1–C5 PASS (C2 live Base Sepolia) · S1–S8 PASS per SECURITY.md (S7 uses signed demo sessions, not real sign-in; execution sandbox verified on macOS, and the Linux `unshare` path verified in Docker) · I1 PASS (Convex Cloud **dev** deployment; also hosts the web console and remote MCP) · I2 Moss live for Q&A and for semantic search on the cloud deployment (fixed 2026-10-24 17:45 PDT; labeled keyword fallback only on Moss failure) · I3 PASS · I4 PASS (live Droid artifacts) · I5 Armadin unavailable · Q1–Q4 PASS.
Remote HTTPS MCP: live on Convex HTTP actions with OAuth client_credentials (13/13 remote checks). Rate-limited since 18:06 (120 MCP requests/min per principal, 20 tokens/min per client, 30 failed auths/min shared). Not done: end-user OAuth (authorization code + PKCE). Moss semantic search on cloud: working since 17:45 (queries run in a child worker process with a writable model cache).

## Next three tasks
1. Run the Linux sandbox check in CI (`scripts/linux-sandbox-check.sh`; GitHub's ubuntu runners restrict unprivileged user namespaces via AppArmor, so expect the fail-closed path unless that's relaxed). Verified locally in Docker 2026-10-24.
2. ~~Make the Convex Moss action load its embedding model on the cloud runtime~~ Done 2026-10-24 17:45 PDT (branch `moss-cloud-fix`).
3. Add end-user OAuth (authorization code + PKCE). Remote rate limits done 2026-10-24 18:06 PDT.
