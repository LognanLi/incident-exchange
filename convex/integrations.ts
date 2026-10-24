import { query } from "./_generated/server";
import type { QueryCtx } from "./_generated/server";
import { cdpCredentialsPresent } from "./lib/x402";

export type IntegrationState = "connected" | "configured" | "demo" | "unavailable" | "error";

async function lastEvent(ctx: QueryCtx, integration: string) {
  return await ctx.db
    .query("integrationEvents")
    .withIndex("by_integration", (q) => q.eq("integration", integration))
    .order("desc")
    .first();
}

/** Most recent success/failure, ignoring "fallback" events (fallback use says nothing about the integration). */
async function lastRealEvent(ctx: QueryCtx, integration: string) {
  const events = await ctx.db
    .query("integrationEvents")
    .withIndex("by_integration", (q) => q.eq("integration", integration))
    .order("desc")
    .take(50);
  return events.find((e) => e.outcome !== "fallback");
}

/**
 * Honest integration status. "connected" is only reported after a real successful call.
 */
export const status = query({
  args: {},
  handler: async (ctx) => {
    const apifyEvent = await lastEvent(ctx, "apify");
    const apifyState: IntegrationState = !process.env.APIFY_TOKEN
      ? "demo"
      : apifyEvent?.outcome === "success"
        ? "connected"
        : apifyEvent?.outcome === "failure"
          ? "error"
          : "configured";

    const x402Configured = cdpCredentialsPresent();
    const x402Wallets = !!(await ctx.db.query("x402Wallets").withIndex("by_role", (q) => q.eq("role", "receiver")).unique());
    const x402Last = await lastRealEvent(ctx, "x402");
    const x402State: IntegrationState = !x402Configured
      ? "demo"
      : !x402Wallets
        ? "configured"
        : x402Last?.outcome === "success" && x402Last.message.startsWith("x402 test payment settled")
          ? "connected"
          : x402Last?.outcome === "failure"
            ? "error"
            : "configured";

    const factoryConfigured = !!process.env.FACTORY_RUNNER_SECRET;
    const factoryRealEvent = await lastRealEvent(ctx, "factory");
    const factoryState: IntegrationState = !factoryConfigured
      ? "unavailable"
      : factoryRealEvent?.outcome === "success"
        ? "connected"
        : factoryRealEvent?.outcome === "failure"
          ? "error"
          : "configured";

    const mossConfigured = !!(process.env.MOSS_PROJECT_ID && process.env.MOSS_PROJECT_KEY);
    const mossLast = await lastRealEvent(ctx, "moss");
    const mossState: IntegrationState = !mossConfigured
      ? "demo"
      : mossLast?.outcome === "success"
        ? "connected"
        : mossLast?.outcome === "failure"
          ? "error"
          : "configured";

    return [
      { key: "convex", name: "Convex", role: "Backend, database, access checks", state: "connected" as IntegrationState, detail: "This page is reading live data from Convex." },
      {
        key: "moss",
        name: "Moss",
        role: "Playbook drafting & grounded Q&A",
        state: mossState,
        detail: !mossConfigured
          ? "MOSS_PROJECT_ID/KEY not set — deterministic fallback drafts sections and answers only from approved sections."
          : mossState === "configured"
            ? "Credentials set; not yet verified by a successful call."
            : (mossLast?.message ?? ""),
      },
      {
        key: "apify",
        name: "Apify",
        role: "Public reference retrieval",
        state: apifyState,
        detail:
          apifyState === "demo"
            ? "APIFY_TOKEN not set — seeded references are used and marked as such."
            : apifyState === "configured"
              ? "Token set; not yet verified by a successful run."
              : (apifyEvent?.message ?? ""),
      },
      {
        key: "factory",
        name: "Factory Droid",
        role: "Defensive patch workflow",
        state: factoryState,
        detail: !factoryConfigured
          ? "FACTORY_RUNNER_SECRET not set — patches are applied by the “Local demo adapter”."
          : factoryState === "configured"
            ? "Runner configured; not yet verified by a successful patch. Requires the local runner (npm run dev)."
            : (factoryRealEvent?.message ?? ""),
      },
      { key: "armadin", name: "Armadin", role: "Authorized validation", state: "unavailable" as IntegrationState, detail: "Not connected — the local validator runs the known check against the toy target." },
      {
        key: "x402",
        name: "Coinbase x402",
        role: "Paid access (Base Sepolia test USDC)",
        state: x402State,
        detail: !x402Configured
          ? "CDP credentials not set — purchases use the “Demo payment” simulator. No funds move."
          : !x402Wallets
            ? "CDP credentials set; run `npm run x402:setup` to create and fund the wallets."
            : x402State === "configured"
              ? "Wallets ready; not yet verified by a settled test payment."
              : (x402Last?.message ?? ""),
      },
    ];
  },
});
