> Historical handoff snapshot preserved before the submission synchronization audit. This is not a current task list.

# Incident Exchange — agent handoff

You are taking over **Incident Exchange**, a working hackathon project. Read the current status first; the older snapshots below are retained as history and may describe issues already fixed. Never print, log, or commit secret values. Refer to secrets only by variable name.

## Current status — 2026-10-25 00:33 PDT

- **Code:** PR #16 was manually merged by the owner. The application merge commit is `997f18090d68efc41557f16a852400cedb8b784e` on `main`, also on `origin/main`. No PRs are open. The two older worktrees (`product-ui`, `scenario-tenant`) are clean and their work is merged. No local branch has an unpublished commit.
- **Activity and payments:** finished and verified. See [`docs/agent-sprint/ACTIVITY_PAYMENTS.md`](../../docs/agent-sprint/ACTIVITY_PAYMENTS.md) for the demonstration, additive schema changes, checks and limitations. The Agents console includes inspectable event evidence, exact payment receipts and earnings, recorded replay, denial/failure inspection, and local runner health. Recordings and cross-organization views omit private patches and notes.
- **Deployment:** at 00:32 PDT, redeployed the backend/schema with `npx convex dev --once` and the hosted console with `npm run deploy:web`, both from merged `main`. The existing target is the **dev** deployment `quirky-robin-694`; production is still unconfigured. Hosted URL: <https://quirky-robin-694.convex.site/>. Five web files published; the hosted index and both JS/CSS files exactly match the local build (`index-olaW46PI.js`, `index-BFky7hsa.css`).
- **Fresh checks:** typecheck, 158 Vitest tests, 14 toy tests, and build passed. Remote MCP/OAuth checks passed 13/13, including actual Moss semantic search. GitHub CI passed on the application merge commit. Both existing Base Sepolia receipts were verified against successful USDC transfers: 2 testnet sales, gross `20000`, contributor accrual `16000`, platform share `4000`, paid out `0` atomic USDC; 1 simulated purchase excluded. No reset, credential rotation or new purchase was performed.
- **Browser evidence:** the 2026-10-24 activity sprint checked desktop/mobile rendering, keyboard event expansion, replay seeking, receipt links, denial/failure filters, a disconnected runner, hosted viewer access and accessibility. Both webhook and tenant scenarios completed with Factory and protected tests while reusing existing entitlements. The recording is a real tenant run; its provenance truthfully records the pre-commit working tree.
- **Presenter startup:** Vite on `:5173`, Factory runner on `:3299`, and local MCP on `:8787` remain running. Runner health returned HTTP 200. No Convex watcher was running during deployment. Use the existing local presenter flow; do not reset shared cloud data or rotate agent tokens for a deployment.

## Historical snapshots

The sections below are dated context, not a current task list. In particular, older references to open PRs, broken cloud Moss search, missing rate limits, old recordings, test counts or undeployed activity work are superseded above and by the linked sprint notes.

---

## 000. Update 2026-10-24 ~20:50 PDT (historical)

Product sprint toward the 2026-10-25 09:00 submission. Full status: `docs/agent-sprint/PRODUCT_SPRINT.md`.
- **New:** `check_applicability` fit checks (match / conflict / needs verification, no scores), `get_my_access`, `scripts/issue-agent.mjs`, `connect-check.mjs` (hosted), `/connect` page, `CONNECT.md`, scenario 2 (tenant authorization, repo-c → repo-d), scenario picker, fit-check privacy, `docs/SUBMISSION.md`.
- **PRs:** #10–#12 merged; **#13 open** (integration). After it merges: redeploy from `main` (`npx convex dev --once`, `npm run deploy:web`).
- **Data:** guides `…kd8gypc7` (dedupe, has conditions) and `…ax8gyem5` (tenant). Agent B owns both (x402 `0x0ab34ed0…`, `0x385e800e…`) and is at its 2-purchase cap; rehearsals reuse those purchases. `juniper-agent` (Juniper Ledger) holds 1 simulated purchase and expires 2026-10-27.
- **Verified tonight:** fresh Claude Code onboarding; both scenarios live, from the terminal and from Zen; decline demo (`node connector/fit-check.mjs k9780ry9926p820jstccf0qdax8gyem5`); attack 9/9; remote 13/13; 111 + 14 tests.

## 00. Update 2026-10-24 ~19:10 PDT (historical)

