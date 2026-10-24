# Shipping checklist

The demo runs entirely locally (anonymous Convex backend). To ship a hosted version:

## 1. Backend (Convex Cloud)
1. `npx convex login` (free account), then `npx convex deploy` — creates a production deployment and pushes `convex/`.
2. Set server-side secrets on the **production** deployment (`npx convex env set --prod NAME value`):
   `APIFY_TOKEN`, `MOSS_PROJECT_ID`, `MOSS_PROJECT_KEY`, `CDP_API_KEY_ID`, `CDP_API_KEY_SECRET`, `CDP_WALLET_SECRET`, `FACTORY_RUNNER_SECRET` (only if running the Factory runner), and `DEMO_MODE=off` to disable seed/reset.
3. Run `npx convex run --prod x402Node:setup` once to create the CDP buyer/receiver wallets.

## 2. Frontend (any static host: Vercel, Netlify, Cloudflare Pages)
- Build command `npm run build`, output `dist/`, env `VITE_CONVEX_URL=<prod deployment URL>`.

## 3. Replace demo-only pieces before real customers
| Demo piece | Production replacement |
| --- | --- |
| Organization switcher (`convex/lib/access.ts`) | Real auth (Convex Auth / Clerk / WorkOS with SSO); derive org membership from identity |
| `organizations.verified` flag | KYB: business + domain verification, sanctions screening |
| Base Sepolia test USDC | Mainnet USDC or card/invoice billing; legal review of money transmission |
| Accrual ledger (no payouts) | Payout provider (e.g. Stripe Connect) with a refund/fraud hold |
| Local Factory runner | Isolated per-job containers/VMs; keep the protected evaluator separate |
| Legal | Data Use License review; threat-information-sharing protections vary by jurisdiction and over time (see `docs/research/MARKET_RESEARCH.md`) |

## 4. Operations already in place
CI (`.github/workflows/ci.yml`: typecheck, tests, build) · append-only audit log with CSV export · integration status panel · settlement reconciliation via on-chain `authorizationState` · secrets only in Convex env / gitignored `.secrets.local`.
