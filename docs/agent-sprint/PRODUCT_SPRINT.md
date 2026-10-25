# Product sprint status (resumable)

Deadline: submission **2026-10-25 09:00 PDT**. Feature freeze **07:30 PDT**. Lead: Claude (main session). Started 19:20 PDT 2026-10-24.

Goal: a developer who didn't build this connects their own agent, finds a resolution, checks applicability, buys access, and verifies an adapted repair. The web UI handles onboarding, permissions, evidence and oversight.

## Ground rules
- Don't reset shared cloud data. Don't start `convex dev` watchers. Only the lead deploys (`npx convex dev --once`, `npm run deploy:web`), and only from a branch containing `main`.
- Keep scenario 1's guide (`…kd8gypc7`) and Agent B's entitlement (19:01 purchase). Agent A's scenario-1 bundle must stay byte-identical (its content hash drives dedupe).
- Live runs against the cloud and anything that spends test USDC: lead only.
- Presenter path: Zen at `http://localhost:5173` (`dev:factory`, `dev:mcp`, `dev:frontend`). Recording fallback: Agents → Recorded run.

## Workstreams and file ownership
| Stream | Owner | Branch | Files |
| --- | --- | --- | --- |
| Applicability + onboarding backend + integration | Lead | `agent-product` | `shared/applicability.mjs`, `connector/lib/{facts,applicability}.mjs`, `convex/mcp.ts`, `mcp/tools.mjs` (new tools only), `convex/schema.ts`, `convex/maintenance.ts`, `scripts/issue-agent.mjs`, `connector/connect-check.mjs`, `mcp/server.mjs`, `convex/mcpRemote.ts`, docs `docs/agent-sprint/CONNECT.md` |
| Scenario 2: tenant authorization repair | Sub-agent "scenario2" | `scenario-tenant` (from `agent-product`) | `sample-repos/repo-c/**`, `sample-repos/repo-d/**`, `sample-repos/manifest.json`, `sample-repos/run-protected-tests.mjs` (only if needed), `connector/agentA.mjs`, `connector/agentB.mjs`, `connector/demo.mjs`, `connector/fixtures/**`, `scripts/agents-setup.mjs` (repos map only), `scripts/factory-runner.mjs` (`/agent-demo` scenario param only), tests for these |
| Product UI | Sub-agent "ui" | `product-ui` (from `agent-product`) | `src/**`, new `convex/agentAccess.ts`, `tests/agentAccess.test.ts` |

Shared contracts (lead-owned; ask before changing): `shared/applicability.mjs` (fact vocabulary, `evaluateApplicability`), `connector/lib/applicability.mjs` (`applicabilityGate`), MCP tools `check_applicability`, `get_my_access`, the schema fields `applicability.conditions` and `agentPrincipals.lastSeenAt/lastSeenVia`, and the optional bundle field `conditions`.

## Checkpoints
- [x] 19:17 PR #9 merged; cloud functions + hosted bundle = `main` @ 9f52a95.
- [x] 19:28 `check_applicability` + gate deployed; scenario-1 guide `…kd8gypc7` given conditions (dry run, then apply; revision unchanged). 19:35 scenario-1 run: **recommend** 4/4, entitlement reused, 5/5 `runner_verified`. 19:34 **decline**: repo-b vs the tenant guide → 1 match, 2 conflicts, 2 to verify.
- [x] 19:31 onboarding: `get_my_access`, `scripts/issue-agent.mjs` (juniper-agent for Juniper Ledger, simulator only, 1 purchase), `connect-check.mjs` (happy path + wrong path, wrong secret, expired token, wrong host, missing scope, local service down), remote `error_description`s, CONNECT.md.
- [x] 19:38 **fresh Claude Code session** in `/tmp/ix-fresh/session/ledger-webhooks` (Juniper's own app; only CONNECT.md + credential via headersHelper): get_my_access → search → preview → check_applicability (recommend, 4/0/0, facts from its own repo) → quote → acquire (simulator) → get_resolution → adapted fix → `npm test` 2/4 → 4/4 → record_outcome (`reported_unverified`).
- [x] 19:34 **scenario 2 live**: repo-c 2/5 → 5/5, gate dropped canary; review → publish; repo-d 3/6; fit check recommend 5/5; x402 `0x385e800e…`; Factory adapted (workspace naming, response handler); protected 6/6 (denials + legitimate access), `runner_verified`.
- [x] 20:25 UI merged + deployed backend: /connect with live agents panel, 20-second story strip, Check fit section, receipts with Basescan links, accrued vs paid-out split, scenario picker.
- [x] 20:40 security re-run on the deployed integration: attack-check 9/9 (check 5 fixed to target an explicitly over-budget, unowned guide; DB confirmed no new purchase), remote-check 13/13 (11 tools), protocol-check OK; fit-check evidence redacted for other orgs; credential-like fact sources rejected.
- [x] 20:41 **Zen browser rehearsal** (localhost:5173, scenario picker): tenant run 8:40:32–8:41:05 (fit recommend, purchase reused, Factory, 6/6, `runner_verified`), then dedupe run 8:41:17–8:41:50 (recommend 4/4, reused, 5/5, `runner_verified`); runner log shows both requested from `http://localhost:5173`; purchases unchanged (3). Recording refreshed from the dedupe run (includes the fit check).
- [x] PRs #10, #11, #12 merged by the user; #13 (integration) open, mergeable, CI green. Cloud functions + hosted console = `agent-product` tree (= `main` after #13).
- [x] 21:01 #13 merged; deployed from `main` @ 00fc503 (functions + hosted console). Hosted bundle `index-DPcnZNyU.js` = fresh build of `main`; protocol-check OK, remote-check 13/13, attack-check 9/9; hosted `connect-check.mjs` and `ix-token-header.sh` download identical to `main`; purchases unchanged (3).

## Resume here
- Presenter: `npm run dev:factory`, `npm run dev:mcp`, `npm run dev:frontend`; Zen → `http://localhost:5173` → Agents → scenario picker → Run demo. Fallback: Agents → Recorded run.
- Onboarding evidence: `/tmp/ix-fresh/session/fresh-session.txt` (fresh Claude Code transcript summary); credential `juniper-agent.credentials.local` (gitignored, expires 2026-10-27).
- Deferred by the user: production, end-user OAuth (PKCE), Linux CI, Safari, hosted `#presenter` in Zen.
