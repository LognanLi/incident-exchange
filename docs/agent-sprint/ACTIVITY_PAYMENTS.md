# Agent activity and payments

The existing Agents page now connects real contributor and buyer activity to purchased revisions, receipt records, and contributor accruals. The lanes describe recorded actions rather than generated conversations. Agent A can be offline when B discovers its published resolution.

## Demonstration (about two minutes)

1. Start the existing presenter services: `npm run dev:factory`, `npm run dev:mcp`, and `npm run dev:frontend`. Open `http://localhost:5173/agents`. No Convex watcher is needed.
2. Select Duplicate deliveries or Cross-tenant access, then **Run demo**. A's protected tests, disclosure gate, exact-hash approval and MCP submission appear in the contributor lane. B searches, checks fit, reuses its existing entitlement, retrieves the purchased revision, and asks Factory to adapt it in an isolated copy. Independent tests and the recorded outcome finish the buyer lane.
3. Open an event using click or Enter. Inspect the real tool, sanitized inputs, revision, result and evidence. Pending is labeled as the status at that event, not as a claim that an old step is still running.
4. In **Payments**, inspect the original quote, expiry, exact revision, recipient, policy limits, remaining allowance and settlement receipt. Follow the Base Sepolia transaction link. These rehearsals reuse the two existing testnet purchases; they create no new payment.
5. Show **Contributor earnings**: 0.02 test USDC gross = 0.016 contributor accrual + 0.004 platform fee; paid out = 0.00. The one simulated sale is excluded. These are deployment-wide ledger totals, not a counter for the latest run.
6. Enable **Show all recent activity** and **Only denials and failures** to inspect actual recorded refusals. Switch to **Recorded run**. Replay, pause, seek with the keyboard, and open individual events. The banner and every event identify the recording. The payment receipt appears when its reuse is observed; no future payment result is presented early. The ledger and policy are explicitly labeled as capture snapshots.

If Factory or MCP is unavailable, inspect existing events or the recording. If the local runner disconnects after sign-in, Run is disabled with a recovery message. Hosted viewer sessions retain inspection/replay, with no Run control. The existing hosted presenter/session startup remains in place.

## Backend and schema

- `agentEvents.detail` is optional sanitized evidence: tool, bounded input/result fields, resolution/revision and references. Shared connector/server sanitizers run before transmission and authoritative storage. They drop credential keys and redact known credential, exchange-token, signature, personal-data and private-host formats. Sensitive values are scanned before truncation.
- Authenticated denials that must be visible return an internal `__denied` marker so Convex commits their audit event; the local/remote MCP layer converts it to the normal structured tool error. Throwing after writing an event would roll back the event.
- `purchases.paymentStatus` adds `failed`. A pre-dispatch failure releases the reservation. Authorization identifiers are persisted before a signed HTTP request is sent. An uncertain dispatched payment stays pending and reserved until on-chain reconciliation. Cancellation/provider switching is refused while authorization is unresolved. Public receipts expose a boolean confirmation flag, never the authorization nonce or signature.
- Optional `quotes.purchaseId` binds duplicate quotes to the earlier purchase. Optional `purchases.spendPolicySnapshot` preserves the operator budget and remaining allowance at reservation time. Older records continue to work; their absent authorization-time policy is labeled honestly, alongside the current policy.
- Payment and earnings views join existing quotes, purchases, policies and events. They use integer atomic units and existing ledger splits. Simulator completion cannot revive a canceled/failed purchase. Contributor MCP status excludes simulated sales from accruals too.
- Cross-organization viewers do not receive raw repair diffs, local notes, private outcome summaries, or older Factory prose that could reveal a paid fix. Shareable recordings omit patches, free-text repair/outcome summaries and local applicability sources. Test counts, hashes, revisions and receipts remain inspectable.

These are additive schema changes. No migration, reset, token rotation, production deployment or real funds are required. The shared dev backend was updated from this branch based on `main` @ `ac9c6cd`; the final deployment is recorded in `docs/CLAIMS.md`. The user merges the PR manually.

## Verification evidence (2026-10-24 PDT)

| Check | Result |
| --- | --- |
| Real presenter run, Duplicate deliveries, 21:32 | A 3/5 → 5/5; B 2/5 → 5/5, Factory, `runner_verified`, 25 seconds; existing purchase reused |
| Real tenant run, 21:33 | A 2/5 → 5/5; B 3/6 → 6/6, Factory, `runner_verified`, 28 seconds; existing purchase reused; contributor events stay in A's lane |
| Receipts and ledger | Both original Base Sepolia receipts independently read via RPC; successful USDC transfers match quoted amount (10000 atomic each) and pinned recipient. Purchase records/ledger identical before and after rehearsals: 3 purchases, 2 testnet sales, 1 excluded simulator sale |
| Local MCP protocol | Negotiation, 11 tools, Moss semantic search, no-match, invalid-input and scope/auth refusals pass |
| Remote MCP + OAuth | 13/13 pass, Moss semantic search retained |
| Adversarial checks | 9/9 pass, including over-budget and payee-redirect refusal, paywall, disclosure, quarantine and unverified-outcome handling; no new purchases |
| Browser rendering | Chromium, 1440/1024/390 px: no horizontal overflow; actual event expansion via keyboard, receipt selection/link, denial filters, replay/pause/seek, recording filter reset and disconnected-runner recovery; no runtime errors; WCAG 2.1 A/AA audit has no violations |
| Hosted viewer | Access-code gate, both recording lanes, no Run control, public receipt link, no raw patches and no browser errors verified on the deployed console |
| Isolated backend + transport fixtures | Requested/authorized/pending/settled/simulated/failed/canceled/refused/expired states; failed reservation release; post-dispatch timeout remains reserved; cancellation and provider-switch guard; duplicate/idempotent acquisition; signature tracking must commit before transport dispatch; canceled simulator cannot grant access; exact splits; policy snapshots; no secret/unpaid patch exposure; replay excludes future events/receipts |
| Typecheck, tests, build | `npm run typecheck`, `npm test` (158 Vitest + 14 toy tests), `npm run build` pass |

Reproducible browser check (read-only): `node e2e/agent-activity.mjs http://localhost:5173 /tmp/ix-activity`. Add `--run` only to deliberately rehearse the fixture. Screenshots are written to the output directory. Read-only chain/ledger check: `node e2e/agent-ledger-check.mjs`; it optionally accepts a pre-rehearsal JSON snapshot to assert no purchases or accruals changed.

No fresh payment was needed for verification: real success receipts already exist. Failed/canceled settlement and transport failures were deliberately exercised in isolated fixtures, rather than disrupting shared purchases. Historical receipts lack authorization-time policy snapshots and cannot reconstruct one; new acquisitions capture it. Safari and hosted presenter mode in Zen were not reverified in this change. Production, end-user OAuth/PKCE, payout execution and Linux CI remain outside this work.
