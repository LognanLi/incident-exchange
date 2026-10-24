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

## Task board (final)

| Owner | Task | Status |
| --- | --- | --- |
| Lead | Contracts, schema (atomic USDC, revisions, playbookRevisions, buyer checklists), matching, seed, buyer/contributor/reviewer UI, QA, docs | done |
| Worker A | `convex/lib/scenarios.ts` (primary draft + 6 listings), `docs/demo/CUSTOMER_BRIEF.md` | done (03:15) |
| Worker E | `toy-apps/` (3 cases + protected evaluators + tests), Factory runner v2 | done (03:16) |

Cut to conserve time/tokens (user asked for ~90 min): sidebar navigation redesign, Moss semantic candidate generation for search (search is explainable lexical/concept matching; Moss handles drafting + Q&A), agent-purchase panel, two-guide comparison, settlement reconcile-by-nonce.

## Checkpoint log
- 03:12 baseline captured; branch created; workers launched 03:13.
- 03:24 backend refactor compiled; schema migrated (demo tables cleared, reseeded).
- 03:28 fixed-query matching evaluation 8/8.
- 03:30 commit ad683ec; all tests green.
- 03:35 full e2e with live Moss/Apify/Factory/x402 passes (19 steps).
- 03:38 live failed-payment check: stays locked.
- Current runnable state: `npm run dev`; branch `polish-sprint`; see docs/demo/DEMO.md.

## Goal round: startup features + design system (04:00–04:30 PDT)
- Research: `docs/research/DESIGN_RESEARCH.md` (24 sites; 23 fetched live for theme/font/motion signals) and `MARKET_RESEARCH.md` (TLP, ISACs, STIX/TAXII, data marketplaces, trust centers, procurement, legal).
- Shipped: vertical-tab sidebar, page guides + glossary, motion recipes, ⌘K palette, guided demo tour, real-time symptom alerts, audit log + CSV, TLP labels + verified-org gating, Data Use License, team budget, runbook + STIX 2.1 export, fit meter, contributor track record, How it works / Pricing / Trust pages, new home with live stats.
- Fidelity check vs. original brief: `docs/BRIEF_COMPARISON.md`.
- Checks: typecheck, build, 43 Vitest + 14 toy tests, e2e 23 steps with live Moss/Apify/Factory/x402.
- Remote: https://github.com/LognanLi/incident-exchange (private).
