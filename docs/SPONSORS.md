# Sponsor integration handoff

Every sponsor sits behind a server-side adapter with a labeled local fallback. To turn one on, the builder (you or Claude) needs the items below. Put the details in this file (in the section for that sponsor) or paste them into a chat. **Never commit secrets.** Keys go in `npx convex env set NAME value`.

For each sponsor, the most useful items are:

1. **Official docs link** for the exact API/SDK version the event supports (quickstart + API reference).
2. **Credentials**: their names only here. Set the values with `npx convex env set`.
3. **Event-specific rules**: test networks, allowed targets, rate limits, required attribution.
4. **A working sample request/response** (curl or code), if the sponsor gave one.

---

## Moss: playbook drafting and grounded Q&A
- ✅ **Connected and verified.** Drafting uses Moss Inference (`drafts.draftPlaybook`). Q&A uses per-guide preview/full indexes built at publish (`convex/mossIndex.ts`) and retrieved through Moss Inference (`playbooks.askPlaybook`).
- Plan limit hit during testing: index builds beyond three per project are rejected. Q&A then uses Moss Inference with sections passed in directly, labeled in the UI.

KEYS:

MOSS_PROJECT_ID=<set in .secrets.local / Convex env>
MOSS_PROJECT_KEY=<set in .secrets.local / Convex env>

DOCS: 
https://docs.moss.dev/docs


## Apify: public reference retrieval
- ✅ **Connected and verified.** A live crawl returned three allowlisted references.
- Needed: `APIFY_TOKEN`, plus confirmation of the Actor to use (default `apify~website-content-crawler`) and whether the event provides credits
- To verify: `npx convex env set APIFY_TOKEN …`, then click **Fetch references** in the reviewer console. The badge must change to *Connected*.
GET
https://api.apify.com/v2/actors?token=$APIFY_TOKEN


Creates a new Actor. The POST payload must be a JSON object with Actor properties.
POST
https://api.apify.com/v2/actors?token=$APIFY_TOKEN



## Coinbase x402: paid access
- Currently: demo simulator (`convex/purchases.ts`).
- Needed: target network (e.g. Base Sepolia), facilitator URL, the receiving test address (`payTo`), test asset (USDC contract on that network), and how buyers sign during the demo (browser wallet vs. Coinbase-provided test wallet). No private keys will be stored server-side.
- Hook point: add an `x402_test` provider beside `demo_simulator`. Unlock only after the facilitator verifies the payment and returns success.

## Factory Droid: defensive patch workflow
- ✅ **Connected and verified** through `scripts/factory-runner.mjs` (started by `npm run dev`). `droid` is a project dev dependency.
- Needed: install method (CLI/SDK), API key name, and a confirmed way to restrict it to an allowlist: inspect `convex/lib/toyAuth.ts`, apply a patch, run `npm test -- tests/domain.test.ts`. No arbitrary shell, network, or deployment access.

API key: FACTORY_API_KEY (value in .secrets.local)

## Armadin: authorized validation
- Currently: local validator. It is never attributed to Armadin.
- Needed: the event-supported interface, plus proof that the target can be locked to the local toy app only. No public scanning.



Here are my keys: 

GET
https://api.apify.com/v2/actors?token=$APIFY_TOKEN


Creates a new Actor. The POST payload must be a JSON object with Actor properties.
POST
https://api.apify.com/v2/actors?token=$APIFY_TOKEN


