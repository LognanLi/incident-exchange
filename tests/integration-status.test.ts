/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { afterEach, beforeEach, expect, it } from "vitest";
import { api } from "../convex/_generated/api";
import schema from "../convex/schema";

const modules = import.meta.glob("../convex/**/*.*s");
const secret = "submission-audit-runner-fixture";
beforeEach(() => { process.env.FACTORY_RUNNER_SECRET = secret; });
afterEach(() => { delete process.env.FACTORY_RUNNER_SECRET; });

it("counts completed real agent repairs, not pending or simulated events, as Factory connection evidence", async () => {
  const t = convexTest(schema, modules);
  const event = { runnerSecret: secret, lane: "consumer" as const, actor: "agent-b", summary: "Fixed fixture invocation result.", mode: "live", status: "pending" as const };
  const factory = async () => (await t.query(api.integrations.status, {})).find(x => x.key === "factory")!;
  await t.mutation(api.mcp.logConnectorEvent, { ...event, kind: "factory_repair_started" });
  expect((await factory()).state).toBe("configured");
  await t.mutation(api.mcp.logConnectorEvent, { ...event, kind: "factory_repair_finished", mode: "simulated", status: "ok" });
  expect((await factory()).state).toBe("configured");
  await t.mutation(api.mcp.logConnectorEvent, { ...event, kind: "factory_repair_finished", status: "ok" });
  expect(await factory()).toMatchObject({ state: "connected", detail: expect.stringContaining("independent protected tests") });
});

it("reports a later real Factory failure or local unavailability without hiding it behind an earlier success", async () => {
  const t = convexTest(schema, modules);
  const event = { runnerSecret: secret, lane: "consumer" as const, actor: "agent-b", summary: "Fixed fixture invocation result.", mode: "live", kind: "factory_repair_finished" };
  await t.mutation(api.mcp.logConnectorEvent, { ...event, status: "ok" });
  await t.mutation(api.mcp.logConnectorEvent, { ...event, status: "error" });
  expect((await t.query(api.integrations.status, {})).find(x => x.key === "factory")?.state).toBe("error");
  await t.mutation(api.mcp.logConnectorEvent, { ...event, kind: "factory_unavailable", mode: "unavailable", status: "error" });
  expect((await t.query(api.integrations.status, {})).find(x => x.key === "factory")?.detail).toContain("no repair was executed");
});
