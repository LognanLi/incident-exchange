# Incident Exchange — Claude End-to-End Build Brief

> **Instructions to Claude Code:** Build the application described in this document in the current repository. Treat this file as the product source of truth. Inspect the repository first, preserve any useful existing work, and then implement the app end to end. Do not stop after planning, scaffolding, or writing a design. Continue until the acceptance criteria at the end are met, the app starts, and the principal user flow works. Make reasonable implementation choices without asking the user unless a real external credential, irreversible action, or missing product decision makes progress impossible. Never claim an integration works unless you actually exercised it. If an external credential is unavailable, finish the application with a clearly labeled local/demo adapter and document how to enable the real integration.

## 0. Completion rule

Work in a persistent, bounded build loop:

1. Inspect the repository, available commands, and existing conventions.
2. Write a short task checklist in your working notes or `BUILD_STATUS.md`.
3. Implement the highest-priority incomplete slice.
4. Run the relevant build, typecheck, lint, and tests that already exist. Add focused tests for critical new behavior when appropriate.
5. Start the app and exercise the real UI flow where possible.
6. Fix failures, update the checklist, and repeat.
7. Stop only when every acceptance criterion below is met, or when a concrete blocker requires a human credential/decision. On a blocker, finish every independent part, leave the app runnable, and report the precise missing item.

Do not use an unbounded shell loop or repeatedly run the same failing command. If a check fails twice for the same root cause, inspect the failure and change the approach. Never leave the user with only a plan when implementation is possible.

## 1. Product definition

**Incident Exchange is a private marketplace where companies turn security incidents into reviewed defensive playbooks, other companies find and pay for relevant guidance, and contributors earn a share when their experience helps.**

A company that handles a security incident learns practical lessons: warning signs, investigative steps, containment, recovery, and how it verified the fix. Those lessons often stay in private tickets and postmortems. Another company may face similar symptoms and need to rediscover the answer. Incident Exchange makes appropriately sanitized, reviewed lessons searchable and reusable, while allowing contributors to control what they disclose and earn when their guide helps.

This is a defensive knowledge exchange, not a public dump of breach details. It must not expose credentials, private customer data, or instructions that enable attacks.

### Product promise

- Contributors can turn a hard-won incident lesson into a controlled, privacy-reviewed guide.
- Buyers can search by symptoms, inspect evidence and limits, and obtain relevant defensive steps.
- Reviewers can distinguish a contributor claim from reviewed or reproduced evidence.
- Buyers can pay to unlock detailed guidance; contributors receive a transparent share.

### Product principles

1. Defensive detection, containment, recovery, and verification only.
2. Contributor approval is required before any buyer-facing publication.
3. Reduce identification risk; never promise perfect anonymity.
4. Label the evidence level honestly; never imply AI certifies safety.
5. Keep urgent basic protective advice accessible without payment.
6. Show source links for public research.
7. Run security tests only against the local demo app or explicitly authorized targets.
8. Show the price and revenue split before payment.
9. Clearly identify simulated/test payment and local integration fallbacks.
10. Similarity is a discovery aid, not proof that incidents share a cause.

## 2. Architecture answer: is this an MCP server?

**No. The primary product is a web application, not an MCP server.** Build a normal user-facing application with a browser frontend, backend/data layer, and integration adapters. MCP is optional future packaging for exposing selected Incident Exchange capabilities to AI assistants; it is not needed for the Cal Hacks MVP.

### Recommended architecture

```text
Browser UI (React + TypeScript)
  ├─ Contributor workspace
  ├─ Reviewer console
  ├─ Buyer search and playbook pages
  └─ Demo controls
        │
        ▼
Convex application backend
  ├─ Database schema and access checks
  ├─ Queries/mutations for drafts, reviews, listings, purchases, feedback
  ├─ Server actions for external integrations
  └─ Seed/reset functions for demo data
        │
        ├── Moss adapter: draft/answer from approved playbook
        ├── Apify adapter: fetch public references
        ├── Factory Droid adapter: patch/test local demo app, if SDK is available
        ├── Armadin adapter: authorized validation only, if available
        └── Coinbase x402 adapter: test payment / clearly labeled simulator

Local demo target
  └─ Intentionally misconfigured sample service + defensive fix + tests
```

Use the existing repository’s framework if one already exists and works. Otherwise default to React + TypeScript, Convex, and a responsive web UI. Keep the integration interfaces isolated so the app can run without sponsor credentials. Do not make the core flow depend on real external APIs.

### What MCP would mean here

