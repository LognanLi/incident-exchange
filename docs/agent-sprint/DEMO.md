# Demo

## Setup (once)
```
npm install
# .env.local holds VITE_CONVEX_URL + CONVEX_DEPLOY_KEY (quirky-robin-694)
npx convex dev --once        # sync backend
npm run agents:setup         # MCP service secret, agent tokens (hashed in Convex), connector policy
npm run x402:setup           # buyer wallet ≥ 1 test USDC (agent purchases cost 0.01)
npm run dev                  # Vite :5173, Convex watcher, Factory runner :3299, MCP :8787
```
Client config (placeholder token):
```json
{ "mcpServers": { "incident-exchange": { "type": "http", "url": "http://127.0.0.1:8787/mcp", "headers": { "Authorization": "Bearer ${INCIDENT_EXCHANGE_AGENT_TOKEN}" } } } }
```

## Three minutes
| Time | Show | How |
| --- | --- | --- |
| 0:00 | Repo A fails 3/5 | Agent activity → lane A `baseline_tests` |
| 0:20 | A's fix passes 5/5 (protected runner) | lane A `candidate_tests` |
| 0:45 | Local gate + exact-hash approval + MCP submit | Security panel line; `submit_resolution` event |
| 1:10 | B fails 2/5, searches via MCP, Strong overlap | lane B |
| 1:35 | Quote + x402 test payment within 0.01 budget | Receipts (BaseScan link) |
| 1:55 | Factory Droid adapts fix; protected tests 5/5; diff | Repair evidence |
| 2:25 | Injection quarantined, payee redirect refused | `node connector/attack-check.mjs` |
| 2:45 | Runner-verified outcome; A's 0.008 accrual | Receipts / lane B |

**Live run:** “Run two-agent demo” (≈2–3 min: Factory ≈30 s, x402 ≈10 s) or `npm run agents:demo`. **Recorded:** the console shows the 2026-10-24 14:01–14:06 PDT runs (timestamps on every event).
**Recovery:** payment fails → “Run with simulated payment” (explicit, labeled); Factory unavailable → stage reports `unavailable` (no fake repair); runner offline → CLI `npm run agent:b`.
