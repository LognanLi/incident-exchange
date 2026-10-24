# Integrations (verified 2026-10-24 against Convex `quirky-robin-694`)

| Sponsor | Role | Runtime | Mode | Key names | Evidence |
| --- | --- | --- | --- | --- | --- |
| Convex | Records, rights, revisions, ledger, events, reactive console | Convex Cloud dev deployment | live | `CONVEX_DEPLOY_KEY` (local `.env.local`) | all flows above |
| Coinbase x402 | Agent B pays the fixed paid resource for one revision | Convex Node action (`x402Node.agentPay`, CDP Server Wallet, spend controls pinned to quote) | testnet (Base Sepolia) | `CDP_API_KEY_ID`, `CDP_API_KEY_SECRET`, `CDP_WALLET_SECRET` | tx `0x0bbec1ba…db461b` (0.01 USDC) |
| Factory Droid | Agent B's repair agent: adapts the purchased lesson in an isolated workspace | local connector (`droid exec` 0.249.0, Read/LS/ApplyPatch) | live | `FACTORY_API_KEY` (local `.secrets.local`) | run 1 rejected 0/5 (wrong API names); run 2 accepted 5/5 after repo B documented its interface |
| Moss | Grounded Q&A over entitled sections (Moss Inference) | Convex action | live | `MOSS_PROJECT_ID`, `MOSS_PROJECT_KEY` | `engine=moss_context` on cloud. **Local MCP search: Moss semantic retrieval** over the shared `ix-public-previews` index (verified: paraphrase “the same job gets queued two times whenever the sender resends a notification” → webhook guide first, 5–7 ms; nonsense → NO_RELEVANT_MATCH; provenance `moss:ix-public-previews`). Earlier “never ready” cause: the startup refresh ran before Convex finished deploying and its error was swallowed (`.catch(() => undefined)`), plus no step timeouts; now logged, retried after 10 s, with per-step deadlines. **Remote MCP endpoint:** lexical/concept fallback, labeled `fallbackReason` (the Moss index is loaded in the local Node process, not in Convex) |
| Apify | Public references from an allowlist | Convex action | live | `APIFY_TOKEN` | 3 allowlisted refs retrieved on cloud |
| Armadin | — | — | unavailable | — | no public interface found |

Factory building this app (developer tooling) is separate from the runtime repair-agent integration above.
