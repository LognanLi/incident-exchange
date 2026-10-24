# Build status

Last verified: 2026-10-24, on a local anonymous Convex backend with Vite.

Checks run: `npm run typecheck` ✅ · `npm test` (30 tests) ✅ · `npm run build` ✅ · `npm run e2e` (17 browser steps with live Moss, Apify, and Factory; no console errors) ✅

## Acceptance criteria (docs/BRIEF.md §13)

| # | Criterion | Status | Proof |
|---|---|---|---|
| 1 | Installs and starts with documented commands | ✅ | `npm install && npm run setup && npm run dev` |
| 2 | Fresh session loads home + seeded demo | ✅ | auto `ensureSeeded`; e2e “Home loads” |
| 3 | Switch Northstar / reviewer / Harbor; reset | ✅ | Demo menu; e2e |
| 4 | Contributor submits incident and saves draft | ✅ | e2e “New incident report…”, lifecycle test |
| 5 | Moss drafts six parts, or labeled fallback works | ✅ (live Moss) | “Drafted by Moss” banner; fallback on error |
| 6 | Privacy scan flags seeded identifiers; contributor approves | ✅ | 7–8 high findings flagged (count varies with Moss vs. fallback wording); tests |
| 7 | Reviewer request changes / reject / approve + evidence label | ✅ | lifecycle tests + e2e approve |
| 8 | Apify references or clearly identified seeded fallback | ✅ (live Apify) | “Retrieved via Apify”; seeded fallback labeled |
| 9 | Symptom search returns playbook with plain-language reason | ✅ | e2e, unit tests |
| 10 | Free preview, evidence, limitations, price before purchase | ✅ | e2e |
| 11 | x402 if configured, else visible simulator unlocks | ✅ (live x402) | 0.49 test USDC settled on Base Sepolia, verified on-chain; simulator remains the labeled fallback |
| 12 | Purchase shows amount + correct split | ✅ | $49.00 → $39.20 / $9.80 |
| 13 | Toy validation fails before, passes after, truthful attribution | ✅ | Fix by Factory Droid (or local adapter); checks by local validator |
| 14 | Buyer feedback visible to reviewer | ✅ | e2e |
| 15 | Convex persists; buyers can't reach private notes | ✅ | access-control tests |
| 16 | No real data, credentials, unauthorized tests, real-payment claims | ✅ | seed data fictional; planted “secrets” are fake |
| 17 | Demo under 3 minutes after reset | ✅ | ~25 clicks; automated run ~35 s with live sponsor calls |
| 18 | README + accurate build status | ✅ | this file |

## Remaining (needs sponsor input; see docs/SPONSORS.md)
- [x] Moss: connected (index quota caps the plan at three indexes)
- [x] Apify: connected
- [x] Factory Droid: connected through the local runner
- [x] Coinbase x402: connected (Base Sepolia, CDP Server Wallets)
- [ ] Armadin (optional): waiting on event documentation
