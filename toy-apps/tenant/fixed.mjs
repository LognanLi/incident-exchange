// Toy multi-tenant export service (fictional, local only) — FIXED version.
//
// API:
//   export function createExportService(db)
//     db (supplied by the evaluator):
//       await db.findExport(exportId) -> { id, tenantId, data } | null
//   service.getExport(session, exportId) -> Promise<{ status: 200, data } | { status: 401 } | { status: 404 }>
//     session = { userId, tenantId } | null
//
// Fix: authorize by tenant. A record from another tenant is answered exactly like a missing one (404),
// so the response neither leaks data nor confirms that the id exists.
export function createExportService(db) {
  return {
    async getExport(session, exportId) {
      if (!session || !session.tenantId) return { status: 401 };
      const record = await db.findExport(exportId);
      if (!record || record.tenantId !== session.tenantId) return { status: 404 };
      return { status: 200, data: record.data };
    },
  };
}