- PRs #7 and #8 are merged. `main` @ 08318d3 was confirmed identical to the deployed functions and the hosted web bundle (`index-HGX2ZZpC.js`). **PR #9 `presenter-readiness` is open**: Run demo works from any role, Reset asks for confirmation, runner logs `[agent-demo]` lines, recording refreshed, PRESENTING quick start. After it merges, run `npm run deploy:web`; it has no Convex function changes.
- **Presenter path = `http://localhost:5173` in Zen** (no local-network permission involved). Verified 19:01 from the runner log (session → run requested → started → exit 0 after 91 s) and the user's console view. Hosted `#presenter` in Zen is still unverified (Zen's site data had no presenter flag, so the earlier check never ran presenter mode).
- **18:59:02 the shared data was reset** by an operator session using the one-click Reset button. The cleanup state and old purchase records are gone; the on-chain txs remain. The user chose to keep the fresh state: one webhook guide `…kd8gypc7` and one settled purchase (19:01, `0x0ab34ed0…`), so later runs reuse that entitlement.
- Still deferred by the user: production, end-user OAuth, Linux CI.

## 0. Update 2026-10-24 ~18:45 PDT (historical)

- **Open PRs:** #7 `moss-cloud-fix` (Moss semantic search fixed on cloud) and #8 `sprint-cleanup` (stacked on #7: remote rate limits, removed `mcp.publicPreviews`, `maintenance.dedupeWebhookGuides`, Linux sandbox check script, refreshed recording, docs). Merge #7, then #8. **The cloud deployment already runs `sprint-cleanup` @ its head**, so deploy only from a branch that contains it.
- **Task 1 done.** Root cause: Convex `process.env` doesn't reach the native Moss core's OS environment, HOME is unset, and the passwd home is read-only, so the model cache write failed. Queries now run in a child Node worker with `HOME`/`MOSS_MODEL_CACHE_DIR` under `/tmp`. protocol-check/remote-check search lines read "via Moss semantic search" (≈5 s cold, 40–110 ms warm).
- **Task 2:** the user reported Zen showed *Presenter mode* after a hard reload, but the runner logged no browser request. Recorded as user-reported in PRESENTING.md. Safari still unchecked.
- **Task 3 done** (user approved): kept `…k58gxmf0`, deactivated `…w98gxb3w` and `…298gxbmt`, deleted the 5 quarantined drafts. A live run at 18:33 then made one new 0.01 test-USDC purchase (tx `0xf5469b05…`), so later runs reuse that entitlement. The next `attack-check` will create one new quarantined injection draft (the one it used to reuse was deleted).
- **Task 4 decisions:** (a) viewers **keep** x402 test payments (no change); (b) production **not now**.
- **Task 5:** remote and token endpoint rate limits done; Linux `unshare` verified in Docker (`scripts/linux-sandbox-check.sh`, SECURITY.md); `BUILD_STATUS.md`/`docs/DEPLOY.md` refreshed; `mcp.publicPreviews` removed; `e2e/a11y.mjs` already exits 1 on violations (stale item). Remaining: Linux check in CI, end-user OAuth (PKCE), Safari presenter check.
- Tests are now 84 Vitest + 14 toy. No dev processes left running.

## 1. Product and customer

**Developer problem.** When an on-call engineer or their coding agent hits a bug, someone at another company has often already fixed the same failure pattern. That knowledge is locked in private postmortems and code.

**Product.** An **agent-to-agent marketplace for reusable bug resolutions**:

1. **Contribute.** Agent A fixes a bug in its own repo and verifies it with protected tests. It stages a **locally sanitized** "resolution bundle" (credentials dropped, identifiers generalized). It uploads only after the developer approves the exact content hash.
2. **Review.** A human reviewer checks the evidence and approves an exact revision. With the contributor's consent, the revision is published as a guide with a free preview and paid details.
3. **Search.** Agent B searches over MCP with sanitized symptoms. Results are ranked by fit, explain matched and missing clues, and say "no relevant match" honestly.
4. **Purchase.** Agent B gets a quote bound to the revision, price, payee, network and asset. It checks the quote against its operator's pinned policy, then pays with test USDC over **Coinbase x402 on Base Sepolia**, within a spend policy.
5. **Adapt.** **Factory Droid** adapts the purchased fix inside an isolated temp copy of Agent B's repo. Its tools are limited to Read, LS and ApplyPatch, and the retrieved text is treated as untrusted data.
6. **Verify.** A separate **protected test runner** executes the candidate in an OS network sandbox against pinned test suites. Only then is the outcome recorded as `runner_verified`.

**Human oversight.** Humans approve disclosure (bundle hash), review publication, install spend policies and scopes, and watch everything in the web console (Agents page: lanes, diffs, test results, receipts, security denials). The contributor accrues 80% of each settled sale; nothing is paid out.

All companies are fictional, sample repos are synthetic, and money is test USDC or a labeled simulator.

## 2. Current implementation

**Stack.** React 19, Vite and TypeScript (`src/`); Convex for the backend, database, file storage, HTTP actions and crons (`convex/`); Node scripts for the MCP server, connector agents, runner and tooling. `@modelcontextprotocol/sdk` 1.32.2 (v1 API).

