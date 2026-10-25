/// <reference types="vite/client" />
// agentsConsole.overview: latest applicability checks, newest first.
import { convexTest } from "convex-test";
import { describe, expect, it } from "vitest";
import { api } from "../convex/_generated/api";
import schema from "../convex/schema";

const modules = import.meta.glob("../convex/**/*.*s");

describe("agentsConsole.overview applicabilityChecks", () => {
  it("is empty when no checks exist", async () => {
    const t = convexTest(schema, modules);
    await t.mutation(api.demo.reset, { actor: "review-desk" });
    const o = await t.query(api.agentsConsole.overview, { actor: "harbor" });
    expect(o.applicabilityChecks).toEqual([]);
  });

  it("returns at most 5 checks, newest first", async () => {
    const t = convexTest(schema, modules);
    await t.mutation(api.demo.reset, { actor: "review-desk" });
    await t.run(async (ctx) => {
      const pb = (await ctx.db.query("playbooks").first())!;
      for (let i = 0; i < 7; i++) {
        await ctx.db.insert("applicabilityChecks", {
          principalName: "agent-b", orgSlug: "harbor", playbookId: pb._id, revision: 1, title: `check ${i}`,
          recommendation: i % 2 ? "decline" : "recommend", reason: "r",
          matched: [{ fact: "runtime.node", label: "Node", expected: true, observed: true, source: "probe: package.json" }],
          conflicts: [], needsVerification: [{ fact: null, label: "free text", expected: null }], at: 1000 + i, isDemo: true,
        });
      }
    });
    const o = await t.query(api.agentsConsole.overview, { actor: "harbor" });
    expect(o.applicabilityChecks.map((c) => c.title)).toEqual(["check 6", "check 5", "check 4", "check 3", "check 2"]);
    expect(o.applicabilityChecks[0].matched[0].source).toBe("probe: package.json");
  });
});
