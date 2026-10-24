# Sponsor integration handoff

Every sponsor sits behind a server-side adapter with a labeled local fallback. To turn one on, the builder (you or Claude) needs the items below. Put the details in this file (in the section for that sponsor) or paste them into a chat. **Never commit secrets.** Keys go in `npx convex env set NAME value`.

For each sponsor, the most useful items are:

1. **Official docs link** for the exact API/SDK version the event supports (quickstart + API reference).
2. **Credentials**: their names only here. Set the values with `npx convex env set`.
3. **Event-specific rules**: test networks, allowed targets, rate limits, required attribution.
4. **A working sample request/response** (curl or code), if the sponsor gave one.

---

## Moss: playbook drafting and grounded Q&A
- Currently: deterministic fallback (`convex/lib/drafting.ts`, `convex/lib/qa.ts`).
- Open question: Moss's public npm SDK (`@inferedge/moss`) is a semantic-search/retrieval runtime, not a text generator. Confirm whether the sponsor expects Moss for **retrieval over approved sections** (most natural fit for grounded Q&A) and/or offers a generation endpoint for drafting.
- Needed: docs link, project ID/key names, whether indexes are created per playbook or per tenant, Node runtime requirements.
- Hook points: `drafts.generateSections` (drafting) and `playbooks.ask` (Q&A). Only buyer-accessible sections may be sent. Never send `privateNotes`.

## Apify: public reference retrieval
- Currently: implemented (`convex/lib/apify.ts`) but **not yet exercised**, because no token is set.
- Needed: `APIFY_TOKEN`, plus confirmation of the Actor to use (default `apify~website-content-crawler`) and whether the event provides credits.
- To verify: `npx convex env set APIFY_TOKEN …`, then click **Fetch references** in the reviewer console. The badge must change to *Connected*.

## Coinbase x402: paid access
- Currently: demo simulator (`convex/purchases.ts`).
- Needed: target network (e.g. Base Sepolia), facilitator URL, the receiving test address (`payTo`), test asset (USDC contract on that network), and how buyers sign during the demo (browser wallet vs. Coinbase-provided test wallet). No private keys will be stored server-side.
- Hook point: add an `x402_test` provider beside `demo_simulator`. Unlock only after the facilitator verifies the payment and returns success.

## Factory Droid: defensive patch workflow
- Currently: “Local demo adapter”. The `droid` CLI is not installed on this machine.
- Needed: install method (CLI/SDK), API key name, and a confirmed way to restrict it to an allowlist: inspect `convex/lib/toyAuth.ts`, apply a patch, run `npm test -- tests/domain.test.ts`. No arbitrary shell, network, or deployment access.

## Armadin: authorized validation
- Currently: local validator. It is never attributed to Armadin.
- Needed: the event-supported interface, plus proof that the target can be locked to the local toy app only. No public scanning.