| Path | What it is |
| --- | --- |
| `src/` | Web console: buyer, contributor and reviewer pages, Agents (`src/pages/Agents.tsx`, Live / Recorded tabs), Demo controls (`src/pages/DemoMenu.tsx`). `src/session.tsx` handles signed demo sessions. `src/recordings/two-agent-run.json` holds the recorded run. |
| `convex/schema.ts` | Tables: `organizations incidentDrafts playbooks playbookRevisions publicReferences reviews toyTargets validationRuns buyerChecklists purchases outcomeFeedback mossIndexes watches alerts auditEvents spendPolicies agentPrincipals quotes repairRuns oauthTokens webAssets agentOutcomes agentEvents jobs meta integrationEvents` |
| `convex/mcp.ts` | MCP business logic: principals, scopes, search, preview, quote, acquire, getResolution, submit, recordOutcome, recordRepairRun, logConnectorEvent, authCheck, upsertPrincipal/revokePrincipal. |
| `convex/semanticSearch.ts`, `searchIndex.ts`, `lib/searchIndex.ts`, `crons.ts` | Moss semantic search, with a shared index `ix-public-previews` rebuilt on publish, reset and every 10 minutes. **Owner: Droid** (see §8). |
| `convex/mcpRemote.ts`, `convex/oauth.ts` | Remote MCP over HTTPS and the OAuth 2.1 client_credentials server. |
| `convex/webHosting.ts`, `convex/http.ts` | Hosted console (files in Convex storage, single-page-app fallback) and the access-code `/session` endpoint. `http.ts` also routes `/x402/purchases/*`. |
| `convex/x402Node.ts`, `x402State.ts` | CDP Server Wallets, the x402 seller endpoint, `agentPay` (agent purchases), `payWithX402` (web checkout), `reconcilePayment`. |
| `convex/lib/access.ts` | `getActor`, `requireRole`, `requireOperator` (demo identity from signed sessions). |
| `mcp/tools.mjs` | **The 9 MCP tools** (shared by local and remote): `get_exchange_capabilities`, `search_resolutions`, `get_resolution_preview`, `quote_resolution`, `acquire_resolution`, `get_resolution`, `submit_resolution`, `get_submission_status`, `record_outcome`. |
| `mcp/server.mjs` | Local MCP server: Streamable HTTP, stateless, JSON responses, `127.0.0.1:8787/mcp`. Handles Bearer tokens, origin allowlist, 64 KB limit, and rate limits after auth. |
| `connector/` | `agentA.mjs` (contributor), `agentB.mjs` (buyer), `demo.mjs` (orchestrator for one full run), `attack-check.mjs` (9 live adversarial checks), `protocol-check.mjs`, `remote-check.mjs`. `connector/lib/policy.mjs` holds the disclosure gate, patch path policy and candidate content check. `connector/lib/factoryRepair.mjs` runs `droid exec`. |
| `sample-repos/` | `repo-a` and `repo-b` (buggy code, protected tests), `harness/` (candidate child process over IPC), `run-protected-tests.mjs` (pinned suite hashes and sandbox selection), `manifest.json`. |
| `scripts/` | `factory-runner.mjs` (local runner :3299: `/session`, `/agent-demo`, `/patch`, `/health`), `agents-setup.mjs`, `deploy-web.mjs`, `record-run.mjs`, `moss-cleanup.mjs`. |
| `shared/` | `bundle.mjs` (canonical bundle hash, secret and injection scanners), `session.mjs` (HMAC demo sessions, operator or viewer kind). |
| `tests/` | Vitest (convex-test and node). `tests/setup-env.ts` sets `DEMO_OPEN_IDENTITY=on`, which is for tests only. |
| `e2e/` | `demo-flow.mjs` (23-step browser flow; **it resets data**), `a11y.mjs`, `viewports.mjs`. All take the base URL as `argv[2]`. |
| `docs/agent-sprint/` | `CONTRACTS.md`, `SECURITY.md`, `QA.md`, `STATUS.md`, `INTEGRATIONS.md`, `PRESENTING.md`, `DEMO.md`, `REVIEW.md` (independent security review, 15 defects, all addressed). `docs/CLAIMS.md` is the shared-file coordination log. |

**Authentication.**
- **Local MCP.** Dev service tokens `ixa_…` (env `AGENT_A_TOKEN`, `AGENT_B_TOKEN` in `.agent-tokens.local`). Convex stores only SHA-256 hashes, with scopes, a 7-day expiry and revocation. The MCP service also sends `MCP_SERVICE_SECRET`, which gates every `convex/mcp.ts` function.
- **Remote MCP.** OAuth 2.1 **client_credentials**.
  - `client_id` is the principal name (`agent-a` / `agent-b`); `client_secret` is the `ixa_` token.
  - The token endpoint is `POST /oauth/token`, and `resource` must equal the MCP URL.
  - Access tokens `ixat_…` last 15 minutes, are bound to that resource, can narrow scopes, and are stored as hashes. The long-lived `ixa_` token is refused as a bearer token.
  - Discovery is at `/.well-known/oauth-protected-resource` and `/.well-known/oauth-authorization-server`.
  - There is no end-user authorization-code/PKCE flow.
