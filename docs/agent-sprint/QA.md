# QA (2026-10-24)

| Check | Command | Result |
| --- | --- | --- |
| Types | `npm run typecheck` | pass |
| Unit/integration/security | `npm test` | 69 Vitest + 14 toy tests pass (incl. 25 security-gate tests) |
| Build | `npm run build` | pass |
| MCP protocol | `node connector/protocol-check.mjs` | initialize (protocol 2025-11-25), tools/list (9), calls, validation error, NO_RELEVANT_MATCH, scope denial, 401 |
| Live adversarial | `node connector/attack-check.mjs` | 9/9 PASS (14:46, after fixes) |
| Web identity (live) | bare-slug calls to Convex + `/agent-demo` without Origin | all refused |
| Runner isolation | 4 attacks against `sample-repos/run-protected-tests.mjs` | all fail (see SECURITY.md) |
| Demo rehearsal (Q4) | `node connector/demo.mjs` | 92 s end to end: A 3/5→5/5, x402 settled (tx 0xd7811882…), Factory patch passed content check + isolated runner 5/5, runner_verified |
| Agent A | `npm run agent:a` then `--approve <hash>` | baseline 3/5 → fix 5/5; gate dropped 1 credential line, generalized 3; submitted (clean) |
| Agent B | `npm run agent:b` | search Strong overlap → quote → x402 settled → Factory repair → 0/5 rejected (run 1), 5/5 accepted (run 2) → runner_verified |
| Accessibility | `node e2e/a11y.mjs` | 0 WCAG 2.1 AA violations (17 screens) |
| Console | Chrome screenshot of /agents (1440 px) | real events, diff, receipts; no page errors |

| Full UI flow (isolated) | `node e2e/demo-flow.mjs http://localhost:5174` against a disposable local Convex deployment (anonymous, port 3210) | 23/23 steps, 25.9 s, no console errors (simulator/fallback paths: no Factory/CDP/Apify/Moss keys in the disposable stack). Fixed: e2e opened the seeded injection fixture instead of the target draft; 4 a11y issues (search button name, two contrast issues, aria-label on a span) |
| Accessibility | `node e2e/a11y.mjs` (isolated stack) | 20 violations → 0 across 17 routes |
| Remote MCP + OAuth | `node connector/remote-check.mjs` (HTTPS, quirky-robin-694.convex.site) | 13/13: discovery metadata, 401 challenge, invalid_client/invalid_target/invalid_scope, dev secret refused as bearer, SDK initialize + 9 tools, search, NO_RELEVANT_MATCH, paywall, scope narrowing |
| OAuth unit | `tests/oauth.test.ts` | 3 tests: metadata, token issuance rules, expiry/revocation/scope narrowing |
| Sandbox | network/write probes under the runner's sandbox profile | localhost + internet blocked, writes EPERM; reference fixes 5/5 |
| Moss search | paraphrase + nonsense via local MCP | 15:40 (in-process Moss, before PR #5): top hit correct (7 ms); nonsense → NO_RELEVANT_MATCH. 16:10 after PR #5 (Moss in a Convex action): cloud returned keyword fallback, “The embedding model could not be loaded.” **17:45 after the worker fix (branch `moss-cloud-fix`): `protocol-check` search line “via Moss semantic search (5122 ms)” cold, then 45–109 ms; paraphrase “the same job gets queued two times whenever the sender resends a notification” → duplicate-webhook guide first; “purple elephant quantum banana galaxy” and sourdough → NO_RELEVANT_MATCH; `remote-check` 13/13 with “via Moss semantic search (43 ms)”; `attack-check` 9/9** |

Not verified: Linux sandbox path (`unshare`) on CI; parallel acquisition race under load; end-user OAuth (authorization code/PKCE); buyer web search through Moss on cloud was not exercised in a browser after the fix (same `semanticCandidates` code path as MCP search).
