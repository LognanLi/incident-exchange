// @vitest-environment node
// Tamper evidence for the tenant-authorization scenarios (repo-c invoice-api, repo-d report-exports).
// Test-only: fixtures, pinned suite hashes, and published guides are untouched.
import { describe, expect, it } from "vitest";
import { cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
// @ts-expect-error plain JS modules
import { enforceCandidate, snapshot } from "../connector/lib/policy.mjs";
// @ts-expect-error plain JS modules
import { computeSuiteHash, loadManifest, runProtectedTests } from "../sample-repos/run-protected-tests.mjs";
// @ts-expect-error plain JS modules
import { createInvoiceService as referenceInvoiceService } from "../sample-repos/repo-c/reference-fix/invoices.mjs";

const ROOT = resolve(__dirname, "..");
const SAMPLES = join(ROOT, "sample-repos");
const SCENARIOS = {
  "repo-c": { editable: "src/invoices.mjs", fixed: ["src/invoices.mjs"], test: "protected-tests/invoices.test.mjs" },
  "repo-d": { editable: "src/routes/exports.mjs", fixed: ["src/routes/exports.mjs", "src/ports.mjs", "src/lib/http.mjs"], test: "protected-tests/exports.test.mjs" },
} as const;
type Repo = keyof typeof SCENARIOS;
const REPOS = Object.keys(SCENARIOS) as Repo[];

function workspace(repo: Repo) {
  const ws = mkdtempSync(join(tmpdir(), `ix-${repo}-`));
  cpSync(join(SAMPLES, repo, "src"), join(ws, "src"), { recursive: true });
  return { ws, before: snapshot(ws) as Map<string, string> };
}

function codeOf(fn: () => unknown): string | undefined {
  try {
    fn();
  } catch (e) {
    return (e as { code?: string }).code;
  }
  return undefined;
}

function append(ws: string, rel: string, text: string) {
  writeFileSync(join(ws, rel), readFileSync(join(ws, rel), "utf8") + text);
}

describe.each(REPOS)("%s candidate workspace", (repo) => {
  const { editable, fixed } = SCENARIOS[repo];

  it("contains exactly the source files and no test material", () => {
    const { before } = workspace(repo);
    expect([...before.keys()].sort()).toEqual([...fixed].sort());
    for (const f of before.keys()) expect(f).not.toMatch(/protected-tests|\.test\.m?js$|reference-fix/);
  });

  it("matches the manifest's editable allowlist", () => {
    expect(loadManifest()[repo].editable).toEqual([editable]);
  });

  it("accepts a change to the editable file", () => {
    const { ws, before } = workspace(repo);
    append(ws, editable, "\n// candidate change\n");
    expect(enforceCandidate({ workspace: ws, before, editable: [editable] })).toEqual([editable]);
  });

  it("rejects an added test file, even next to the editable file", () => {
    const { ws, before } = workspace(repo);
    writeFileSync(join(ws, editable.replace(/\.mjs$/, ".test.mjs")), "import { test } from 'node:test'; test('passes', () => {});");
    expect(codeOf(() => enforceCandidate({ workspace: ws, before, editable: [editable] }))).toBe("file_set_changed");
  });

  it("rejects a deleted file", () => {
    const { ws, before } = workspace(repo);
    const victim = join(ws, "src", "gone.mjs");
    writeFileSync(victim, "");
    const withExtra = snapshot(ws) as Map<string, string>;
    expect(withExtra.size).toBe(before.size + 1);
    rmSync(victim);
    expect(codeOf(() => enforceCandidate({ workspace: ws, before: withExtra, editable: [editable] }))).toBe("file_set_changed");
  });

  it("rejects a symlink planted in the workspace", () => {
    const { ws, before } = workspace(repo);
    symlinkSync(join(SAMPLES, repo, SCENARIOS[repo].test), join(ws, "src", "linked.mjs"));
    expect(codeOf(() => enforceCandidate({ workspace: ws, before, editable: [editable] }))).toBe("symlink_denied");
  });

  it("rejects a fix that adds a new import or process access", () => {
    let w = workspace(repo);
    writeFileSync(join(w.ws, editable), 'import { readFileSync } from "node:fs";\n' + readFileSync(join(w.ws, editable), "utf8"));
    expect(codeOf(() => enforceCandidate({ workspace: w.ws, before: w.before, editable: [editable] }))).toBe("new_import");
    w = workspace(repo);
    append(w.ws, editable, "\nexport const leak = process.env;\n");
    expect(codeOf(() => enforceCandidate({ workspace: w.ws, before: w.before, editable: [editable] }))).toBe("process_access");
  });
});

describe("repo-d: shared modules stay out of the candidate's reach", () => {
  it.each(["src/ports.mjs", "src/lib/http.mjs"])("rejects an edit to %s", (rel) => {
    const { ws, before } = workspace("repo-d");
    append(ws, rel, "\n// widen access\n");
    expect(codeOf(() => enforceCandidate({ workspace: ws, before, editable: [SCENARIOS["repo-d"].editable] }))).toBe("not_editable");
  });
});

describe.each(REPOS)("%s protected runner", (repo) => {
  it("pins the committed suite hash", () => {
    expect(computeSuiteHash(repo)).toBe(loadManifest()[repo].protectedSuiteSha256);
  });

  it("refuses a candidate directory that carries a protected-tests folder", async () => {
    const { ws } = workspace(repo);
    mkdirSync(join(ws, "src", "protected-tests"));
    writeFileSync(join(ws, "src", "protected-tests", "x.mjs"), "");
    await expect(runProtectedTests({ repo, candidateDir: join(ws, "src") })).rejects.toThrow(/Tampering guard/);
  });

  it("refuses a candidate directory that carries a .test.mjs file", async () => {
    const { ws } = workspace(repo);
    writeFileSync(join(ws, "src", "always.test.mjs"), "");
    await expect(runProtectedTests({ repo, candidateDir: join(ws, "src") })).rejects.toThrow(/Tampering guard/);
  });
});

describe("edited protected material is refused before any candidate code runs", () => {
  // Work on a copy so the committed fixtures are never touched.
  async function copiedRunner() {
    const dir = mkdtempSync(join(tmpdir(), "ix-samples-"));
    cpSync(SAMPLES, dir, { recursive: true, filter: (src) => !src.includes("node_modules") });
    const runner = await import(/* @vite-ignore */ pathToFileURL(join(dir, "run-protected-tests.mjs")).href);
    return { dir, runner };
  }

  it.each(REPOS)("%s: a weakened protected test causes a hash mismatch", async (repo) => {
    const { dir, runner } = await copiedRunner();
    expect(runner.computeSuiteHash(repo)).toBe(loadManifest()[repo].protectedSuiteSha256);
    const testFile = join(dir, repo, SCENARIOS[repo].test);
    writeFileSync(testFile, readFileSync(testFile, "utf8").replace(/assert\.equal\(leaks\((\w+)\), false/g, "assert.equal(false, false"));
    await expect(runner.runProtectedTests({ repo, candidateDir: join(dir, repo, "src") })).rejects.toThrow(/hash mismatch/);
  });

  it.each(REPOS)("%s: an edited shared harness causes a hash mismatch", async (repo) => {
    const { dir, runner } = await copiedRunner();
    const harness = join(dir, "harness", "remote.mjs");
    writeFileSync(harness, readFileSync(harness, "utf8") + "\n// tampered\n");
    await expect(runner.runProtectedTests({ repo, candidateDir: join(dir, repo, "src") })).rejects.toThrow(/hash mismatch/);
  });
});

describe("repo-c reference fix denies callers without an authenticated tenant", () => {
  function db() {
    const calls: string[] = [];
    const writes: unknown[] = [];
    return {
      calls,
      writes,
      db: {
        async findInvoiceById(id: string) {
          calls.push(id);
          return { id, tenantId: "t_acme", customer: "Acme Rockets", amountCents: 125000, status: "open" };
        },
        async updateInvoiceStatus(id: string, status: string) {
          writes.push({ id, status });
        },
      },
    };
  }
  const anonymous = [null, undefined, {}, { userId: "u_ana" }, { userId: "u_ana", tenantId: "" }, { userId: "u_ana", tenantId: 42 }];

  it.each(anonymous.map((c) => [JSON.stringify(c) ?? "undefined", c]))("caller %s gets not_found without a lookup or write", async (_label, caller) => {
    const d = db();
    const s = referenceInvoiceService(d.db);
    expect(await s.getInvoice(caller, "inv_1001")).toEqual({ ok: false, error: "not_found" });
    expect(await s.voidInvoice(caller, "inv_1001")).toEqual({ ok: false, error: "not_found" });
    expect(d.calls).toEqual([]);
    expect(d.writes).toEqual([]);
  });

  it("an authenticated same-tenant caller still reads its invoice", async () => {
    const d = db();
    const r = await referenceInvoiceService(d.db).getInvoice({ userId: "u_ana", tenantId: "t_acme" }, "inv_1001");
    expect(r.ok).toBe(true);
  });
});