MCP (Model Context Protocol) is a standard for letting AI clients call tools or read resources exposed by a server. An Incident Exchange MCP server could later offer tools such as `search_playbooks`, `get_playbook_preview`, or `submit_outcome_feedback` to an authorized assistant. It would require authentication, tenant isolation, careful handling of paid access, and tool-level permissions. It is **not** the database, web app, payment system, or core backend. Do not build MCP in the MVP unless the user explicitly asks after the web app works.

## 3. Users and access roles

Implement a simple demo identity switcher rather than production account onboarding. It must be obvious the organizations and reports are fictional.

- **Contributor:** create/edit own draft, inspect privacy flags, approve public version, see listing and demo earnings.
- **Buyer:** search public listings, inspect preview, purchase/unlock guide, submit outcome feedback.
- **Reviewer:** inspect submitted drafts and evidence, request changes, approve, reject, set evidence label.
- **Demo operator:** switch among seeded roles, reset seed state, trigger validation scenario.

Enforce access rules in backend functions as well as UI. A hidden field in the browser is not access control. Never return private notes to buyer-facing queries.

## 4. Core user journey

### Contributor flow

1. Open contributor workspace.
2. Create an incident report using a structured form.
3. Use Moss to convert rough notes into a six-part draft playbook (or deterministic fallback if Moss is unavailable).
4. Review source notes beside generated wording; edit and accept sections individually.
5. Run the privacy scan. Review flags and suggested generalizations.
6. Preview the exact buyer-facing version.
7. Approve and submit for human review.
8. See status, reviewer notes, publication status, and demo earnings.

### Reviewer flow

1. Open the review queue.
2. Inspect sanitized content, evidence, public references, privacy scan, and completeness checklist.
3. Mark evidence as one of the allowed levels.
4. Approve, request changes, or reject with a reason.
5. Approved guide becomes searchable only after contributor approval of the final version.

### Buyer flow

1. Search by symptoms or select a seeded scenario.
2. See relevant guides with match reason, evidence label, limitations, source category, and price.
3. Open a free preview.
4. Buy/unlock detailed playbook through x402 test flow or visibly simulated adapter.
5. Read step-by-step defensive guidance and verify checklist.
6. Submit outcome feedback.

### Validation flow

1. Open a guide’s validation panel.
2. Confirm the target is the local demo app and marked authorized.
3. Run the known check before fix.
4. Apply the defensive fix via Factory Droid if truly available; otherwise use the local patch adapter.
5. Re-run tests and show before/after evidence.
6. Mark the evidence as reproduced only if an actual test passed.

## 5. Playbook content model

Every public playbook must use this structure:

1. **Recognize:** observable signs that may indicate a similar problem.
2. **Check:** defensive evidence to collect and safe checks to perform.
3. **Contain:** steps to limit additional harm.
4. **Recover:** corrective and restoration steps.
5. **Verify:** checks to confirm the issue is resolved.
6. **Limitations:** conditions where the guidance may not apply, possible side effects, and uncertainty.

Never publish raw credentials, tokens, private personal data, private customer data, or executable exploit payloads. Do not show a guide as verified unless evidence supports the label.

### Evidence labels

- **Contributor reported:** contributor states the response helped; no independent check claimed.
- **Evidence reviewed:** human reviewer inspected supporting evidence.
- **Test reproduced:** defensive fix passed a safe test against the demo or authorized target.

Display the label and its explanation everywhere a buyer evaluates a guide.

## 6. Screens and required UI behavior

Build a coherent, polished interface with consistent navigation, typography, spacing, accessible labels, and responsive layouts. Prefer a clear operations console aesthetic over a generic chatbot landing page. Use real content in the seeded workflow, not lorem ipsum.

Required routes/screens:

1. **Home:** plain explanation; actions “Share an incident” and “Find a playbook”; trust/privacy summary.
2. **Contributor dashboard:** draft/review/published states and demo earnings.
3. **Incident form:** structured fields, save draft, validation, progress indicator.
4. **Playbook editor:** six sections, Moss draft action, source-note visibility, per-section edits.
5. **Privacy review:** findings, recommended generalizations, buyer preview, explicit contributor approval.
6. **Review queue:** pending reports, evidence, checklist, decision controls, reviewer note.
7. **Buyer search:** natural-language search, filters, match explanations, clear evidence and price labels.
8. **Playbook page:** free preview, locked detail, limitations, evidence provenance, purchase action.
9. **Validation panel:** authorized target label, before/fix/after results, tool attribution, test output summary.
10. **Purchase confirmation:** test/simulated status, amount, contributor share, platform fee.
11. **Feedback form:** relevance and outcome; show saved confirmation.
12. **Demo menu:** switch role/org and reset data; keep clearly separate from production UI.

Every route must have sensible loading, empty, error, and success states. Make private-vs-public boundaries visually obvious. Avoid displaying private notes in buyer routes.

