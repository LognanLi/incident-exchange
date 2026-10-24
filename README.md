# Incident Exchange

A private marketplace where companies turn security incidents into reviewed **defensive** playbooks. Other companies find them by symptoms and pay to unlock them, and contributors earn a share when their experience helps.

> **Demo build.** Every organization, person, host, and incident in the seed data is fictional. Payments are simulated and no real funds move. The product spec is in [`docs/BRIEF.md`](docs/BRIEF.md).

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
| `npm run dev` | Backend and frontend, both with live reload |
| `npm run typecheck` | Typechecks the frontend and the Convex code |
| `npm test` | 21 unit and integration tests |
| `npm run e2e` | Browser run of the whole demo (needs `npm run dev` running) |
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

1. **Northstar Cloud:** My incidents → open “Login service failures…” → **Draft with Moss** (labeled fallback) → **Accept all sections** → **Next: privacy review** → **Run privacy scan**. Eight high-severity identifiers are flagged. Click **Apply all recommended generalizations**, tick the approval box, then **Approve & submit**.
2. **Review Desk:** Review queue → Open → **Fetch references**. In the validation panel: **Run check** (FAIL) → **Apply defensive fix** → **Re-run check** (PASS). Tick the checklist, choose **Test reproduced**, then **Approve**.
3. **Northstar Cloud:** open the incident → step 4 → tick final approval → **Publish guide**.
4. **Harbor Analytics:** search “repeated authentication failures after a deployment”. Check the match reason, evidence label, limitations, and price → **Continue to demo checkout** → **Start** → tick the simulator box → **Complete simulated payment**. The receipt shows $49.00 → $39.20 contributor / $9.80 platform. Read the unlocked steps, ask a question, then **Report your outcome**.
5. **Review Desk:** Buyer feedback shows the outcome.

## Sponsor integrations: actual status

Integrations live behind server-side adapters with local fallbacks. A missing key never blocks the app. Live status is in **Demo menu → Sponsor integration status**. "Connected" appears only after a real successful call.

| Sponsor | Status in this build | Fallback, as labeled in the UI |
| --- | --- | --- |
| **Convex** | ✅ Connected (local backend) | none |
| **Moss** | ⚠️ Not wired. Moss's public SDK (`@inferedge/moss`) is a semantic-search runtime and needs project credentials. | Deterministic drafting from the contributor's own words. Grounded Q&A answers only from approved sections, cites them, and returns “Not enough information in this playbook” otherwise. |
| **Apify** | 🟡 Code complete, **untested**: no token. Uses `apify~website-content-crawler` against an allowlist (OWASP, NIST, CISA) and drops anything off-allowlist. | Seeded references, marked “Seeded reference — not live-retrieved” |
| **Factory Droid** | ❌ Unavailable: no CLI or SDK on this machine | “Local demo adapter (deterministic patch)” |
| **Armadin** | ❌ Unavailable: no event interface provided | “Local validator (toy-auth check)” |
| **Coinbase x402** | ❌ Not configured | “Demo payment” simulator. Purchases are stored as `simulated_success`, never as “settled”. |

To enable Apify: `npx convex env set APIFY_TOKEN <token>`, then click **Fetch references**. The badge switches to *Connected* only if the run succeeds. If it fails, the app falls back to seeded references and shows the error.

See [`docs/SPONSORS.md`](docs/SPONSORS.md) for what each remaining integration needs.

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
docs/              BRIEF.md (spec), SPONSORS.md (integration handoff)
```
