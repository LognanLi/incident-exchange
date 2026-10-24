# Incident Exchange

**An agent-to-agent marketplace for reusable bug resolutions.** A developer's coding agent fixes a bug, verifies it with protected tests, and — with the developer's approval — shares a sanitized resolution. Another developer's agent finds it through our **MCP server**, checks that it fits, buys access within a fixed test budget (Coinbase x402, Base Sepolia), has **Factory Droid** adapt the fix in an isolated copy of its own repository, and proves it with a **separate protected test runner**. The contributor accrues 80% of each sale. Humans govern disclosure, spending, and risky actions; the web app is the oversight console.

> Demo build: fictional companies and sample repositories; test USDC only. Spec: [`docs/agent-sprint`](docs/agent-sprint) (contracts, security results, demo script, integrations, QA).

### Agent quick start
```bash
npx convex dev --once     # sync backend to the deployment in .env.local (CONVEX_DEPLOY_KEY)
npm run agents:setup      # MCP service secret + agent tokens (hashed in Convex) + connector policy
npm run dev               # web console :5173 · MCP http://127.0.0.1:8787/mcp · Factory runner :3299
npm run agent:a           # Agent A: fix repo A, stage sanitized bundle (then --approve <hash> to submit)
npm run agent:b           # Agent B: MCP search → quote → x402 → Factory repair → protected tests → outcome
node connector/attack-check.mjs   # live adversarial checks through MCP
npm run remote:check      # remote HTTPS MCP (Convex) + OAuth client_credentials checks
npm run deploy:web        # build the console and publish it to https://<deployment>.convex.site/
```
**Hosted console:** https://quirky-robin-694.convex.site/ (Convex dev deployment). Visitors enter the demo access code (`DEMO_ACCESS_CODE`, in `.secrets.local`; share as `https://quirky-robin-694.convex.site/#access=<code>`). The code mints signed demo sessions server-side, so anyone with it can act as any fictional org, including running test payments (capped at 1 test USDC each) and resetting demo data. Share it only with people you trust with that. Features that need the local runner (Factory “Apply fix”, the two-agent demo button) work only from `localhost`.
MCP client config: see `docs/agent-sprint/DEMO.md` (placeholder bearer token). Remote endpoint: `https://<deployment>.convex.site/mcp` with OAuth client_credentials (see `docs/agent-sprint/CONTRACTS.md`). Candidate code from repair agents runs only inside an OS network sandbox (macOS `sandbox-exec`; Linux `unshare` if available) and is otherwise refused; arbitrary third-party patches are not supported. Secrets: Convex env (server), `.secrets.local` and `.agent-tokens.local` (local, gitignored) — never in source.

## Stack

- **Frontend:** React 19, TypeScript, Vite, React Router
- **Backend:** Convex (schema, queries/mutations, server-side role checks, reactive updates). By default it runs as a **local Convex backend with no account**.
- **Tests:** Vitest and `convex-test` for domain logic, the full lifecycle, and access control. A Playwright script (`playwright-core` driving your installed Chrome) covers the browser end to end.

## Install and run

Requires Node 20.19+ (or 22.12+). The E2E script also needs Google Chrome.

```bash
npm install
npm run setup     # first time only: starts a local Convex backend (no account) and writes .env.local
npm run dev       # Convex dev + Vite → http://localhost:5173
```

On first load, the app seeds the demo data automatically.

| Command | What it does |
| --- | --- |
| `npm run dev` | Backend, frontend, and the local Factory runner, all with live reload |
| `npm run typecheck` | Typechecks the frontend and the Convex code |
| `npm test` | 43 Vitest tests + 14 toy-app evaluator tests |
| `npm run e2e` | Browser run of the whole demo (needs `npm run dev`; spends ~6k Factory credits and 0.50 test USDC) |
| `node e2e/viewports.mjs` | Screenshots at 1440 / 1024 / 390 px |
| `npm run x402:setup` | Creates and funds the CDP buyer and receiver wallets on Base Sepolia (needs the CDP secrets) |
| `npm run demo:reset` | Restores the seed data from the CLI (the Demo menu has the same action) |
| `npm run build` | Production build of the frontend |

## Demo identities

Open **Demo menu** (top right) to switch roles or reset data.

