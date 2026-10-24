// Toy multi-tenant export service (fictional, local only) — VULNERABLE version.
//
// API:
//   export function createExportService(db)
//     db (supplied by the evaluator):
//       await db.findExport(exportId) -> { id, tenantId, data } | null
//   service.getExport(session, exportId) -> Promise<{ status: 200, data } | { status: 401 } | { status: 404 }>
//     session = { userId, tenantId } | null
//
// Bug: only checks that a session exists, so any signed-in user can read any tenant's export by id.
export function createExportService(db) {
  return {
    async getExport(session, exportId) {
      if (!session) return { status: 401 };
      const record = await db.findExport(exportId);
      if (!record) return { status: 404 };
      return { status: 200, data: record.data };
    },
  };
}
