# Polish sprint status

- **Start:** 2026-10-24 03:11 PDT · **Target end:** ~04:41 PDT (user shortened to ~90 min, token-conscious) · **Feature freeze:** ~04:20 PDT
- **Branch:** `polish-sprint` (from `main` @ c53a19c) · shared working tree
- **Services:** `npm run dev` → Vite :5173, Convex local :3210 (HTTP :3211), Factory runner :3299

## Baseline audit (03:12)

| Area | State |
| --- | --- |
| Contributor → reviewer → buyer loop, privacy scan, approval hash, demo reset | Working (e2e passing) |
| Moss drafting + grounded Q&A, Apify refs, Factory patch of toy config, x402 Base Sepolia | Working, verified live |
| Seed content (auth-lockout primary + unrelated catalog) | Visibly incomplete: brief requires webhook-idempotency primary, tenant-export + signing-key cases, 6–8 listings |
| Search relevance | Incomplete: score + reason only; no matched/conflicting clues, missing checks, overlap labels, mismatch |
| Pricing | Incomplete: USD cents + x402 ÷100 scaling; brief wants integer USDC atomic units, single price |
| Revisions | Incomplete: content hash binding exists; no revision numbers, purchases not bound to a revision |
| Paid text boundary | Working but paid sections stored on `playbooks` row (projection-guarded); move to revision table |
| “What they tried that did not work”, buyer checklist persistence, earnings accrued vs paid out | Missing |
| Factory runtime | Edits a config copy; brief wants a code change + protected tests in a separate runner |
| Layout | Top nav only; needs sidebar, presenter menu separation, 390px mobile verification |

## Task board

| Owner | Task | Status |
| --- | --- | --- |
| Lead | Contracts, schema (prices atomic, revisions, playbookRevisions), seed loader, playbooks/purchases backend, integration | in progress |
| A | Scenario content `convex/lib/scenarios.ts`, `docs/demo/CUSTOMER_BRIEF.md` | queued |
| B | Design system + app shell (styles.css, App.tsx, components/ui.tsx), then buyer UI | queued |
| E | Toy apps + protected evaluators (`toy-apps/`), Factory runner v2 | queued |
| Lead | Contributor/reviewer/buyer UI changes, QA, docs (no extra workers, to conserve tokens) | queued |

## Checkpoint log
- 03:12 baseline captured; branch created.