- **Web console.** No real sign-in. Every Convex call takes `actor`, an HMAC-signed demo session (`ixs2.<slug>.<exp>.<o|v>.<sig>`, secret `DEMO_SESSION_SECRET`).
  - **Operator** sessions are minted by the local runner `/session` and the orchestrator.
  - **Viewer** sessions are minted by the hosted `/session` for `DEMO_ACCESS_CODE`.
  - Bare org slugs are accepted only when `DEMO_OPEN_IDENTITY=on` (tests).

**Payments.**
- Agent purchases: `acquire` reserves within the principal's policy (B: ≤ 10000 atomic = 0.01 USDC per purchase, ≤ 50000 per session, at most 2 purchases), then `x402Node.agentPay` signs with the backend CDP buyer wallet. Spend controls are pinned to the quote's payee and amount.
- The simulator is allowed only if the operator policy sets `allowSimulator` (agent-b: true). If CDP is missing, the result is `PROVIDER_UNAVAILABLE`, never a silent simulator.
- There is a server-side double-purchase guard.
- Web checkout offers x402 or an explicit simulator. x402 charges the guide's list price in test USDC (`convex/purchases.ts`, `atomicAmount: pb.priceAtomic`), capped at 1 test USDC per payment (`convex/lib/x402.ts`). The README's mention of `X402_TEST_PRICE_DIVISOR` is stale: no code reads it.
- Only `test_success` purchases accrue earnings; simulated purchases are shown as "not counted".
- Wallet names: buyer `ix-demo-buyer-harbor`, receiver `ix-demo-platform-receiver`. **Current buyer balance: unknown (verify on Base Sepolia).**

**Sponsors: actual roles.**

| Sponsor | Actual role | State |
| --- | --- | --- |
| Convex | Backend, DB, file storage, hosting of the web console, remote MCP, OAuth, crons | Live (dev deployment) |
| Coinbase CDP / x402 | Test payments on Base Sepolia for agents and web | Live. Latest agent settlement tx `0xd7811882…` (2026-10-24 14:43 PDT) |
| Factory Droid | `droid exec` 0.249.0 as Agent B's repair agent (`connector/lib/factoryRepair.mjs`), plus the reviewer's "Apply fix" on toy apps (`scripts/factory-runner.mjs`) | Live **only on the presenter machine** (needs `FACTORY_API_KEY` in `.secrets.local`) |
| Moss | Drafting (Moss Inference), grounded Q&A (`engine=moss_context`), and semantic search | Drafting and Q&A: live per earlier sprint evidence (*verify*). **Semantic search on cloud: failing → keyword fallback** (§6, task 1) |
| Apify | Public reference retrieval from an allowlist | Live on cloud earlier (3 refs, 2026-10-24 morning) (*verify*) |
| Armadin | — | Unavailable (no public interface found) |

## 3. Exact working state (2026-10-24 ~17:00 PDT)

