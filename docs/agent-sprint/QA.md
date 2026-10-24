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

Not verified: remote HTTPS MCP deployment; parallel acquisition race under load; OAuth discovery.
