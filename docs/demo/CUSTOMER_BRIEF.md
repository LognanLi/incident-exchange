# Incident Exchange: Customer Brief

All organizations and cases in the demo are fictional. Everything below is a working hypothesis. None of it comes from customer interviews or measured results.

## Who it is for (hypothesis)

- **Customer:** a software company with roughly 20–200 engineers and a small infrastructure or security team. It runs production systems, gets incidents, and has no dedicated research staff.
- **Immediate user:** the on-call engineer handling a confusing incident, often late at night. Their six questions:
  1. Has anyone seen this before?
  2. Is it really the same problem, or does it just look similar?
  3. What should I check first to confirm it?
  4. How do I contain it without making things worse?
  5. How do I know the fix actually worked?
  6. What evidence backs this guide, and where does it stop applying?
- **Purchaser:** the engineering manager or security lead who approves spend and cares about time to resolution and risk.
- **Contributor:** a company that already resolved an incident and is willing to share a sanitized version of what helped, in exchange for credit and revenue.

## Job to be done

"When an incident shows symptoms I don't recognize, help me quickly find a similar resolved case, judge whether it applies, and follow defensive steps to detect, contain, recover, and verify."

## Why existing tools don't automatically solve it (hypotheses)

| Source | What it does well | Gap we think exists |
|---|---|---|
| Public advisories | Authoritative on known vulnerabilities | Organized by vendor or flaw, not by the symptoms an engineer is looking at; rarely covers operational or misconfiguration incidents |
| Monitoring / incident tools | Detect and route alerts, coordinate response | Show that something is wrong, not how another team fixed the same pattern |
| Internal postmortems | Detailed and trusted | Only cover your own history; a new failure mode has no internal precedent |
| General AI assistants | Fast, broad explanations | Not grounded in a verified, resolved case; can't show what evidence backs a step |
| Private intel communities | Trusted peer sharing | Membership-gated, informal, uneven coverage, no structured applicability or evidence labels |

## Promised result

Less time spent investigating a familiar-but-new incident: a faster route to a relevant resolved case, a clear check of whether it applies, and verification steps. We make no measured time-savings claim; the demo shows the workflow, not proven outcomes.

## The loop

1. **Private experience:** a contributor writes up an incident and the fix that helped.
2. **Approved guide:** the privacy scanner flags identifiers; the contributor generalizes them and approves the exact version.
3. **Evidence review:** a reviewer labels evidence as contributor reported, evidence reviewed, or test reproduced, and states what that evidence covers.
4. **Symptom match:** a buyer describes symptoms; matching shows overlapping clues and mismatch signals, not only a score.
5. **Paid access:** the buyer reviews the free preview (recognize, limitations, checks before use) and pays test USDC to unlock the full guide.
6. **Defensive application:** the buyer follows check, contain, recover, and verify steps in their own environment.
7. **Outcome feedback:** the buyer reports whether the guide helped, partly helped, or did not apply.
8. **Contributor credit:** the contributor's share accrues, and feedback shapes how the guide ranks.

## Business assumptions (prototype)

- Demo prices range from 0.10 to 0.60 test USDC per guide. These are placeholders, not a pricing study.
- The 80% contributor / 20% platform split is a prototype assumption.
- Accrual is not payout. The demo records earnings; it does not move real funds or handle tax, KYC, or settlement.
- Payments run on a test network only.

## Honest answers to objections

**Why pay when advisories are free?**
Advisories cover known vulnerabilities. Many incidents are operational (retries, caching, key rotation, missing authorization checks) and never get an advisory. The bet is that a symptom-matched, verified response guide saves enough investigation time to be worth a small price. That bet is untested.

**Why would a company share?**
Possible motives: revenue, reputation (under a pseudonym), and getting access in return. Sharing also carries real costs: legal review, re-identification risk, and time. We don't yet know whether these motives outweigh those costs.

**What about fraud (fake or low-quality guides)?**
Evidence levels are explicit, reviewers inspect supporting material, and outcome feedback exposes guides that don't help. This reduces fraud but doesn't eliminate it. A determined bad actor could still submit plausible fiction labeled "contributor reported".

**How do I know a guide applies to me?**
Every guide lists key clues, mismatch signals, checks before use, and an evidence scope. Matching is a discovery aid, not a diagnosis. The buyer still confirms against their own systems.

**How anonymous are contributors?**
Contributors are pseudonymous to buyers (for example, "B2B software team"). The platform knows who the contributor is. Scanning and generalization reduce identifiers, but re-identification risk remains, especially for distinctive incidents.

**Can attackers buy guides?**
Guides cover only detection, containment, recovery, and verification. They contain no exploitation steps. A guide could still reveal that a class of weakness exists. Buyer vetting and access controls would be needed beyond the demo, and we haven't built them.

**What exactly gets paid for?**
Access to the full defensive guide (check, contain, recover, verify, plus failed attempts). The free preview and applicability checks are visible before payment. Payment does not buy a guaranteed fix.

**What is the advantage as the library grows?**
More resolved cases make symptom matching more useful, and outcome feedback makes it easier to tell which guides really help. This depends on reaching enough contributors and buyers, which the demo does not show.
