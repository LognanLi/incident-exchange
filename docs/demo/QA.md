# QA notes (2026-10-24, sprint)

## Commands and results
| Command | Result |
| --- | --- |
| `npm run typecheck` | pass |
| `npm test` (Vitest 43 + toy node:test 14) | 57/57 pass |
| `npm run build` | pass |
| `npm run e2e` (Chrome, live Moss/Apify/Factory/x402) | 23 steps pass (incl. live alert toast, license, exports), ~100 s, no console errors |
| `node e2e/viewports.mjs` | 1440 / 1024 / 390 px: no horizontal overflow on guide page; home + search inspected visually |

## Critical checks → evidence
1. Buyer cannot get private notes or unpurchased detail — `tests/lifecycle.test.ts` (access control; paid text lives only in `playbookRevisions`).
2. Editing approved text bumps revision and clears approval — “revisions and payments”.
3. Reviewer cannot approve unsubmitted/unapproved text — same test + hash check in `reviews.decide`.
4. Search: fixed-query evaluation (`tests/matching.test.ts`): exact, paraphrase, near-miss negative, mismatch, secondary, third case, unrelated, private identifiers — 8/8. A small fixture check, not proof of general accuracy.
5. Cancelled checkout does not unlock — lifecycle test.
6. Duplicate settlement callback → one purchase/accrual — lifecycle test (`x402State.recordSuccess` twice).
7. Settlement recovery — implemented: the signed EIP-3009 nonce is stored before settlement; a second authorization is refused while one is pending; `x402Node.reconcilePayment` reads USDC `authorizationState` on Base Sepolia and records the purchase if used (or clears it after expiry). **Live-tested 2026-10-24** with a real past authorization: detected as settled, purchase recorded, repeat payment refused. Unit test: “settlement recovery guard”.
8. Exact integer split sums to gross — `tests/x402.test.ts`.
9. Toy checks fail before / pass after; deny-everything stubs fail; repair agent cannot edit evaluators (separate dir + permission sandbox) — `toy-apps/toy.test.mjs`, runner selftest, live Factory run.
10. Reset touches only `isDemo` records; stale Factory callback after reset rejected — lifecycle test.

## Journeys
- A (full lifecycle): pass (e2e). B (near-miss / mismatch): pass (e2e step + matching test). C (failed/cancelled payment): pass — lifecycle tests, plus a **live** x402 attempt at 03:38 with insufficient test USDC (0.60 guide, ~0.49 balance): facilitator refused (402), purchase stayed `pending` with the error shown, guide stayed locked (`lockedSteps`/`failedAttempts` null). Retry after success returns the same purchase (lifecycle test). D (fallbacks): covered by convex-test runs with no sponsor env (deterministic drafting, seeded refs, local validator, simulator).

## Unresolved
- Reconciliation finds the transaction hash only within ~5,000 recent blocks (public RPC caps log queries at 200 blocks); older settlements are still recorded as settled, without a hash link.
- Factory candidate runs in the same Node process as the evaluator (permission model + frozen prototypes + nonce), not a full VM sandbox.
- Moss plan caps index builds (3 per project); additional guides use Moss Inference with supplied sections, labeled.
- zod 3.x advisory via `@coinbase/cdp-sdk`/`@x402/*` (no 3.x fix); payment header size capped at 16 KB.
- Keyboard: native controls and visible focus; no custom dialogs/drawers (evidence uses `<details>`). Full screen-reader audit not performed.

## Goal round additions
- License, TLP:AMBER verification, and budget enforcement — lifecycle test.
- Saved symptom alert fires on publish — lifecycle test + e2e toast.
- ⌘K palette search and guided demo navigation verified in Chrome (no page errors); 1440 and 390 px layouts without horizontal overflow.

## Accessibility & usability
- axe-core WCAG 2.1 A/AA: 17 screens, 0 violations (`node e2e/a11y.mjs`). Details and heuristic review: `docs/demo/USABILITY.md` (expert review, not a user study).
