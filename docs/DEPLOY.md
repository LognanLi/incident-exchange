# Deployment

**Current state (2026-10-24):** everything runs on the Convex **dev** deployment `quirky-robin-694`. It hosts the backend, the web console (files in Convex storage, `npm run deploy:web`) and the remote MCP endpoint with OAuth. There is no production deployment. The presenter's Mac runs the Factory runner (`npm run dev:factory`) and the local MCP server (`npm run dev:mcp`) for live agent runs. See [`docs/agent-sprint/PRESENTING.md`](agent-sprint/PRESENTING.md) and [`docs/agent-sprint/DEMO.md`](agent-sprint/DEMO.md).

## Production (not done; needs a production deploy key from the project owner)

1. Create a production deploy key (Convex dashboard → Project settings → Deploy keys) and run `npx convex deploy` with it.
2. Set the server env on production (`npx convex env set --prod NAME value`): the names listed in `.env.example` and AGENT_HANDOFF.md (`APIFY_TOKEN`, `MOSS_PROJECT_ID`, `MOSS_PROJECT_KEY`, `CDP_API_KEY_ID`, `CDP_API_KEY_SECRET`, `CDP_WALLET_SECRET`, `MCP_SERVICE_SECRET`, `DEMO_SESSION_SECRET`, `DEMO_ACCESS_CODE`, `FACTORY_RUNNER_SECRET`).
3. Run `npx convex run --prod x402Node:setup` once to create the CDP buyer and receiver wallets.
4. Point `.env.local` (`CONVEX_DEPLOY_KEY`, `VITE_CONVEX_URL`, `VITE_CONVEX_SITE_URL`) at production. `scripts/deploy-web.mjs` and `scripts/agents-setup.mjs` read it. Then publish the console with `npm run deploy:web` and issue agent credentials with `npm run agents:setup`.

## Replace demo-only pieces before real customers
| Demo piece | Production replacement |
| --- | --- |
| Signed demo sessions and access code (`convex/lib/access.ts`, `shared/session.mjs`) | Real auth (Convex Auth / Clerk / WorkOS with SSO); derive org membership from identity |
| `organizations.verified` flag | KYB: business + domain verification, sanctions screening |
| Base Sepolia test USDC | Mainnet USDC or card/invoice billing; legal review of money transmission |
| Accrual ledger (no payouts) | Payout provider (e.g. Stripe Connect) with a refund/fraud hold |
| Local Factory runner and `sandbox-exec`/`unshare` candidate sandbox | Isolated per-job containers/VMs; keep the protected evaluator separate |
| Legal | Data Use License review; threat-information-sharing protections vary by jurisdiction and over time (see `docs/research/MARKET_RESEARCH.md`) |

