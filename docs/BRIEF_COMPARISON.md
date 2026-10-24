# Product vs. original brief (`docs/BRIEF.md`)

Checked 2026-10-24. ✅ matches · ➕ goes beyond · ⚠️ deviates (with reason).

## §1 Product definition and principles
| Brief | Product |
| --- | --- |
| Private marketplace: sanitized lessons → reviewed guides → paid access → contributor share | ✅ Full loop; 80/20 accrual ledger |
| 1. Defensive only | ✅ Content, Moss prompts, toy apps, and Trust page are defensive; no attack steps |
| 2. Contributor approval before publication | ✅ Approval bound to content hash + revision; final publish approval after review |
| 3. Reduce identification risk, never promise anonymity | ✅ Privacy scan, pseudonymous alias; copy says risk is reduced, not eliminated |
| 4. Honest evidence labels; AI never certifies | ✅ Three labels; "Test reproduced" enforced server-side by a fail→fix→pass run |
| 5. Urgent basics free | ✅ On home and every guide |
| 6. Source links for public research | ✅ Allowlisted, linked, labeled live vs. curated |
| 7. Tests only on local/authorized targets | ✅ Bundled toy apps only; runner bound to 127.0.0.1 |
| 8. Price and split before payment | ✅ Guide sidebar + checkout |
| 9. Label simulated payments and fallbacks | ✅ “Demo payment” vs. “Coinbase x402 · Base Sepolia” |
| 10. Similarity ≠ proof | ✅ Stated on search, footer, glossary |

## §2 Architecture
| Brief | Product |
| --- | --- |
| Web app, not MCP | ✅ React + Convex web app; no MCP |
| Convex backend with access checks, seed/reset | ✅ |
| Adapters for Moss, Apify, Factory, Armadin, x402 with local fallbacks | ✅ all five adapters; Armadin unavailable (no interface) and never credited |
| Local demo target with misconfiguration + fix + tests | ✅ ⚠️ three toy apps (webhook, tenant export, key cache) instead of one; polish sprint replaced the original auth-lockout case |

## §3 Roles
✅ Contributor, buyer, reviewer, demo operator (Presenter controls) with server-side role checks. ➕ Buyer org verification flag (gates TLP:AMBER).

## §4 Journeys
✅ Contributor, reviewer, buyer, and validation flows all implemented and exercised in `npm run e2e`.
⚠️ Moss: brief says “Moss drafts”. Moss is primarily retrieval; drafting uses **Moss Inference** (Moss's documented chat-completions API with retrieval off) and is attributed as generation. Q&A uses Moss retrieval from a per-guide index when available.

## §5 Content model
✅ Six sections (Recognize, Check, Contain, Recover, Verify, Limitations). ➕ “What they tried that did not work” (paid), applicability checklist, mismatch signals, evidence scope.

## §6 Screens (12 required)
| # | Required | Product |
| --- | --- | --- |
| 1 | Home | ✅ ➕ live stats, role paths |
| 2 | Contributor dashboard | ✅ accrued vs. paid out, outcomes |
| 3 | Incident form | ✅ progress, validation, save |
| 4 | Playbook editor | ✅ source notes beside each section |
| 5 | Privacy review | ✅ findings, apply/undo, buyer preview, approval |
| 6 | Review queue | ✅ ➕ section-targeted change requests |
| 7 | Buyer search | ✅ overlap labels, matched/conflicting clues |
| 8 | Playbook page | ✅ fit panel, locked detail, evidence |
| 9 | Validation panel | ✅ authorized target, before/fix/after, attribution |
| 10 | Purchase confirmation | ✅ amount, split, tx link |
| 11 | Feedback form | ✅ |
| 12 | Demo menu | ✅ “Presenter controls”, separate from customer nav |

## §7 Sponsors — see `docs/demo/INTEGRATIONS.md`
Convex ✅ live · Moss ✅ live · Apify ✅ live · Factory ✅ live (local runner) · x402 ✅ testnet · Armadin ⚠️ unavailable.

## §8 Data model
✅ All suggested tables or equivalents. ⚠️ Changes: money stored as integer USDC atomic strings (brief: minor units), paid content split into `playbookRevisions`, `publicReferences` keyed by draft or playbook. ➕ watches, alerts, auditEvents, spendPolicies, buyerChecklists, mossIndexes, x402Wallets.

## §9 Seeded demo
⚠️ Northstar/Harbor kept, but the scenario changed from “repeated authentication failures” to “duplicate jobs after webhook retries” per the later polish brief; two more case families added. One-click reset ✅.

## §10 Economics
✅ 80/20 prototype split, shown before checkout, test/simulated only, no real funds.

## §13 Acceptance criteria
All 18 met — evidence in `BUILD_STATUS.md` and `docs/demo/QA.md`.

## Beyond the brief (startup features)
➕ Traffic Light Protocol labels with verified-org gating · Data Use License on every purchase · real-time symptom alerts · team monthly budget · append-only audit log with CSV export · runbook (Markdown) and STIX 2.1 export · plain-language page guides + glossary · pricing and trust pages · vertical-tab design system with motion.
