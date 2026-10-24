// PROTECTED evaluator for the toy tenant-isolation case. The candidate module is passed in; never imported here.
// Uses only the documented API: mod.createExportService(db) and service.getExport(session, exportId).

const A_SECRET = "acme-q3-payroll-FICTIONAL-7731";
const B_SECRET = "globex-q3-payroll-FICTIONAL-2290";

function makeDb() {
  const rows = {
    exp_a1: { id: "exp_a1", tenantId: "tenant_acme", data: { rows: 3, marker: A_SECRET } },
    exp_b1: { id: "exp_b1", tenantId: "tenant_globex", data: { rows: 5, marker: B_SECRET } },
  };
  return {
    async findExport(id) {
      const r = rows[String(id)];
      return r ? { id: r.id, tenantId: r.tenantId, data: { ...r.data } } : null;
    },
  };
}

const sessionA = () => ({ userId: "user_alice", tenantId: "tenant_acme" });
const sessionB = () => ({ userId: "user_bob", tenantId: "tenant_globex" });

function leaks(res, marker) {
  try {
    return JSON.stringify(res ?? null).includes(marker);
  } catch {
    return true;
  }
}

export async function evaluate(mod) {
  const assertions = [];
  const check = async (name, fn) => {
    try {
      const detail = await fn();
      assertions.push({ name, ok: detail === true, detail: detail === true ? "ok" : String(detail) });
    } catch (e) {
      assertions.push({ name, ok: false, detail: `threw: ${String(e && e.message ? e.message : e).slice(0, 160)}` });
    }
  };
  const create = () => {
    if (!mod || typeof mod.createExportService !== "function") throw new Error("createExportService is not exported");
    const svc = mod.createExportService(makeDb());
    if (!svc || typeof svc.getExport !== "function") throw new Error("service.getExport missing");
    return svc;
  };

  await check("Tenant A reads its own export (200 with A's data)", async () => {
    const r = await create().getExport(sessionA(), "exp_a1");
    return r && r.status === 200 && leaks(r.data, A_SECRET) ? true : `expected 200 with A's data, got status ${r && r.status}`;
  });

  await check("Tenant A cannot read tenant B's export (not 200, no B data)", async () => {
    const r = await create().getExport(sessionA(), "exp_b1");
    if (r && r.status === 200) return "cross-tenant read returned 200";
    if (leaks(r, B_SECRET)) return "response leaked tenant B data";
    return true;
  });

  await check("Request without a session is rejected with 401", async () => {
    const r = await create().getExport(null, "exp_a1");
    if (leaks(r, A_SECRET)) return "response leaked data without a session";
    return r && r.status === 401 ? true : `expected 401, got ${r && r.status}`;
  });

  await check("Tenant B reads its own export (legitimate access preserved)", async () => {
    const r = await create().getExport(sessionB(), "exp_b1");
    return r && r.status === 200 && leaks(r.data, B_SECRET) ? true : `expected 200 with B's data, got status ${r && r.status}`;
  });

  const passed = assertions.length > 0 && assertions.every((a) => a.ok === true);
  const okCount = assertions.filter((a) => a.ok === true).length;
  return { passed, summary: `${okCount}/${assertions.length} tenant assertions passed`, assertions };
}
