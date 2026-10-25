# Sponsor integration evidence

Use the dated [submission audit](agent-sprint/SUBMISSION_AUDIT.md) and [integration notes](agent-sprint/INTEGRATIONS.md). Earlier morning “connected” claims and old transaction examples are not proof of the current database or process state.

| Sponsor | Actual integration | Submission status |
| --- | --- | --- |
| Convex | Cloud dev backend, database, files, hosted console, remote MCP/OAuth and crons | Live on `quirky-robin-694`; no production deployment. |
| Moss | Public-preview semantic retrieval; drafting and grounded Q&A adapters | Semantic retrieval verified with real MCP requests. Drafting/Q&A are implemented but not freshly exercised by this audit. Failures use labeled fallbacks. |
| Factory Droid | Local restricted repair agent and reviewer patch adapter | Real agent invocation evidence lives in agent events and protected-runner records. The sponsor panel also records completed live agent invocations; a proposed patch is not yet a verified repair. |
| Coinbase CDP / x402 | Backend signer, fixed quote terms and spend controls, Base Sepolia settlement | Two current 0.01 test-USDC scenario receipts; contributor 80/20 accrual is application accounting, not payout or an on-chain split. |
| Apify | Allowlisted public-reference crawler from a Convex action | Configured; no current-database successful invocation. Historical three-reference crawl was not repeated because it consumes crawl credits. |
| Armadin | No connected interface | Unavailable. Local toy validation is not an Armadin integration. |

Credential **names**: `MOSS_PROJECT_ID`, `MOSS_PROJECT_KEY`, `APIFY_TOKEN`, `FACTORY_API_KEY`, `FACTORY_RUNNER_SECRET`, `CDP_API_KEY_ID`, `CDP_API_KEY_SECRET`, `CDP_WALLET_SECRET`. Values belong only in the existing gitignored files / Convex env, never this document or chat. Do not rotate or run wallet setup as a submission check.

The latest recorded successful invocation may precede the current session. Check actual calls, timestamps, receipts and process health; do not infer availability from a configured key or sponsor logo. No new paid transaction or crawl is needed to prove existing evidence.