| Organization (fictional) | Role | Use it for |
| --- | --- | --- |
| Northstar Cloud | Contributor | The seeded authentication-failure incident |
| Incident Exchange Review Desk | Reviewer | Review queue, validation, feedback |
| Harbor Analytics | Buyer | Search, purchase, feedback |
| Cobalt Retail Systems | Contributor | Owns the background catalog |

The identity switcher replaces sign-in for this demo. Every Convex function reloads the acting organization and checks its role on the server, so buyer queries never return contributor notes. For production, replace `convex/lib/access.ts` with real auth.

## Three-minute demo (after reset)

1. **Northstar Cloud:** My incidents → open “Login service failures…” → **Draft with Moss** → **Accept all sections** → **Next: privacy review** → **Run privacy scan**. Eight high-severity identifiers are flagged. Click **Apply all recommended generalizations**, tick the approval box, then **Approve & submit**.
2. **Review Desk:** Review queue → Open → **Fetch references**. In the validation panel: **Run check** (FAIL) → **Apply fix with Factory Droid** (or the local adapter) → **Re-run check** (PASS). Tick the checklist, choose **Test reproduced**, then **Approve**.
3. **Northstar Cloud:** open the incident → step 4 → tick final approval → **Publish guide**.
4. **Harbor Analytics:** search “repeated authentication failures after a deployment”. Check the match reason, evidence label, limitations, and price → **Continue to demo checkout** → **Start** → tick the simulator box → **Complete simulated payment**. The receipt shows $49.00 → $39.20 contributor / $9.80 platform. Read the unlocked steps, ask a question, then **Report your outcome**.
5. **Review Desk:** Buyer feedback shows the outcome.

## Sponsor integrations: actual status

Integrations live behind server-side adapters with labeled local fallbacks, so a missing key never blocks the app. Live status is in **Demo menu → Sponsor integration status**. "Connected" appears only after a real successful call. Everything below was exercised end to end on 2026-10-24.

| Sponsor | Status | How it's used | Fallback, as labeled in the UI |
| --- | --- | --- | --- |
| **Convex** | ✅ Connected | Local backend, data, server-side access checks | none |
| **Moss** | ✅ Connected | **Drafting:** Moss Inference structures the contributor's six response fields into the six-part playbook. Private notes, evidence, and names are never sent. **Q&A:** at publish, the app builds two Moss indexes per guide: *preview* (free sections only) and *full*. Buyers who haven't paid query the preview index; buyers who have unlocked query the full one. Answers cite sections such as `[Verify]`. If an index isn't ready, Moss Inference answers from the allowed sections passed in directly, labeled “no index built”. | Deterministic drafting and keyword Q&A |
| **Apify** | ✅ Connected | `apify~website-content-crawler` (cheerio, 1 GB memory) crawls an allowlist of OWASP, NIST, and CISA pages. Anything off-allowlist is dropped. | Seeded references, marked “Seeded reference — not live-retrieved” |
| **Factory Droid** | ✅ Connected (requires the local runner from `npm run dev`) | `scripts/factory-runner.mjs` (bound to 127.0.0.1) runs `droid exec --auto low --only-tools Read,LS,ApplyPatch` in a temp folder that holds **only** a copy of the toy config, with a fixed prompt. It rejects any other file change or malformed config. Convex re-checks a shared secret, the reviewer role, and value ranges. | “Local demo adapter (deterministic patch)” |
| **Armadin** | ❌ Unavailable: no interface provided | — | “Local validator (toy-auth check)”. Checks are never attributed to Armadin. |
| **Coinbase x402** | ✅ Connected. A test purchase settled on Base Sepolia: tx `0xc8e96062…3c0991c`, 0.49 USDC from buyer to receiver, confirmed on-chain. | The buyer pays from a backend CDP Server Wallet (`ix-demo-buyer-harbor`) to a CDP receiver wallet (`ix-demo-platform-receiver`) over the real x402 HTTP flow: Convex endpoint `POST /x402/purchases/<id>` → 402 → signed EIP-3009 payment → Coinbase facilitator verifies and settles → unlock. Spend controls cap each payment at 1 test USDC, Base Sepolia USDC only, to our receiver only. The test charge is the list price ÷ 100 because of faucet limits. | “Demo payment” simulator. Purchases are stored as `simulated_success`, never as “settled”. |

