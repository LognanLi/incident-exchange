# Main demonstration

Follow [PRESENTING.md](PRESENTING.md) for the existing presenter startup. This guide does not provision credentials or wallets and never resets shared data.

1. Start `npm run dev:factory`, `npm run dev:mcp`, `npm run dev:frontend` in separate terminals. Open `http://localhost:5173/agents`, or the hosted `/agents#presenter` on the same machine and allow local network access if requested.
2. Confirm **Live**, a healthy local runner, and a current **Last run** timestamp. **Run demo** works from any demo role. A hosted access-code viewer must choose **Enable presenter mode** and connect to their local runner before this control appears.
3. Choose **Duplicate deliveries**. A’s protected tests go 3/5 → 5/5; the local gate drops a synthetic credential line and generalizes identifiers; exact-hash approval submits/reuses the guide. B starts 2/5, finds it over MCP through Moss, checks four applicability conditions, reuses its existing entitlement, and has Factory adapt it. Separate protected tests must pass 5/5 before `runner_verified`.
4. Inspect an event, the earlier Base Sepolia receipt and exact 80/20 **accrual**, then repair evidence. Rehearsal uses the earlier purchase: do not describe it as a new payment.
5. Optional **Cross-tenant access**: repo-c A 2/5 → 5/5; repo-d B 3/6 → 6/6; five fit conditions; existing entitlement reused. Owner operations remain allowed; cross-workspace read/delete and existence leaks are denied.
6. Show **Connect your agent** for real MCP onboarding. The web access code and agent credentials are different.

**Fallback:** Agents → **Recorded run** → Replay. The current capture is a real 28-second tenant scenario from 2026-10-24 21:33 PDT, labeled “Recording — not live.” It executes nothing, spends nothing and excludes local patches/notes. Do not refresh it just to change a timestamp or commit label.

**Recovery:** a blocked hosted browser can use localhost; an unavailable Factory step is shown as unavailable, not a fake repair. Inspect pending payment status before retrying; use the same request ID. Missing CDP does not silently select a simulator for agents. The explicit simulator is allowed only by operator policy; an existing testnet entitlement may still be reused.

Never use Reset or `npm run e2e` on the shared cloud. Security checks use authorized synthetic fixtures; screenshots and recordings must distinguish live, recorded, testnet and simulated evidence.