## 7. Sponsor integrations

Build adapters with a shared typed interface and a local fallback. A missing API key must not prevent starting or using the core app.

### Convex — backend and data

Use Convex for persistent records, backend queries/mutations, server-side authorization, and reactive UI updates. Keep sensitive contributor notes separated from public playbook fields. Add seed and reset operations that only affect demo records.

### Moss — playbook drafting and grounded Q&A

Use Moss to structure contributor notes and answer buyer questions using only an approved playbook. Ground answers in exact sections, include references to those sections, and return “not enough information in this playbook” when unsupported. Never send private source notes to buyer Q&A. Provide deterministic fallback text so the flow still works.

### Apify — public source retrieval

Use Apify to run a selected Actor or supported API against a short allowlist of public advisory sources. Store title, URL, source, publication date if available, retrieval time, and brief relevance note. Avoid scraping arbitrary user-submitted URLs. Respect robots, terms, rate limits, and access restrictions. Provide seeded public references as fallback.

### Factory Droid — defensive patch workflow

If a supported SDK or CLI integration is available, use it only against the repository’s local toy app with a strict allowlist: inspect designated files, apply a patch, run named test command. Do not allow arbitrary shell commands, internet targets, credentials, deployment, or production access. If unavailable, use a deterministic local patch action and label it “Local demo adapter,” not “Factory.”

### Armadin — authorized validation

Integrate only if the sponsor provides an event-supported interface and the target can be explicitly restricted to the local toy app. No public target scanning or real customer testing. If unavailable, the local validator performs the known check and the UI must not attribute it to Armadin.

### Coinbase x402 — paid access

Use supported test-mode x402 flow if credentials/network are available. Never initiate a real-money transfer or store wallet secrets. If no test setup is available, implement a simulated payment provider clearly labeled “Demo payment.” Do not imply a simulated payment settled. Unlock playbook details only after the provider returns success or the user explicitly completes the simulator step.

## 8. Data model (adapt to existing Convex conventions)

Suggested tables/documents:

### organizations
- displayName, publicAlias, demoRole, isDemo, createdAt

### incidentDrafts
- contributorOrgId, title, privateNotes, sanitizedSummary, systemCategories, symptoms, detectionClues, attemptedActions, containmentSteps, recoverySteps, verificationSteps, limitations, sharingLevel, privacyFindings, status, createdAt, updatedAt

### playbooks
- incidentDraftId, publicTitle, publicSummary, publicSteps, publicLimitations, evidenceLevel, priceMinorUnits, currency, publishedAt, active, searchText

### publicReferences
- playbookId, title, sourceName, url, publishedAt, retrievedAt, relevanceNote, seeded

### reviews
- playbookId or incidentDraftId, reviewerOrgId, checklist, decision, note, createdAt

### validationRuns
- playbookId, targetName, authorizationStatus, toolName, checkName, beforeResult, patchSummary, afterResult, evidenceLevel, runAt

### purchases
- buyerOrgId, playbookId, amountMinorUnits, currency, provider, paymentStatus, contributorShareMinorUnits, platformShareMinorUnits, transactionReference, createdAt

### outcomeFeedback
- buyerOrgId, playbookId, relevance, outcome, notes, reviewStatus, createdAt

Use IDs and types consistently. Store money as integer minor units. Never put raw secrets in the database. Add indexes for status, active listings, categories, and search fields. Validate all mutation inputs.

## 9. Seeded end-to-end demo

All content must be fictional and clearly labeled.

- **Northstar Cloud:** fictional software provider. After a routine update, its test login service produces repeated authentication failures. Its team finds an unsafe configuration in the toy service, corrects it, and verifies expected behavior.
- **Harbor Analytics:** fictional buyer seeing similar symptoms after a deployment.
- **Playbook title:** “Investigating repeated authentication failures after a deployment.”
- Include sanitized symptoms, categories, defensive checks, containment/recovery, verification, limitations, evidence label, price, and two source-linked public references (or seeded references marked as such).
- **Toy app:** local sample with one harmless incorrect authentication configuration. A test visibly fails before the defensive fix and passes afterward. Explain the check without exposing real attack instructions.

Provide a one-click reset that restores these records and validation state.

## 10. Payment and demo economics

Use a clearly labeled prototype default split of **80% contributor / 20% platform**. This is a demo assumption, not finalized commercial policy. Show price, what unlocks, and split before checkout. Keep free preview and basic urgent safety advice accessible. Test transaction only or simulated payment only; no real funds.

## 11. Technical implementation rules

