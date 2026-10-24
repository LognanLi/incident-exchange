import { query } from "./_generated/server";
import type { QueryCtx } from "./_generated/server";

export type IntegrationState = "connected" | "configured" | "demo" | "unavailable" | "error";

async function lastEvent(ctx: QueryCtx, integration: string) {
  return await ctx.db
    .query("integrationEvents")
    .withIndex("by_integration", (q) => q.eq("integration", integration))
    .order("desc")
    .first();
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

    return [
      { key: "convex", name: "Convex", role: "Backend, database, access checks", state: "connected" as IntegrationState, detail: "This page is reading live data from Convex." },
      { key: "moss", name: "Moss", role: "Playbook drafting & grounded Q&A", state: "demo" as IntegrationState, detail: "Moss adapter not wired yet — deterministic fallback drafts sections and answers questions from approved sections only." },
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
      { key: "factory", name: "Factory Droid", role: "Defensive patch workflow", state: "unavailable" as IntegrationState, detail: "Not connected — patches are applied by the “Local demo adapter”." },
      { key: "armadin", name: "Armadin", role: "Authorized validation", state: "unavailable" as IntegrationState, detail: "Not connected — the local validator runs the known check against the toy target." },
      { key: "x402", name: "Coinbase x402", role: "Paid access", state: "demo" as IntegrationState, detail: "No x402 test setup — purchases use the “Demo payment” simulator. No funds move." },
    ];
  },
});
