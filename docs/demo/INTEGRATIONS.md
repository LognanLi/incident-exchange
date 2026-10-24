# Integrations — actual status (verified 2026-10-24)

| Provider | Role in the product | Mode | Package / version | Last verified action | Evidence |
| --- | --- | --- | --- | --- | --- |
| Convex | Source of truth, authorization, reactive UI, HTTP payment endpoint | live (local backend) | convex 1.48 | every e2e run | `npm test` (41) + e2e |
| Moss | **Generation:** Moss Inference drafts the six sections from the contributor's response fields (attributed as Moss Inference, not retrieval). **Retrieval:** grounded Q&A over a guide's own sections — a per-guide Moss index when available, otherwise Moss Inference with only the viewer's allowed sections supplied. | live | @moss-js/moss 1.21.0 + REST `inference.moss.dev` | e2e 03:35 (draft + Q&A with [Verify] citation) | “Drafted by Moss” banner; Q&A engine label |
| Apify | Public reference retrieval from an allowlist (Stripe, GitHub, OWASP, Auth0, RFC Editor) chosen by incident family; 24h cache; excerpt + checksum; failed refresh keeps last good refs (stale) | live | REST `apify~website-content-crawler` (cheerio, 1 GB, 1 retry) | e2e 03:35 (3 refs) | “Retrieved via Apify” badges |
| Factory Droid | Runtime feature: repairs the sample app's code (one file) in an isolated workspace; protected evaluator re-runs separately | live (local runner) | droid 0.249.0 | e2e 03:35, webhook case, baseline FAIL → after PASS | `toy-apps/artifacts/recorded-webhook-factory-run.json` |
| Coinbase x402 | Paid resource request; backend CDP Server Wallet buyer; Base Sepolia test USDC | testnet | @coinbase/cdp-sdk 1.60.0, @x402/* 2.28.0 | e2e 03:35, tx `0x5f6fb278…ba95071` (0.50 USDC) | BaseScan link on receipt |
| Armadin | — | unavailable | — | Discovery 03:37: site behind Cloudflare block, no public docs/API host responded | Not credited anywhere. Needs: event-provided interface docs + confirmation scope can be restricted to `toy-apps/` |

Using Droid to *build* this app is separate from the runtime Factory feature above.

**What is sent externally:** Moss receives the contributor's seven response fields (never private notes, evidence, or identifying terms) and, for Q&A, only sections the viewer may read. Apify receives allowlisted URLs only (no incident text). The x402 facilitator receives the signed payment authorization. Embeddings for Moss indexes are created by Moss's service.

**Missing credentials (names only):** none for the five live integrations. Armadin: no credential name known.
