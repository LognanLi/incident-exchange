import { test } from "node:test";
import assert from "node:assert/strict";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnCandidate } from "../../harness/remote.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const candidateDir = resolve(here, process.env.CANDIDATE_DIR ?? "../src");

// The candidate runs in a separate, permission-restricted process; the exports
// table and the response log below live only in this (trusted) process.
function startRoutes(t, ctx) {
  const remote = spawnCandidate({
    candidateDir,
    candidateFile: join(candidateDir, "routes", "exports.mjs"),
    factory: "mountExportRoutes",
    argStyle: "object",
    deps: { exportsTable: ctx.exportsTable, http: ctx.http },
  });
  t.after(() => remote.close());
  // Handlers answer through http.reply(); collect the single reply for each request.
  const send = async (method, req) => {
    await remote.call(method, req);
    const mine = ctx.replies.filter((r) => r.requestId === req.requestId);
    assert.equal(mine.length, 1, `expected exactly one reply for ${req.requestId}, got ${mine.length}`);
    return { status: mine[0].status, body: mine[0].body };
  };
  return {
    download: (req) => send("downloadExport", req),
    remove: (req) => send("deleteExport", req),
  };
}

function makeCtx() {
  const rows = new Map([
    ["exp_a1", { exportId: "exp_a1", workspaceId: "ws_northwind", title: "Q3 churn by region", format: "csv", content: "region,churn\nwest,0.031\n" }],
    ["exp_b7", { exportId: "exp_b7", workspaceId: "ws_initech", title: "Payroll variance FY26", format: "csv", content: "dept,variance\nTPS,48211\n" }],
  ]);
  const replies = [];
  const removed = [];
  return {
    rows,
    replies,
    removed,
    exportsTable: {
      async select(where) {
        await Promise.resolve();
        const r = where && typeof where.exportId === "string" ? rows.get(where.exportId) : undefined;
        return r ? [{ ...r }] : [];
      },
      async remove(exportId) {
        await Promise.resolve();
        removed.push(exportId);
        return rows.delete(exportId) ? 1 : 0;
      },
    },
    http: {
      async reply(requestId, status, body) {
        replies.push({ requestId, status, body: body ?? null });
      },
    },
  };
}

let seq = 0;
const req = (workspaceId, exportId) => ({
  requestId: `req_${++seq}`,
  auth: { userId: workspaceId === "ws_northwind" ? "u_nora" : "u_ivan", workspaceId },
  params: exportId === undefined ? {} : { exportId },
});
const leaks = (value) => /Payroll variance|TPS,48211|ws_initech/.test(JSON.stringify(value ?? null));

test("workspace member downloads their own workspace's export", async (t) => {
  const ctx = makeCtx();
  const r = startRoutes(t, ctx);
  const res = await r.download(req("ws_northwind", "exp_a1"));
  assert.equal(res.status, 200);
  assert.equal(res.body?.exportId, "exp_a1");
  assert.equal(res.body?.title, "Q3 churn by region");
  assert.equal(res.body?.content, "region,churn\nwest,0.031\n");
});

test("another workspace's export cannot be downloaded and nothing about it is returned", async (t) => {
  const ctx = makeCtx();
  const r = startRoutes(t, ctx);
  const res = await r.download(req("ws_northwind", "exp_b7"));
  assert.equal(res.status, 404);
  assert.equal(leaks(res), false, "response must not contain another workspace's export data");
});

test("another workspace's export id answers exactly like an unknown id", async (t) => {
  const ctx = makeCtx();
  const r = startRoutes(t, ctx);
  const foreign = await r.download(req("ws_northwind", "exp_b7"));
  const unknown = await r.download(req("ws_northwind", "exp_zz"));
  assert.equal(unknown.status, 404);
  assert.deepEqual(foreign, unknown);
});

test("deleting another workspace's export is refused and the export survives", async (t) => {
  const ctx = makeCtx();
  const r = startRoutes(t, ctx);
  const res = await r.remove(req("ws_northwind", "exp_b7"));
  assert.equal(res.status, 404);
  assert.deepEqual(ctx.removed, [], "a denied attempt must not delete anything");
  assert.ok(ctx.rows.has("exp_b7"));
  const owner = await r.download(req("ws_initech", "exp_b7"));
  assert.equal(owner.status, 200);
  assert.equal(owner.body?.title, "Payroll variance FY26");
});

test("workspace member can delete their own export", async (t) => {
  const ctx = makeCtx();
  const r = startRoutes(t, ctx);
  const res = await r.remove(req("ws_initech", "exp_b7"));
  assert.equal(res.status, 204);
  assert.equal(ctx.rows.has("exp_b7"), false);
  assert.ok(ctx.rows.has("exp_a1"));
});

test("a request without an export id gets 404 and changes nothing", async (t) => {
  const ctx = makeCtx();
  const r = startRoutes(t, ctx);
  const get = await r.download(req("ws_northwind", undefined));
  const del = await r.remove(req("ws_northwind", undefined));
  assert.equal(get.status, 404);
  assert.equal(del.status, 404);
  assert.deepEqual(ctx.removed, []);
  assert.equal(ctx.rows.size, 2);
});
