# QA (2026-10-24)

| Check | Command | Result |
| --- | --- | --- |
| Types | `npm run typecheck` | pass |
| Unit/integration/security | `npm test` | 64 Vitest + 14 toy tests pass (incl. 20 security-gate tests) |
| Build | `npm run build` | pass |
| MCP protocol | `node connector/protocol-check.mjs` | initialize (protocol 2025-11-25), tools/list (9), calls, validation error, NO_RELEVANT_MATCH, scope denial, 401 |
| Live adversarial | `node connector/attack-check.mjs` | 9/9 PASS |
| Agent A | `npm run agent:a` then `--approve <hash>` | baseline 3/5 → fix 5/5; gate dropped 1 credential line, generalized 3; submitted (clean) |
| Agent B | `npm run agent:b` | search Strong overlap → quote → x402 settled → Factory repair → 0/5 rejected (run 1), 5/5 accepted (run 2) → runner_verified |
| Accessibility | `node e2e/a11y.mjs` | 0 WCAG 2.1 AA violations (17 screens) |
| Console | Chrome screenshot of /agents (1440 px) | real events, diff, receipts; no page errors |

Not verified: remote HTTPS MCP deployment; parallel acquisition race under load; OAuth discovery.
