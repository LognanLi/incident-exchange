// Web console hosting on Convex: built files live in file storage and are served by an HTTP action at
// https://<deployment>.convex.site/. Public visitors get signed demo sessions only with an access code
// (DEMO_ACCESS_CODE); the local runner mints sessions for localhost development.
import type { HttpRouter } from "convex/server";
import { v } from "convex/values";
import { httpAction, internalMutation, internalQuery } from "./_generated/server";
import { api, internal } from "./_generated/api";
import { mintSession } from "../shared/session.mjs";

export const generateUploadUrl = internalMutation({ args: {}, handler: (ctx) => ctx.storage.generateUploadUrl() });

export const recordAsset = internalMutation({
  args: { path: v.string(), storageId: v.id("_storage"), contentType: v.string(), deployId: v.string() },
  handler: async (ctx, a) => {
    const existing = await ctx.db.query("webAssets").withIndex("by_path", (q) => q.eq("path", a.path)).unique();
    if (existing) {
      if (existing.storageId !== a.storageId) await ctx.storage.delete(existing.storageId);
      await ctx.db.patch(existing._id, a);
    } else await ctx.db.insert("webAssets", a);
  },
});

/** Removes files from earlier deploys (old hashed bundles). */
export const pruneExcept = internalMutation({
  args: { deployId: v.string() },
  handler: async (ctx, { deployId }) => {
    let removed = 0;
    for (const a of await ctx.db.query("webAssets").collect()) {
      if (a.deployId === deployId) continue;
      await ctx.storage.delete(a.storageId);
      await ctx.db.delete(a._id);
      removed++;
    }
    return { removed };
  },
});

export const getAsset = internalQuery({
  args: { path: v.string() },
  handler: (ctx, { path }) => ctx.db.query("webAssets").withIndex("by_path", (q) => q.eq("path", path)).unique(),
});

const SECURITY_HEADERS = { "X-Content-Type-Options": "nosniff", "X-Frame-Options": "DENY", "Referrer-Policy": "strict-origin-when-cross-origin" };

function timingSafeEqual(a: string, b: string) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export function registerWebHosting(http: HttpRouter) {
  // Access-code sessions for the hosted console (same origin, so no CORS headers are sent).
  http.route({
    path: "/session",
    method: "POST",
    handler: httpAction(async (ctx, req) => {
      const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json", "Cache-Control": "no-store", ...SECURITY_HEADERS } });
      const expected = process.env.DEMO_ACCESS_CODE;
      const secret = process.env.DEMO_SESSION_SECRET;
      if (!expected || !secret) return json(503, { error: "Hosted demo access is not configured." });
      const raw = await req.text();
      if (raw.length > 2000) return json(413, { error: "Request too large" });
      let body: { code?: unknown; slugs?: unknown };
      try {
        body = JSON.parse(raw);
      } catch {
        return json(400, { error: "Invalid JSON" });
      }
      if (typeof body.code !== "string" || !timingSafeEqual(body.code, expected)) return json(401, { error: "Wrong access code." });
      if (!Array.isArray(body.slugs) || body.slugs.length > 20) return json(400, { error: "slugs required" });
      const known = new Set((await ctx.runQuery(api.demo.listOrgs, {})).map((o) => o.slug));
      const tokens: Record<string, string> = {};
      for (const slug of body.slugs) if (typeof slug === "string" && known.has(slug)) tokens[slug] = await mintSession(secret, slug);
      return json(200, { tokens });
    }),
  });

  // Static files with single-page-app fallback. Exact API routes (/mcp, /oauth/token, /x402/…) take precedence.
  http.route({
    pathPrefix: "/",
    method: "GET",
    handler: httpAction(async (ctx, req) => {
      const path = new URL(req.url).pathname;
      let asset = await ctx.runQuery(internal.webHosting.getAsset, { path: path === "/" ? "/index.html" : path });
      if (!asset && !/\.[a-z0-9]+$/i.test(path)) asset = await ctx.runQuery(internal.webHosting.getAsset, { path: "/index.html" });
      if (!asset) return new Response("Not found", { status: 404, headers: SECURITY_HEADERS });
      const blob = await ctx.storage.get(asset.storageId);
      if (!blob) return new Response("Not found", { status: 404, headers: SECURITY_HEADERS });
      const immutable = asset.path.startsWith("/assets/");
      return new Response(blob, {
        status: 200,
        headers: { "Content-Type": asset.contentType, "Cache-Control": immutable ? "public, max-age=31536000, immutable" : "no-cache", ...SECURITY_HEADERS },
      });
    }),
  });
}
