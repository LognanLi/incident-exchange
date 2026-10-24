import type { MutationCtx } from "../_generated/server";

export type IntegrationName = "convex" | "moss" | "apify" | "factory" | "armadin" | "x402";

export async function recordIntegrationEvent(
  ctx: MutationCtx,
  integration: IntegrationName,
  outcome: "success" | "failure" | "fallback",
  message: string,
) {
  // Messages must never contain private notes or report content.
  await ctx.db.insert("integrationEvents", { integration, outcome, message: message.slice(0, 300), at: Date.now() });
}
