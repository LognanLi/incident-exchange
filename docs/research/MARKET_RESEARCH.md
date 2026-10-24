# Market Research — Features a Shipped Incident Exchange Needs

_Researched 2026-10-24. Verified live: FIRST TLP page, CISA AIS page, and CISA 2015 reauthorization status. Other entries summarize public documentation of each product. Confirm current terms before relying on them._

## 1. Sharing standards and handling labels
- **Traffic Light Protocol 2.0** (current since Aug 2022). **TLP:RED** is for named recipients only. **AMBER** allows need-to-know sharing within the recipient org and its clients. **AMBER+STRICT** limits sharing to the recipient org only. **GREEN** allows the community but not public channels. **CLEAR** has no limit. Every guide (and every section of one) should carry a label, and the label should drive who can buy it. https://www.first.org/tlp/
- **STIX 2.1 / TAXII 2.1** (OASIS) are the standard JSON schema for threat objects (indicator, attack-pattern, course-of-action, incident, note) and the HTTP API for exchanging them. Exporting guide IOCs and remediation steps as a STIX bundle lets buyers load them into SIEM and TIP tools. https://oasis-open.github.io/cti-documentation/
- **MITRE ATT&CK mapping**: tag guides with technique IDs (e.g. T1078 Valid Accounts, T1486 Data Encrypted for Impact). This gives a shared vocabulary for search and fit scoring, and security buyers expect it. D3FEND covers the defensive countermeasures side. https://attack.mitre.org/ · https://d3fend.mitre.org/
- **VERIS / CVE / CWE**: VERIS is an incident-description schema (used for the Verizon DBIR) and a useful model for structured "what happened" fields. Link CVEs when a vulnerability was the cause. https://verisframework.org/
- **Reliability side**: postmortem conventions (Google SRE blameless postmortem template) and metrics such as time to detect, time to mitigate, and time to resolve. https://sre.google/sre-book/postmortem-culture/

## 2. Existing sharing communities and platforms
- **ISACs/ISAOs** (FS-ISAC, H-ISAC, and others; national council at nationalisacs.org) are member-funded, sector-specific groups that share through TLP-labeled portals, mailing lists, MISP/TAXII feeds, and trusted circles, often with attribution removed. Members pay tiered dues. They are a buyer channel or partner, not just competition. https://www.nationalisacs.org/
- **CISA Automated Indicator Sharing (AIS)** is free and machine-to-machine over STIX/TAXII 2.1. Joining requires terms of use, a PKI cert, and an interconnection agreement. Sharing through AIS in line with CISA 2015 gives liability protection. https://www.cisa.gov/topics/cyber-threats-and-advisories/information-sharing/automated-indicator-sharing-ais
- **MISP** is an open-source threat-sharing platform. Its distribution levels (org, community, connected, all, sharing groups), taxonomies (including TLP), galaxies (ATT&CK), and sync between instances are a good model for scoped distribution. https://www.misp-project.org/
- **Recorded Future / ThreatConnect / Anomali** are commercial threat intel platforms with enterprise subscriptions, analyst-written reports, risk scores, ATT&CK tagging, integrations (SIEM/SOAR), and per-seat or per-module pricing. ThreatConnect has a TAXII server and "communities". https://www.recordedfuture.com/ · https://threatconnect.com/
- **VirusTotal / Intel 471 / Flashpoint** sell tiered, credentialed access to sensitive intel. They vet customers, and some exclude non-vetted buyers entirely, which is the precedent for KYB-gating.

## 3. Bug bounty mechanics (closest analog for a contributor economy)
- **Triage**: HackerOne and Bugcrowd run managed triage. Analysts reproduce, deduplicate, rate severity (CVSS / Bugcrowd VRT), and then pass reports to the customer. Equivalent here: a review queue that checks sanitization, accuracy, and duplicates before listing. https://docs.hackerone.com/ · https://bugcrowd.com/vulnerability-rating-taxonomy
- **Reputation / Signal / Impact**: researchers gain reputation for resolved reports and lose it for N/A or spam. HackerOne's "Signal" is roughly a valid-report ratio. Use this to rank contributors and gate who can publish without pre-review.
- **Duplicate rules**: the first valid submission wins, and duplicates get credit but not pay. This maps to near-duplicate detection on guides (embedding similarity) and "first to publish" credit.
- **Payouts**: platforms pay through PayPal, bank transfer, or crypto, issue tax forms (W-9/W-8BEN, 1099), and screen against sanctions. HackerOne takes a platform fee on top of the bounty.
- **Disclosure policies**: safe-harbor language (e.g. disclose.io) and coordinated disclosure timelines. Equivalent here: a contributor attestation that they have the right to share, plus an employer-consent field. https://disclose.io/