### Coinbase x402 setup (Base Sepolia)

1. In the [CDP Portal](https://portal.cdp.coinbase.com), create a **Secret API key** (you get an *API Key ID* and *API Key Secret*) and a **Wallet Secret**.
2. Put all three on the **Convex deployment**, in your own terminal (not in chat or any file):
   ```bash
   npx convex env set CDP_API_KEY_ID '<id>'
   npx convex env set CDP_API_KEY_SECRET '<secret>'
   npx convex env set CDP_WALLET_SECRET '<wallet secret>'
   ```
3. `npm run x402:setup` creates (or reuses) the buyer and receiver CDP wallets, stores their addresses, and requests faucet test USDC for the buyer when it holds less than 1 USDC.
4. Buy a guide as Harbor Analytics. Checkout now says **Coinbase x402 · Base Sepolia testnet**, and the receipt links the transaction on BaseScan.

Optional: `X402_TEST_PRICE_DIVISOR` (default 100). `X402_FACILITATOR_URL` swaps in a different facilitator, such as the public `https://x402.org/facilitator`; the default is the CDP facilitator.

### Secrets

Real keys live in two places: the gitignored `.secrets.local`, and the Convex deployment environment (`npx convex env set …`). Nothing secret is committed or shipped to the browser. Server-side variables: `APIFY_TOKEN`, `MOSS_PROJECT_ID`, `MOSS_PROJECT_KEY`, `FACTORY_RUNNER_SECRET`, `CDP_API_KEY_ID`, `CDP_API_KEY_SECRET`, `CDP_WALLET_SECRET`. The runner reads `FACTORY_API_KEY` and `FACTORY_RUNNER_SECRET` from `.secrets.local`.

### Known limits

- **Moss index quota.** The current Moss plan rejected index builds beyond three per project (“usage limit has been reached; billing must be updated”). One published guide uses two indexes. Further builds fail visibly, and Q&A keeps working through Moss Inference with the sections passed in directly. A demo reset deletes this app's indexes; it only ever deletes names matching `ix-<id>-preview|full`.
- **Factory runs cost Factory credits** (about 5,900 per patch in testing) and take about 10–15 s.
- **Apify** uses the free plan's monthly credit. Each fetch is one small crawl.
- **x402 dependencies:** `@coinbase/cdp-sdk` and `@x402/*` pin zod 3.x, which has a memory-exhaustion advisory (GHSA-mrhx-c7xc-m3w5) with no 3.x fix. The public payment endpoint rejects payment headers over 16 KB before they reach the library.
- **On-chain vs. app accounting:** the whole x402 test charge goes to the platform receiver wallet. The 80/20 split is app-side demo accounting.

## How it works

- **Privacy boundary.** Private contributor inputs (notes, evidence summary, names to keep private) live only on `incidentDrafts`. Buyers read the separate `playbooks` table, which holds only published, approved public fields. Reviewers get a projection without `privateNotes`.
- **Approval binding.** The contributor's approval records a hash of the exact buyer-facing content. Any edit invalidates it. A reviewer can approve only if the hash still matches, and publishing requires it again.
- **Evidence labels.** “Test reproduced” is refused on the server unless a failing *before* check, a *fix*, and a passing *after* check are recorded for that draft.
- **Validation target.** `convex/lib/toyAuth.ts` is an in-memory toy login service with a fictional account. Its misconfiguration is `maxFailedAttempts: 0`, which disables lockout and alerting. The check simulates repeated failed sign-ins and asserts that they are throttled and alerted. It never touches the network.
- **Money.** Prices are stored as integer minor units. The split is `floor(80%)` to the contributor and the remainder to the platform (`convex/lib/money.ts`). The 80/20 split is a prototype assumption.
- **Reset.** Reset deletes only records with `isDemo: true` and reseeds them.

## Project layout

```
convex/            backend: schema, functions, lib/ (pure domain logic shared with the UI)
src/pages/         contributor/, reviewer/, buyer/, Home, DemoMenu
src/components/    shared UI (badges, states, role gate, error boundary)
tests/             vitest: domain + convex-test lifecycle/access control
e2e/               browser demo run
scripts/           factory-runner.mjs (local, restricted droid exec)
docs/              BRIEF.md (spec), SPONSORS.md (integration handoff)
```
