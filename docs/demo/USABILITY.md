> Historical planning/QA snapshot. Current submission behavior and dated verification: [SUBMISSION_AUDIT.md](../agent-sprint/SUBMISSION_AUDIT.md). Older commands, counts and connection claims below are not current release instructions.

# Usability review (2026-10-24)

**What this is:** an expert heuristic review (Nielsen's 10 heuristics) by the builder, an automated accessibility audit, and readability scoring. **What it is not:** a study with real users — no participants were tested. A ready-to-run 5-person test script is at the bottom.

## Automated accessibility (axe-core 4, WCAG 2.1 A + AA)
`node e2e/a11y.mjs` audits 17 screens (home, how it works, pricing, trust, search, alerts, team, contributor dashboard/form/editor/privacy, review queue/detail, audit log, guide, checkout, presenter controls).
- First run: 13 violations (sidebar label contrast on every page; invalid ARIA on the budget meter; low-contrast `kbd` and "unavailable" badge).
- After fixes: **0 violations on all 17 screens.**

## Readability of the plain-language help (Flesch reading ease)
33 help/glossary texts: average **70** (“plain English” band 60–70). The four hardest sentences (26–41) were rewritten into shorter, simpler sentences.

## Heuristic review → changes made
| Heuristic | Finding | Change |
| --- | --- | --- |
| Visibility of status | Long steps (Moss ~7 s, Factory ~15 s, payment) could look frozen | Buttons show live states (“Drafting…”, “Factory Droid working…”, “Paying on Base Sepolia…”); toasts for new alerts |
| Match with the real world | Jargon: playbook, TLP, x402, accrual, reproduced | Every page opens with a one-sentence guide + hover glossary; validation panel explains the test “in plain words” |
| User control & freedom | Redaction could not be undone; tips could not be hidden | Undo last generalization; dismissible page guides; cancel checkout |
| Consistency | “Playbook” on contributor side vs. “guide” on buyer side | Standardized on “guide” in all user-facing text |
| Error prevention | Paying twice, overspending, buying restricted content | Double-payment guard with on-chain reconciliation; monthly budget; TLP:AMBER verified-only; license required |
| Recognition over recall | Presenters/new users must remember the flow | Guided demo panel (“Click / Say / Take me there”); role paths on home; stepper with checkmarks |
| Flexibility | Power users want speed | ⌘K command palette (jump anywhere or search a problem) |
| Minimalist design | Earlier top-nav + dense cards | Vertical-tab sidebar, one accent color, generous spacing, fewer badges per card |
| Recover from errors | Server errors shown as raw text | Plain messages (e.g. “This purchase would exceed your team's monthly guide budget. Raise it under Team & budget.”) |
| Help & documentation | — | How it works, Trust & safety, Pricing pages; glossary; DEMO.md |

## Remaining risks (not yet validated)
- Whether non-technical buyers understand “overlap” labels without the tooltip.
- Whether contributors trust the privacy scan enough to share.
- Mobile: sidebar becomes a horizontal tab strip; deep pages are long on phones.

## 5-person usability test script (for real users)
Recruit 5 people (2 non-technical, 2 engineers, 1 security lead). Think-aloud, 20 min each. Success = completed without help.
1. “Your orders are being created twice. Find out if anyone has fixed this.” (search → read fit panel)
2. “Decide whether this guide fits your situation, without buying it.” (fit/mismatch, evidence)
3. “Buy it and find what the other team tried that didn't work.” (license → pay → failed attempts)
4. “Get notified if someone publishes a fix for customers seeing other customers' files.” (alerts)
5. (Contributor) “Share an incident but make sure your company can't be identified.” (form → privacy scan → preview)
Record: task success, time, errors, and a 1–7 ease rating; fix the top 3 issues and retest.