## 4. Data marketplace mechanics
- **Snowflake Marketplace**: listings can be free, personalized (request access), or paid (usage-based or subscription). Listings include sample data, a data dictionary, and a usage example. The provider must approve personalized requests. https://other-docs.snowflake.com/en/collaboration/collaboration-marketplace-about
- **AWS Data Exchange**: products have public or private offers, subscription terms (1/12/36 months), a Data Subscription Agreement (standard DSA template or custom), subscription verification (the provider approves the buyer after seeing company and use case), and billing through AWS. Subscription verification fits our buyer-vetting need almost exactly. https://docs.aws.amazon.com/data-exchange/latest/userguide/subscription-verification-pro.html
- **Datarade**: catalog with free samples, "request quote" pricing, and provider profiles with ratings. Shows that many B2B data deals are negotiated, not checkout. https://datarade.ai/
- **Common patterns:** preview/sample before buying, standard license plus custom terms, approval-gated access, versioned updates for subscribers, provider analytics (views → requests → sales).

## 5. Trust centers (for selling to security buyers)
- **SafeBase / Vanta Trust Center / Drata Trust Center**: public overview, NDA-gated documents (SOC 2 report, pen test), click-through NDA, access request with auto-approve rules (e.g. by domain or Salesforce opportunity stage), and an access log of who viewed what. Reuse this model for gated guide sections: preview is public, full detail requires NDA and approval. https://safebase.io/ · https://www.vanta.com/products/trust-center
- **Our own trust page**: SOC 2 status, data-handling and sanitization policy, sub-processors, and a security contact (security.txt). Buyers will ask for it.

## 6. Enterprise procurement requirements
- **SSO (SAML/OIDC) and SCIM provisioning**: required for most enterprise security teams. WorkOS or Okta make it quick to add. https://workos.com/docs/sso
- **RBAC**: roles such as Buyer, Approver, Contributor, Reviewer, and Admin.
- **Audit logs**: who searched, viewed, unlocked, downloaded, or shared, exportable to SIEM. This is non-negotiable for gated sensitive content.
- **Spend controls**: org budget, per-user limits, approval required above $X (Ramp/Brex pattern), and purchase orders.
- **Invoicing / net-30 and prepaid credits**: enterprises often won't use a card. Stripe Invoicing handles this. https://docs.stripe.com/invoicing
- **Pricing models**: per-guide unlock, seat-based subscription with N unlocks/month, enterprise unlimited, and credit packs. Recorded Future and ISACs show that annual contracts dominate.
- **Security questionnaire / DPA / MSA** templates ready to send.

## 7. Legal and privacy
- **CISA 2015** (6 U.S.C. §1501 et seq.) gives liability protection, an antitrust exemption, and FOIA exemption for sharing "cyber threat indicators" and "defensive measures" for a cybersecurity purpose, after removing personal info not directly related. **Status:** it lapsed on 30 Sep 2025, was restored through 30 Jan 2026, then extended to 30 Sep 2026. A Sept 2026 CRS update reports a short-term extension to 11 Dec 2026, which I haven't confirmed against the enacted text. **Caveat:** the protections cover sharing with the federal government and between non-federal entities. Whether *paid* sharing through a marketplace qualifies is unsettled, so get legal review. https://www.everycrsreport.com/files/2026-09-03_IF12959_e88b818ccb3aca205dcf1ba233b57cd55207205b.html · https://www.insideprivacy.com/cybersecurity-2/cybersecurity-information-sharing-act-of-2015-reauthorized-through-september-2026/
- **GDPR / PII minimization**: incident data often contains IPs, emails, and usernames, which are personal data under GDPR. Recital 49 recognizes network security as a legitimate interest, but data minimization (Art. 5(1)(c)) still applies. Strip or generalize before listing, and keep a DPIA. https://gdpr-info.eu/recitals/no-49/
- **Anonymization limits**: re-identification is easy when details are combined (industry + date + cloud + attacker TTP can identify the victim company). Mitigations: generalize dates to a month or quarter, use industry buckets, use size ranges, add k-anonymity-style checks ("at least 5 companies match this profile"), and use human review. Guidance: the EDPB/WP29 opinion on anonymisation techniques. https://ec.europa.eu/justice/article-29/documentation/opinion-recommendation/files/2014/wp216_en.pdf
- **Breach-notification and contractual confidentiality**: contributors may be bound by NDAs, cyber-insurer instructions, or legal privilege (incident reports prepared through counsel). Require attestation and an "employer approval" upload.
- **SEC cyber disclosure rules** (8-K Item 1.05) make public companies cautious about what's said about material incidents. Sanitization review reduces this risk. https://www.sec.gov/newsroom/press-releases/2023-139
- **Export controls and sanctions**: screen buyers and contributors against OFAC SDN and other lists. Intrusion-software and cyber items may fall under EAR controls (the 2022 BIS cybersecurity rule, with its License Exception ACE). Defensive guides are generally low-risk, but exploit details are not. https://ofac.treasury.gov/ · https://www.bis.gov/
- **KYB of buyers**: verify a legal entity and corporate domain (via Stripe Identity, Middesk, or Persona) before allowing AMBER/RED purchases.

