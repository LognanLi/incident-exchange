# Build status

Last verified: 2026-10-24, on a local anonymous Convex backend with Vite.

Checks run: `npm run typecheck` ✅ · `npm test` (21 tests) ✅ · `npm run build` ✅ · `npm run e2e` (17 browser steps, no console errors) ✅

## Acceptance criteria (docs/BRIEF.md §13)

| # | Criterion | Status | Proof |
|---|---|---|---|
| 1 | Installs and starts with documented commands | ✅ | `npm install && npm run setup && npm run dev` |
| 2 | Fresh session loads home + seeded demo | ✅ | auto `ensureSeeded`; e2e “Home loads” |
| 3 | Switch Northstar / reviewer / Harbor; reset | ✅ | Demo menu; e2e |
| 4 | Contributor submits incident and saves draft | ✅ | e2e “New incident report…”, lifecycle test |
| 5 | Moss drafts six parts, or labeled fallback works | ✅ (fallback) | “Drafted by the deterministic fallback” banner |
| 6 | Privacy scan flags seeded identifiers; contributor approves | ✅ | 8 high findings flagged; tests |
| 7 | Reviewer request changes / reject / approve + evidence label | ✅ | lifecycle tests + e2e approve |
| 8 | Apify references or clearly identified seeded fallback | ✅ (fallback) | “Seeded reference — not live-retrieved” |
| 9 | Symptom search returns playbook with plain-language reason | ✅ | e2e, unit tests |
| 10 | Free preview, evidence, limitations, price before purchase | ✅ | e2e |
| 11 | x402 if configured, else visible simulator unlocks | ✅ (simulator) | “DEMO PAYMENT — SIMULATED” |
| 12 | Purchase shows amount + correct split | ✅ | $49.00 → $39.20 / $9.80 |
| 13 | Toy validation fails before, passes after, truthful attribution | ✅ | Local validator / Local demo adapter |
| 14 | Buyer feedback visible to reviewer | ✅ | e2e |
| 15 | Convex persists; buyers can't reach private notes | ✅ | access-control tests |
| 16 | No real data, credentials, unauthorized tests, real-payment claims | ✅ | seed data fictional; planted “secrets” are fake |
| 17 | Demo under 3 minutes after reset | ✅ | ~25 clicks; automated run 3.8 s |
| 18 | README + accurate build status | ✅ | this file |

## Remaining (needs sponsor input; see docs/SPONSORS.md)
- [ ] Moss: SDK/credentials and intended use (retrieval vs. generation)
- [ ] Apify: token, to exercise the already-implemented adapter
- [ ] Coinbase x402: test network setup
- [ ] Factory Droid / Armadin: supported, restrictable interfaces