- **Repository:** `github.com/LognanLi/incident-exchange` (private). Local path: `~/code_stuff/calhacks/incident-exchange`.
- **Branches:**
  - `main` is at `bcc2213` (merge of PR #6). CI passes on `main`.
  - Local `agent-sprint` is at `9691ed2`, which has the same tree as `main`.
  - `moss-semantic-search` and `polish-sprint` are fully merged.
- **Working tree:** clean, except this new file `AGENT_HANDOFF.md` (uncommitted when written).
- **PRs:** #1–#6 all merged; **none open**. Nothing depends on an unmerged PR.
  - #6 (hosted console, remote MCP/OAuth, sandbox, e2e, checkout fixes, presenter mode, recorded run) was merged at 23:57 UTC.
  - #5 (Droid's Moss search) was merged into `agent-sprint`, then into `main` via #6.
- **Deployed cloud code:** Convex functions and the hosted web assets were pushed from the `9691ed2` tree (~16:35–16:40 PDT).
- **Must preserve:**
  - All data on the shared cloud deployment (§9).
  - Existing Convex env values, local secret files, the pinned suite hashes in `sample-repos/manifest.json` (re-pin only if you intentionally change protected tests or the harness), and the operator/viewer session split.
  - The idempotent rehearsal behavior.
  - The labels "keyword fallback", "simulated" and "Recording — not live".
- **Running processes (*verify* with `ps`):** a dev stack started with `npm run dev` from the repo: Vite :5173, `convex dev` **watcher**, runner :3299, MCP :8787. **The watcher pushes the working tree to the shared deployment on every save.** Stop it before editing Convex code on another branch, or deliberately keep it.

## 4. Environment and startup

**Deployment URLs.**
- Convex cloud (dev): `https://quirky-robin-694.convex.cloud`.
- HTTP/site: `https://quirky-robin-694.convex.site`.
- Hosted console: `https://quirky-robin-694.convex.site/` (viewers use `…/#access=<DEMO_ACCESS_CODE>`; presenters use `…/#presenter`).
- Remote MCP: `https://quirky-robin-694.convex.site/mcp`.
- There is **no production deployment**: it needs a production deploy key from the user (Convex dashboard → Project settings → Deploy keys).

**Credential locations (names only).**
- `.env.local` (gitignored): `VITE_CONVEX_URL`, `CONVEX_DEPLOY_KEY` (dev key for quirky-robin-694), `CONVEX_DEPLOYMENT`, `VITE_CONVEX_SITE_URL`.
- `.secrets.local` (gitignored, read by runner, MCP and scripts): `APIFY_TOKEN`, `MOSS_PROJECT_ID`, `MOSS_PROJECT_KEY`, `FACTORY_API_KEY`, `FACTORY_RUNNER_SECRET`, `MCP_SERVICE_SECRET`, `DEMO_SESSION_SECRET`, `DEMO_ACCESS_CODE`.
- `.agent-tokens.local` (gitignored): `AGENT_A_TOKEN`, `AGENT_B_TOKEN`. Issued by `npm run agents:setup`, with a 7-day expiry (last issued 2026-10-24 afternoon, so they expire around 2026-10-31; *verify*).
- `connector/policy.local.json` (gitignored): the connector's pinned endpoint, network, asset, payee and budget.
- Convex env on quirky-robin-694: `APIFY_TOKEN CDP_API_KEY_ID CDP_API_KEY_SECRET CDP_WALLET_SECRET DEMO_ACCESS_CODE DEMO_SESSION_SECRET FACTORY_RUNNER_SECRET MCP_SERVICE_SECRET MOSS_PROJECT_ID MOSS_PROJECT_KEY`. Inspect names only, with `npx convex env list | cut -d= -f1`.
- Never print values. Before every commit, scan the diff for secret values; see the snippet in §10.

**Commands (all verified today unless noted).**

```bash
npm ci                                  # CI uses this (ubuntu); passes
npm run typecheck                       # pass
npm test                                # 82 Vitest (11 files) + 14 toy tests — pass
npm run build                           # pass
npx convex dev --once                   # push functions/schema to quirky-robin-694 (shared! see §9)
npm run deploy:web                      # build + publish console to Convex storage
npm run agents:setup                    # ROTATES agent tokens + rewrites connector policy; keeps existing Convex secrets
npm run dev:factory                     # local runner :3299 (presenter mode, Factory, live runs)
npm run dev:mcp                         # local MCP :8787 (agents need it during live runs)
npm run dev                             # everything incl. convex watcher (pushes on save)
node connector/demo.mjs                 # one full live two-agent run (~40–90 s; idempotent)
node scripts/record-run.mjs             # capture latest successful run → src/recordings/two-agent-run.json
node connector/protocol-check.mjs       # MCP protocol check (local)
node connector/attack-check.mjs         # 9/9 live adversarial checks (local MCP)
npm run remote:check                    # 13/13 remote HTTPS MCP + OAuth checks
for c in webhook tenant keycache; do node scripts/factory-runner.mjs --selftest $c; done   # sandboxed toy evaluator
node e2e/demo-flow.mjs <baseUrl>        # RESETS DATA — only against a disposable local deployment (see §6)
```

**Seeding.** `demo.ensureSeeded` runs automatically when there are no orgs. `demo.reset` (operator session only) wipes demo-marked records and reseeds. **Do not reset the shared cloud** (§9). For a disposable stack, use a git worktree with `CONVEX_AGENT_MODE=anonymous npx convex dev` and `CONVEX_DEPLOY_KEY` unset; this is how e2e passed 23/23.

## 5. Verified vs incomplete

| Claim | Status | Evidence |
| --- | --- | --- |
| Typecheck, tests, build | ✅ | 2026-10-24 16:59 PDT: 82 Vitest + 14 toy tests, build OK. CI passes on `main` at bcc2213 |
| Local MCP protocol (initialize, 9 tools, validation errors, NO_RELEVANT_MATCH, scope denial, 401) | ✅ local | `protocol-check.mjs`, 16:59 PDT; protocol 2025-11-25 |
| Remote MCP over HTTPS + OAuth | ✅ cloud | `remote-check.mjs` 13/13, 16:59 PDT |
| Live adversarial checks | ✅ local→cloud | `attack-check.mjs` 9/9, 16:59 PDT |
| Full two-agent live run | ✅ local runner + cloud | `demo.mjs` 4 consecutive runs, 16:30–16:35 PDT. Factory patch passed the content check and the sandboxed runner 5/5, `runner_verified` |
| x402 agent payment settles | ✅ cloud (testnet) | tx `0xd7811882…` at 14:43 PDT. Later runs **reused the entitlement** (no new payment) |
| Idempotent rehearsals | ✅ | 4 runs: same submission id returned "published"; guide count unchanged after the first stable-content run |
| Operator vs viewer sessions | ✅ | `tests/session.test.ts`. Live: viewer has no reset or Run buttons; presenter mode shows both (Chrome) |
| Hosted console | ✅ cloud | Playwright: access gate, wrong-code 401, shared link strips the code, deep links, security headers, no console errors |
| Simulated purchase on hosted site | ✅ | Subagent test, ~16:05 PDT: receipt labeled simulated, retry doesn't charge, over-budget blocked, contributor sees "+0.08 simulated, not counted" |
| e2e 23-step browser flow | ✅ disposable local deployment only | 2026-10-24 afternoon (≈15:30 PDT; exact time not recorded), 23/23, 25.9 s; uses simulator and fallback paths (no sponsor keys in the disposable stack) |
| OS network sandbox for candidate code | ✅ macOS only | `sandbox-exec` blocks 127.0.0.1, localhost and internet; writes get EPERM; reference fixes 5/5; toy self-tests 3/3. `detectSandbox()` = `macos-sandbox-exec` |
| Linux sandbox (`unshare --net`) | ❓ unverified | CI only runs rejection tests, not candidate execution |
| Presenter mode, Chrome 155 | ✅ after local-network permission | Automated with the permission granted; blocked without it |
| Presenter mode, Zen 1.23.3b (user's default, Firefox 158) | ❓ unverified | Zen's Local Network Access default is "ask"; headless Zen wouldn't load pages. Needs a manual check (`docs/agent-sprint/PRESENTING.md`) |
| Presenter mode, Safari 26.6 | ❓ not checked | — |
| Moss semantic search (cloud) | ❌ keyword fallback | Every call returns "The embedding model could not be loaded." (`integrationEvents`, 16:26 PDT and on each search). Index rebuild succeeds (16:30 PDT, 9 guides) |
| Moss semantic search (local, older in-process code) | ✅ historical | 15:40 PDT: paraphrase → correct guide (7 ms) via the removed `mcp/mossSearch.mjs`; replaced by #5 |
| Recorded run | ✅ recording, not live | `src/recordings/two-agent-run.json` (run 2026-10-24 16:35 PDT, 53 s, 11 events), labeled in the UI |
| Production deployment, end-user OAuth | ⛔ not done | Prod needs a user-provided prod deploy key; PKCE was not implemented |
| `BUILD_STATUS.md`, `docs/DEPLOY.md` | ⚠️ stale (written this morning, pre-cloud) | Trust `docs/agent-sprint/*` and this file instead |

## 6. Remaining work (prioritized)

**Task 1. Moss semantic search fails on cloud (high).**
- *Repro:* `node connector/protocol-check.mjs`; the search line says `keyword fallback (The embedding model could not be loaded.)`.
- *Files:* `convex/semanticSearch.ts` (Node action; sets `MOSS_MODEL_CACHE_DIR=/tmp/moss-models`; `new MossClient(..., { cachePath: "/tmp/moss" })`; `loadIndex` then `query`) and `convex.json` (`node.externalPackages` includes `@moss-js/moss`).
- *Known:* the error string comes from the native Rust core (`@moss-js/moss-core` 0.36.0), not from repo JS, so the native addon loads on Convex Linux. `createIndex` (server-side) succeeds, so the failure is in the local embedding model download or load during `loadIndex`/`query`. Locally (macOS arm64) the same SDK works.
- *Not yet tried:* surfacing the full error or cause chain, checking whether `/tmp` is writable and the model host reachable from a Convex Node action, and checking whether the SDK can query server-side without a local model.
- *Owner:* Droid wrote this code (§8). Coordinate via `docs/CLAIMS.md` before editing.
- *Best next action:* add a temporary `internalAction` diagnostic that logs `loadIndex`'s full error, `fs.statfs`/a write test on `/tmp/moss-models`, and an outbound `fetch` to the model URL (find it in the moss-core README or binary strings). Fix or choose a different query mode. Keep the labeled fallback.
- *Acceptance:* `protocol-check` and `remote-check` search lines report `Moss semantic search (N ms)`. The paraphrase "the same job gets queued two times whenever the sender resends a notification" ranks "Duplicate jobs when a webhook provider retries the same event" first. Nonsense returns NO_RELEVANT_MATCH. Docs updated with the date.

**Task 2. Confirm presenter mode in the user's browser (high, needs the user).**
- Zen is unverified and Safari unchecked.
- Ask the user to do the 30-second check in `docs/agent-sprint/PRESENTING.md`, while you watch the runner output for `[session] operator session minted for https://quirky-robin-694.convex.site`. The runner logs `[preflight] …` lines too.
- *Acceptance:* the result is recorded in the PRESENTING.md browser table.

**Task 3. Duplicate cleanup (medium, needs the user's approval; NOT approved yet).**
- The cloud has three published guides titled "Duplicate jobs when a webhook provider retries the same event", all Northstar. Proposal shown to the user:
  - **keep** `…k58gxmf0` (16:30; what rehearsals now reuse);
  - **deactivate, not delete,** `…w98gxb3w` (14:42; has the real settled x402 purchase, 10 outcomes, 10 feedback) and `…298gxbmt` (15:28; simulated and cancelled checkouts, 1 feedback);
  - **delete** five quarantined "(quick fix)" drafts from old attack-check runs (`…xs8gxrqq …0h8gxxzz …md8gxjyn …1x8gw4s1 …058gx8nj`);
  - keep the seeded injection example and the seeded Northstar draft.
- Note that after deactivating `w98…`, Agent B makes one new 0.01 test USDC purchase on the next run.
- *Action:* only after explicit user approval, implement as a one-off internal mutation with a dry-run mode, list the effects, then apply.

**Task 4. Open product decisions for the user.**
- (a) Should viewer sessions be blocked from x402 test payments (currently allowed, ≤ 1 test USDC each)?
- (b) Production deployment: needs a prod deploy key, then `npx convex deploy` and `npm run deploy:web` against prod, plus setting prod env vars. Ask the user; don't do it unprompted.

**Task 5. Smaller gaps.**
- Linux sandbox verification (try `unshare --user --map-root-user --net` in a container; Docker is installed but its daemon was not running).
- Remote endpoint and token endpoint rate limits.
- End-user OAuth (authorization code + PKCE).
- Remove the unused `mcp.publicPreviews` (Droid's note).
- Refresh or remove the stale `BUILD_STATUS.md` and `docs/DEPLOY.md`.
- `e2e/a11y.mjs` exits 0 even with violations.

## 7. Security boundaries

- **Tenant isolation.** Authority comes only from tokens: MCP principals by hash, web demo sessions by HMAC. Validators reject unknown fields (no org smuggling). Cross-tenant reads return `NOT_FOUND_OR_FORBIDDEN`, without revealing existence.
- **Redaction before upload.** `connector/lib/policy.mjs` `stageField` drops credential-format lines, generalizes emails, internal hosts, private IPs and private terms, and rescans; any residual finding blocks staging. Upload happens only for the developer-approved content hash. The server rescans (`shared/bundle.mjs` `scanSecrets`) and rejects with categories only, never echoing the value. Runner diffs and notes are scanned too.
- **Paid content.** `getResolution` requires an entitlement for that principal and revision. Search and preview never include paid fields. Retrieved content is marked `untrusted_external_content`.
- **Prompt injection.** `scanInjection` quarantines submissions (not searchable, can't be approved). The Factory prompt wraps retrieved text in an untrusted data block. Policies, budgets and payees come only from operator config. The candidate content check rejects new imports, `eval`, `Function`, dynamic `import()`, `require`, `process`, `fetch`, WebSocket and similar.
- **Spending.** Quotes are bound to the revision, price, payee, network and asset. The connector independently checks the pinned payee, network, asset and budget. The server rejects term mismatches, enforces per-purchase, session and count caps with reservation, is idempotent per `clientRequestId`, and has the double-purchase guard. CDP spend controls cap amount, network, asset and payee. The simulator needs the operator's `allowSimulator` flag.
- **Sandbox and protected tests.**
  - Candidate code runs in a child process with Node `--permission` (reads only its own directory plus the harness). On macOS it is also inside `sandbox-exec` (no network, no writes). Tests talk to it over IPC and keep all state.
  - Suite hashes are pinned (`protectedSuiteSha256`).
  - With no OS sandbox, the runner **refuses** to run candidates, except committed fixtures under `sample-repos/`.
  - The toy evaluator is sandboxed the same way.
  - `sandbox-exec` is deprecated and not a VM: exhaustion is bounded only by timeouts. Arbitrary third-party patches are unsupported.
- **Demo identity.** These are demo sessions, not real sign-in. Anyone with the access code is a viewer with all roles (but no reset or live runs).
- **Residual risks.**
  - Pattern scanners can miss novel secrets.
  - Concurrency is verified only sequentially.
  - There are no remote rate limits.
  - The Linux sandbox is unverified.
  - The dev deployment is shared by several agents.

## 8. Coordination

- **Droid (Factory Droid as a coding agent)** works in this repo too and owns the Moss search files listed in `docs/CLAIMS.md`: `convex/semanticSearch.ts`, `convex/searchIndex.ts`, `convex/lib/searchIndex.ts`, `convex/crons.ts`, the `search_resolutions` routing in `mcp/tools.mjs` and `mcp/server.mjs`, the search split in `convex/playbooks.ts`, and `src/pages/buyer/Search.tsx`.
  - Its PR #5 is merged. Whether it is still active is **unknown**.
  - The finding about the cloud model-load failure is logged in `docs/CLAIMS.md`.
- **Previous Claude session (author of this file)** owned everything else and has stopped. No subagents are running.
- **Rules.**
  - Record shared-file claims in `docs/CLAIMS.md` before editing another agent's files.
  - Branch from `main`.
  - `npx convex dev --once` from any branch replaces **all** deployed functions and indexes on the shared deployment, so make sure your branch contains everything deployed (currently `main` @ bcc2213) and log pushes in `docs/CLAIMS.md`.
  - The user approves PRs on GitHub. Don't merge yourself.

## 9. Demo readiness

**Hard restrictions.**
- **Never reset the shared cloud data** (`demo.reset`, the Reset button, `npm run demo:reset`, `npm run e2e` against cloud) without the user's explicit approval.
- Don't print or commit secrets.
- Don't make unrequested x402 payments beyond what the demo flow does (≤ 0.01 USDC per agent purchase).

**Main demo (presenter on their own Mac).**
1. Run `npm run dev:factory` and `npm run dev:mcp`. Check that the runner prints the hosted origin among its accepted origins.
2. Open `https://quirky-robin-694.convex.site/#presenter` and allow local network access. Demo controls should show *Presenter mode*.
3. Switch to **Review Desk**, then Agents → **Run demo**. About 40–90 s: A's baseline 3/5 → fix 5/5 → disclosure gate → submit (or reuse) → B baseline 2/5 → MCP search → purchase (or reuse) → Factory repair → sandboxed tests 5/5 → `runner_verified`.
4. Show the diff, test list, receipts and security lane. Optionally switch to **Harbor Analytics** to show buyer search, a guide preview and a simulated purchase.
5. Remote viewers get `…/#access=<code>` and watch live, or use Agents → **Recorded run** → Replay.

**Dependencies.**
- Runner: `.env.local`, `.secrets.local` (incl. `FACTORY_API_KEY`) and `.agent-tokens.local` (unexpired).
- MCP server running.
- `node_modules/.bin/droid` present.
- macOS for the sandbox.

**Failure modes and recovery.**

| Problem | Recovery |
| --- | --- |
| "Presenter mode can't reach your local runner" | Start the runner, allow the browser's local-network prompt, or present from `http://localhost:5173` (`npm run dev:frontend`). |
| Run demo is missing | Presenter mode is off, or the role isn't Review Desk. |
| Agent tokens expired or AUTH_REQUIRED | `npm run agents:setup`, then restart the MCP server. |
| Factory fails or rejects a candidate | The rejection is shown honestly; rerun `node connector/demo.mjs`. |
| Search says keyword fallback | Expected until task 1 is fixed; results are still correct for the demo queries. |
| Runner refuses to run (no sandbox) | Only on non-macOS machines. Present from the Mac. |
| Recorded run is outdated | `node connector/demo.mjs && node scripts/record-run.mjs && npm run deploy:web`. |

## 10. Continuation instructions

**Inspect first.**
- `git status`, `git log --oneline -5 origin/main`, `gh pr list --state open`.
- `docs/CLAIMS.md`.
- `ps aux | grep -E "convex dev|factory-runner|mcp/server|vite"`, to know whether the watcher is pushing.
- `npm test`.
- `node connector/protocol-check.mjs`.

**Then do these three things.**
1. **Fix Moss semantic search on cloud** (task 1). Claim the files in `docs/CLAIMS.md` first. Run the diagnostic, fix, then verify with the paraphrase and nonsense queries through `protocol-check` and `remote-check`. Update `docs/agent-sprint/INTEGRATIONS.md`, `QA.md` and `STATUS.md` with dated evidence, and open a PR.
2. **Get the user's decisions** on the duplicate cleanup (task 3), viewer payments (task 4a) and production (task 4b). Apply only what they approve, with a dry run first. Meanwhile ask them for the Zen presenter check (task 2) and record the result.
3. **Verify the Linux sandbox path** and refresh the stale docs (task 5): run the protected runner inside a Linux container if Docker can be started, record the result in `docs/agent-sprint/SECURITY.md`, and replace `BUILD_STATUS.md`/`docs/DEPLOY.md` with pointers to `docs/agent-sprint/`.

Before every commit, run `npm run typecheck && npm test && npm run build`, then scan staged changes for secret values (names only in output):

```bash
node -e 'const fs=require("fs"),cp=require("child_process");const v=[];for(const f of [".secrets.local",".env.local",".agent-tokens.local"]){if(!fs.existsSync(f))continue;for(const l of fs.readFileSync(f,"utf8").split("\n")){const i=l.indexOf("=");if(i>0){const k=l.slice(0,i),x=l.slice(i+1).trim();if(x.length>=12&&!/URL|DEPLOYMENT/.test(k))v.push([k,x])}}}const d=cp.execSync("git diff --cached",{maxBuffer:1<<28}).toString();const h=v.filter(([,x])=>d.includes(x)).map(([k])=>k);console.log(h.length?"SECRET VALUES STAGED: "+h.join(", "):"no secret values staged")'
```

End PR descriptions with the attribution line your environment requires. Report results with evidence, and label anything unverified as unverified.
