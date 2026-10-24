// Hosted web console on Convex: access-code sessions and static file serving (convex/webHosting.ts).
import { convexTest } from "convex-test";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { api, internal } from "../convex/_generated/api";
import schema from "../convex/schema";
import { verifySession } from "../shared/session.mjs";

const modules = import.meta.glob("../convex/**/*.*s");
const CODE = "test-access-code-0123456789";
const SECRET = "test-demo-session-secret-hosting-000000";

beforeAll(() => {
  process.env.DEMO_ACCESS_CODE = CODE;
  process.env.DEMO_SESSION_SECRET = SECRET;
});
afterAll(() => {
  delete process.env.DEMO_ACCESS_CODE;
  delete process.env.DEMO_SESSION_SECRET;
});

const post = (body: unknown) => ({ method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });

describe("hosted console", () => {
  it("mints signed sessions only for the right access code and known orgs", async () => {
    const t = convexTest(schema, modules);
    await t.mutation(api.demo.reset, { actor: "review-desk" });
    expect((await t.fetch("/session", post({ code: "wrong-code-0000000000000", slugs: ["harbor"] }))).status).toBe(401);
    expect((await t.fetch("/session", post({ slugs: ["harbor"] }))).status).toBe(401);
    const ok = await (await t.fetch("/session", post({ code: CODE, slugs: ["harbor", "not-an-org"] }))).json();
    expect(Object.keys(ok.tokens)).toEqual(["harbor"]);
    expect(await verifySession(SECRET, ok.tokens.harbor)).toBe("harbor");
  });
  it("serves uploaded files with SPA fallback, and API routes still win", async () => {
    const t = convexTest(schema, modules);
    const storageId = await t.run((ctx) => ctx.storage.store(new Blob(["<!doctype html><title>IX</title>"], { type: "text/html" })));
    await t.mutation(internal.webHosting.recordAsset, { path: "/index.html", storageId, contentType: "text/html; charset=utf-8", deployId: "d1" });
    const home = await t.fetch("/");
    expect(home.status).toBe(200);
    expect(home.headers.get("x-frame-options")).toBe("DENY");
    expect(await home.text()).toContain("<title>IX</title>");
    expect(await (await t.fetch("/playbooks/abc")).text()).toContain("<title>IX</title>"); // client-side route
    expect((await t.fetch("/assets/missing.js")).status).toBe(404);
    expect((await t.fetch("/mcp")).status).toBe(405); // exact API route, not the static fallback
  });
});