- First inspect repository files, package scripts, and existing app structure. Follow existing conventions if healthy.
- Do not overwrite useful code blindly. Preserve existing project functionality unless it conflicts with this brief.
- Keep integration logic server-side. Never expose secrets in client bundles or source control.
- Use runtime validation for external responses and mutation inputs.
- Handle timeouts, errors, rate limits, and missing credentials with visible but nonfatal fallback states.
- Add a `.env.example` with placeholders and explain setup in README; do not include actual keys.
- Keep logs free of private notes and sensitive report content.
- Keep all sample data fictional.
- Add a concise README with install, configure, run, seed/reset, and demo instructions.
- Add a `BUILD_STATUS.md` checklist if the task takes multiple sessions; update it at each milestone.
- Do not claim a sponsor integration is real unless exercised successfully. Show an integration badge like “Connected,” “Demo adapter,” or “Unavailable” accurately.

## 12. Build order

Complete each phase before expanding scope.

### Phase 1 — inspect and scaffold
Identify framework, scripts, environment, and existing work. Create checklist. Ensure app starts before large changes.

### Phase 2 — polished product shell
Build navigation, home, demo role switcher, seeded organization data, search, playbook detail, and contributor dashboard.

### Phase 3 — submission, playbook, privacy, review
Add structured form/draft persistence, Moss adapter/fallback, six-part editor, privacy flags/preview/approval, reviewer queue/evidence labels.

### Phase 4 — search, paywall, purchase record
Add symptom search, matching rationale, free preview, locked detail, payment UI, split calculation, and purchase persistence.

### Phase 5 — toy defensive validation
Implement vulnerable demo configuration, reproducible before test, defensive patch, after test, validation record, and accurate tool attribution. Add Factory/Armadin only if safe supported integrations exist.

### Phase 6 — external data and payment integrations
Add Apify allowlisted retrieval and seeded fallback; x402 test provider and simulated fallback; verify Convex persistence and authorization.

### Phase 7 — finish and verify
Run existing checks, add focused checks for critical flows, start the app, exercise the complete demo, fix failures, and verify a reset works. Update README and BUILD_STATUS. Provide final summary with implemented features, exact commands run, integrations connected vs simulated, and any remaining blocker.

## 13. Acceptance criteria

The build is complete only when all are true:

1. The application installs and starts using documented commands.
2. A fresh session can load the home screen and seeded demo.
3. Demo operator can switch between Northstar Cloud contributor, reviewer, and Harbor Analytics buyer and reset data.
4. Contributor can submit an incident and save a draft.
5. Moss drafts the six-part guide, or fallback works and is labeled.
6. Privacy scan flags seeded identifiers and contributor approves the sanitized version.
7. Reviewer can request changes, reject, or approve with evidence label.
8. Apify references load with source links or seeded fallback is clearly identified.
9. Buyer can search symptoms and retrieve the matching playbook with a plain-language match reason.
10. Buyer sees free preview, evidence, limitations, and price before purchase.
11. x402 test flow works if configured; otherwise the simulator is visibly identified and can unlock demo details.
12. Purchase record shows amount and contributor/platform split correctly.
13. Toy validation fails before the defensive fix and passes after; the UI attributes the action truthfully.
14. Buyer can submit feedback and reviewer can view it.
15. Convex persists the core records; access checks prevent buyer access to private contributor notes.
16. No real incident data, credentials, unauthorized target tests, or real-payment claims are present.
17. Main demo can be performed in under three minutes after reset.
18. README contains setup and demo instructions; build status reflects reality.

## 14. Three-minute demo script

1. **Problem (20 sec):** companies repeat incident work because practical response knowledge stays private.
2. **Contributor (35 sec):** submit fictional report; Moss structures it; privacy review catches identifiers; contributor approves.
3. **Trust (30 sec):** reviewer approves with evidence level; show public references and safe validation.
4. **Buyer (40 sec):** switch to Harbor Analytics; search symptoms; inspect why the guide matches and its limits.
5. **Fix and payment (35 sec):** show before/after test, unlock via x402 test or labeled simulation, display revenue split.
6. **Impact (20 sec):** buyer feedback improves the guide for future responders.

## 15. Non-goals

Do not build for the MVP:
- Public raw breach database
- Guaranteed untraceable anonymity
- Automatic publication or AI safety certification
- Arbitrary internet scanning or exploitation
- Real customer production integrations
- Real-money checkout
- Token/points/reputation economy
- Large incident catalog before the single report lifecycle works
- MCP server (unless explicitly requested after the web product is complete)

## 16. Final positioning

Incident Exchange is a private marketplace for practical security lessons. It helps one company turn an incident into a privacy-reviewed response playbook, lets another find it by symptoms, and supports evidence review, safe fix validation, paid access, contributor rewards, and buyer feedback. The product’s core is the trusted loop that turns hard-won defensive experience into useful guidance for the next organization.
