# QA notes (2026-10-24, sprint)

## Commands and results
| Command | Result |
| --- | --- |
| `npm run typecheck` | pass |
| `npm test` (Vitest 41 + toy node:test 14) | 55/55 pass |
| `npm run build` | pass |
| `npm run e2e` (Chrome, live Moss/Apify/Factory/x402) | 19 steps pass, ~60 s, no console errors |
| `node e2e/viewports.mjs` | 1440 / 1024 / 390 px: no horizontal overflow on guide page; home + search inspected visually |

## Critical checks → evidence
1. Buyer cannot get private notes or unpurchased detail — `tests/lifecycle.test.ts` (access control; paid text lives only in `playbookRevisions`).
2. Editing approved text bumps revision and clears approval — “revisions and payments”.
3. Reviewer cannot approve unsubmitted/unapproved text — same test + hash check in `reviews.decide`.
4. Search: fixed-query evaluation (`tests/matching.test.ts`): exact, paraphrase, near-miss negative, mismatch, secondary, third case, unrelated, private identifiers — 8/8. A small fixture check, not proof of general accuracy.
5. Cancelled checkout does not unlock — lifecycle test.
6. Duplicate settlement callback → one purchase/accrual — lifecycle test (`x402State.recordSuccess` twice).
7. Settlement-then-DB-failure recovery — **not implemented** (see unresolved).
8. Exact integer split sums to gross — `tests/x402.test.ts`.
9. Toy checks fail before / pass after; deny-everything stubs fail; repair agent cannot edit evaluators (separate dir + permission sandbox) — `toy-apps/toy.test.mjs`, runner selftest, live Factory run.
10. Reset touches only `isDemo` records; stale Factory callback after reset rejected — lifecycle test.

## Journeys
- A (full lifecycle): pass (e2e). B (near-miss / mismatch): pass (e2e step + matching test). C (failed/cancelled payment): pass — lifecycle tests, plus a **live** x402 attempt at 03:38 with insufficient test USDC (0.60 guide, ~0.49 balance): facilitator refused (402), purchase stayed `pending` with the error shown, guide stayed locked (`lockedSteps`/`failedAttempts` null). Retry after success returns the same purchase (lifecycle test). D (fallbacks): covered by convex-test runs with no sponsor env (deterministic drafting, seeded refs, local validator, simulator).

## Unresolved
- If x402 settlement succeeds and the Convex write then fails, reconciliation is manual (tx hash is in the facilitator response/logs); a retry would sign a new authorization. Mitigated by idempotent recording; full reconcile-by-nonce not built.
- Factory candidate runs in the same Node process as the evaluator (permission model + frozen prototypes + nonce), not a full VM sandbox.
- Moss plan caps index builds (3 per project); additional guides use Moss Inference with supplied sections, labeled.
- zod 3.x advisory via `@coinbase/cdp-sdk`/`@x402/*` (no 3.x fix); payment header size capped at 16 KB.
- Keyboard: native controls and visible focus; no custom dialogs/drawers (evidence uses `<details>`). Full screen-reader audit not performed.
