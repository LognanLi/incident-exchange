# Contracts (polish sprint)

## Data boundaries
- `playbooks` = **public projection only** (title, summary, Recognize + Limitations preview, applicability clues/mismatch/checks, evidence level + scope, environment, price, revision). Search and previews read only this table through an explicit allowlist (`listing()` in `convex/playbooks.ts`).
- `playbookRevisions` = **paid content** per published revision (Check, Contain, Recover, Verify, failed attempts). Read only by `entitledContent()` after `entitledRevision()` confirms access (reviewer; owning contributor; buyer with a settled/simulated purchase of that revision).
- `incidentDrafts` = contributor-private (notes, evidence summary, identifying terms). Never returned to buyers; reviewers get a projection without `privateNotes`/`identifyingTerms`.

## Revisions
- `draft.revision` starts at 1. Any shareable-content edit while a contributor approval exists clears the approval and increments the revision (`invalidate()` in `convex/drafts.ts`).
- Contributor approval stores `{at, contentHash, revision}`. Reviewer decisions record the same `revision` + `contentHash`; approve requires the stored hash to equal the current content.
- Publishing writes `playbooks.revision` and a `playbookRevisions` row. Purchases store `revision`; buyers see the revision they bought and a notice when a newer one exists.

## Money
- Integer atomic units as strings (`priceAtomic`, `amountAtomic`, `contributorShareAtomic`, `platformShareAtomic`); currency USDC, 6 decimals. Demo prices are whole cents, 0.10–1.00.
- `splitRevenue()` floors the 80% contributor share; platform gets the remainder (always sums to gross). Accrual ≠ payout (`paidOutAtomic` is always "0").

## Matching (`convex/lib/matching.ts`)
- `matchGuide(query, guide)` → `{ matchedClues, conflictingClues, missingChecks, relevanceLabel, score }`; labels `strong_overlap` (key clue + corroborating, no conflicts), `some_overlap`, `needs_evidence` (weak or conflicting). Negated phrases ("without repeated event IDs") do not count. Price never affects ranking.

## Validation
- `toy-apps/<case>/{vulnerable,fixed,evaluate}.mjs`; evaluators are protected (outside any repair workspace).
- Local adapter: Convex evaluates `vulnerable` or `fixed` (`toyTargets.variant`).
- Factory runner (`scripts/factory-runner.mjs`, 127.0.0.1:3299): `POST /patch {actor, draftId, toyCase}` → baseline eval → `droid exec --auto low --only-tools Read,LS,ApplyPatch` in a temp dir holding only `handler.mjs` → protected eval under `node --permission` → `validation.recordFactoryRun` (shared secret + reviewer role + allowlisted file check) → artifact JSON.
- "Test reproduced" requires a failing before-run, a fix, then a passing after-run on that draft.

## Payments (x402)
- `POST {CONVEX_SITE_URL}/x402/purchases/<purchaseId>`: 402 challenge for the purchase's exact `atomicAmount`, Base Sepolia USDC, stored `payTo`; verify + settle via the CDP facilitator; `x402State.recordSuccess` is idempotent (pending → test_success once).
- Retry/reload: `startCheckout` returns the existing paid purchase; pending checkouts are reused.