## 8. Payouts
- **Stripe Connect (Express accounts)**: handles contributor onboarding, KYC, and tax forms (1099). Use "separate charges and transfers" or destination charges with `application_fee_amount` to take the 20% fee. Funds can be held (manual payouts or delayed transfer) to create a refund window that works like escrow. Note that Stripe isn't a licensed escrow agent, so call it a "payout hold". https://docs.stripe.com/connect/separate-charges-and-transfers · https://docs.stripe.com/connect/marketplace
- **Payouts to employers vs. individuals**: many contributors can't take personal income for work-product IP. Support payouts to the company and donation to charity (a HackerOne option).

## 9. Anti-abuse
- **Keep attackers from buying playbooks**: KYB, a corporate email domain, sanctions screening, TLP-based gating, manual approval for AMBER and above, rate limits on previews, and watermarked PDFs with buyer ID to deter leaks.
- **Fraud and duplicate submissions**: embedding-similarity dedupe, plagiarism checks against public postmortems, contributor reputation, a reviewer sign-off checklist, and payout holds until the refund window closes.
- **Review manipulation**: only verified purchasers can rate, and anomaly checks look for clusters of ratings coming from the same organization.
- **Content safety**: block live secrets, keys, and IPs with secret scanning (e.g. gitleaks-style regex plus entropy checks) and PII detection (Microsoft Presidio) before a human reviews. https://microsoft.github.io/presidio/

---

## Top 12 features to add to the demo (prioritized)

| # | Feature | Why customers care | Demo-able in a day? | How to show it honestly |
|---|---|---|---|---|
| 1 | **TLP 2.0 labels on every guide and section**, with gating by label | It's the industry's shared handling vocabulary, and buyers trust that it's respected | Yes | Colored TLP chip. Show AMBER+STRICT/RED as "Requires verified org + approval". Mock the gate and label it as mocked. |
| 2 | **Automated sanitization scan** (PII, IPs, secrets) before review | Contributors fear leaking customer data, and buyers fear liability | Yes | Run regex and entropy checks client- or server-side on the submit form. Highlight hits and show a redaction diff. Say "regex demo; production adds Presidio + human review". |
| 3 | **MITRE ATT&CK technique tags + search filter** | Shared vocabulary makes fit scoring meaningful to security teams | Yes | A static list of about 30 techniques with real IDs that link to attack.mitre.org. |
| 4 | **Fit/mismatch explanation in plain language** | Non-technical buyers need to know whether a guide applies before paying | Yes | Rule-based comparison of the buyer's environment profile with the guide's metadata. Show the inputs that drove the score. |
| 5 | **Preview vs. unlock** (sample sections, blurred rest) | The standard data-marketplace pattern, which reduces purchase risk | Yes | Show the summary, timeline headings, and evidence list. Blur the steps. Run a Stripe test-mode checkout or a clearly labeled mock. |
| 6 | **Reviewer verification badge + review checklist** | Like bug-bounty triage, it shows quality and safety are vetted | Yes | Badge plus a hover popover listing what was checked and by which role. Use seeded data and don't claim real reviewers. |
| 7 | **Buyer verification (KYB) + approval for sensitive guides** | Keeps attackers from buying response playbooks | Partial | Corporate-domain email check plus an "Verification pending" state. Explain that Stripe Identity or Middesk would be used in production. |
| 8 | **Org audit log** (searched, viewed, unlocked, downloaded) | Procurement and security teams require it | Yes | Log real demo events to local storage or the DB and show them as a filterable table. |
| 9 | **Contributor earnings with 80/20 split and payout hold** | Makes the contributor economy concrete and believable | Yes | Earnings page with pending (7-day hold) vs. available. Note "Stripe Connect Express in production". Use test-mode numbers. |
| 10 | **Spend controls/approvals** (unlocks over $X need manager approval) | Enterprise buyers can't let any analyst spend freely | Yes | Org setting for the threshold, then an "Approval requested" toast and an approver queue. All of it can run locally. |
| 11 | **STIX 2.1 export of IOCs and remediation** | Buyers want to load content into their SIEM/TIP tools, not copy-paste | Yes | Generate a valid STIX bundle JSON (indicator + course-of-action objects) for download. Validate it against the OASIS examples. |
| 12 | **Watermarked downloads + re-share policy** | Deters leaks of paid, sensitive content and enforces TLP | Partial | Overlay the buyer org and timestamp on the rendered guide or PDF. Call it a deterrent, not DRM. |

**Later (not for the demo):** SSO/SCIM, invoicing/net-30, seat subscriptions, sanctions screening, near-duplicate detection with embeddings, ISAC partnerships, TAXII server.
