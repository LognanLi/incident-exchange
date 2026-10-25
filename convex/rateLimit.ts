// Fixed-window rate limits for the remote MCP endpoint and the OAuth token endpoint, matching the local
// MCP service (mcp/server.mjs). Keys are bounded: one per principal plus one shared failure bucket, so
// unknown credentials cannot grow the table.
import { v } from "convex/values";
import { internalMutation, internalQuery, type MutationCtx } from "./_generated/server";

export type Limit = { max: number; windowMs: number };
export const LIMITS = {
  /** Authenticated remote MCP requests per principal. */
  mcp: { max: 120, windowMs: 60_000 },
  /** Access tokens issued per client. */
  token: { max: 20, windowMs: 60_000 },
  /** Failed authentications (bad client secret or bearer token) across all callers. */
  authFailures: { max: 30, windowMs: 60_000 },
} satisfies Record<string, Limit>;
export const AUTH_FAILURE_KEY = "auth-failures";

/** Counts one hit against `key`. Returns the seconds to wait when the window is already full. */
export async function consume(ctx: MutationCtx, key: string, { max, windowMs }: Limit): Promise<{ ok: true } | { ok: false; retryAfter: number }> {
  const now = Date.now();
  const row = await ctx.db.query("rateLimits").withIndex("by_key", (q) => q.eq("key", key)).unique();
  if (!row) {
    await ctx.db.insert("rateLimits", { key, windowStart: now, count: 1 });
    return { ok: true };
  }
  if (now - row.windowStart >= windowMs) {
    await ctx.db.patch(row._id, { windowStart: now, count: 1 });
    return { ok: true };
  }
  if (row.count >= max) return { ok: false, retryAfter: Math.max(1, Math.ceil((row.windowStart + windowMs - now) / 1000)) };
  await ctx.db.patch(row._id, { count: row.count + 1 });
  return { ok: true };
}

export const hit = internalMutation({
  args: { key: v.string(), limit: v.union(v.literal("mcp"), v.literal("token"), v.literal("authFailures")) },
  handler: (ctx, { key, limit }) => consume(ctx, key, LIMITS[limit]),
});

/** Seconds to wait if failed authentications have filled the current window, else null. */
export const authFailureBlock = internalQuery({
  args: {},
  handler: async (ctx) => {
    const { max, windowMs } = LIMITS.authFailures;
    const row = await ctx.db.query("rateLimits").withIndex("by_key", (q) => q.eq("key", AUTH_FAILURE_KEY)).unique();
    const now = Date.now();
    if (!row || now - row.windowStart >= windowMs || row.count < max) return null;
    return Math.max(1, Math.ceil((row.windowStart + windowMs - now) / 1000));
  },
});
