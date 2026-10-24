// Signed demo sessions: the backend must not trust a bare org slug.
import { convexTest } from "convex-test";
import { afterEach, describe, expect, it } from "vitest";
import { api } from "../convex/_generated/api";
import schema from "../convex/schema";
import { mintSession, verifySession } from "../shared/session.mjs";

const modules = import.meta.glob("../convex/**/*.*s");
const SECRET = "test-demo-session-secret-0000000000000000";

afterEach(() => {
  process.env.DEMO_OPEN_IDENTITY = "on";
  delete process.env.DEMO_SESSION_SECRET;
});

describe("signed demo sessions", () => {
  it("verifies authentic tokens and rejects forged, tampered or expired ones", async () => {
    const tok = await mintSession(SECRET, "harbor");
    expect(await verifySession(SECRET, tok)).toBe("harbor");
    expect(await verifySession("other-secret", tok)).toBeNull();
    expect(await verifySession(SECRET, tok.replace("harbor", "review-desk"))).toBeNull();
    expect(await verifySession(SECRET, await mintSession(SECRET, "harbor", -1000))).toBeNull();
    expect(await verifySession(SECRET, "harbor")).toBeNull();
  });
  it("with open identity off, slugs are refused and only runner-minted sessions work", async () => {
    const t = convexTest(schema, modules);
    await t.mutation(api.demo.reset, { actor: "review-desk" }); // bootstrap on an empty deployment
    process.env.DEMO_OPEN_IDENTITY = "off";
    process.env.DEMO_SESSION_SECRET = SECRET;
    await expect(t.query(api.business.auditLog, { actor: "review-desk" })).rejects.toThrow(/session/i);
    await expect(t.mutation(api.demo.reset, { actor: "review-desk" })).rejects.toThrow(/session/i);
    await expect(t.query(api.agentsConsole.overview, { actor: "harbor" })).rejects.toThrow(/session/i);
    const reviewer = await mintSession(SECRET, "review-desk");
    expect(Array.isArray(await t.query(api.business.auditLog, { actor: reviewer }))).toBe(true);
    const forged = await mintSession("attacker-guess", "review-desk");
    await expect(t.query(api.business.auditLog, { actor: forged })).rejects.toThrow(/session/i);
  });
  it("viewer sessions (hosted access code) cannot reset or start agent runs; operator sessions can", async () => {
    const t = convexTest(schema, modules);
    await t.mutation(api.demo.reset, { actor: "review-desk" });
    process.env.DEMO_OPEN_IDENTITY = "off";
    process.env.DEMO_SESSION_SECRET = SECRET;
    const viewer = await mintSession(SECRET, "review-desk", undefined, "viewer");
    const operator = await mintSession(SECRET, "review-desk", undefined, "operator");
    expect(Array.isArray(await t.query(api.business.auditLog, { actor: viewer }))).toBe(true); // normal demo use works
    await expect(t.mutation(api.demo.reset, { actor: viewer })).rejects.toThrow(/operator/i);
    await expect(t.query(api.agentsConsole.canRunDemo, { actor: viewer })).rejects.toThrow(/operator/i);
    expect((await t.query(api.agentsConsole.canRunDemo, { actor: operator })).ok).toBe(true);
    await t.mutation(api.demo.reset, { actor: operator });
    // The kind is signed: flipping v→o invalidates the token.
    expect(await verifySession(SECRET, viewer.replace(".v.", ".o."))).toBeNull();
  });
});
