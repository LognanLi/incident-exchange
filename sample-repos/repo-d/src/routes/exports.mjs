// report-exports: /exports/:exportId routes.
// GET downloads a generated report export; DELETE removes it.

import { STATUS, ERRORS } from "../lib/http.mjs";

/**
 * @param {{ exportsTable: import("../ports.mjs").ExportsTable, http: import("../ports.mjs").Http }} ctx
 */
export function mountExportRoutes({ exportsTable, http }) {
  return {
    /** GET /exports/:exportId  @param {import("../ports.mjs").Request} req */
    async downloadExport(req) {
      const [row] = await exportsTable.select({ exportId: req.params.exportId });
      if (!row) return http.reply(req.requestId, STATUS.NOT_FOUND, ERRORS.NOT_FOUND);
      return http.reply(req.requestId, STATUS.OK, { exportId: row.exportId, title: row.title, format: row.format, content: row.content });
    },

    /** DELETE /exports/:exportId  @param {import("../ports.mjs").Request} req */
    async deleteExport(req) {
      const [row] = await exportsTable.select({ exportId: req.params.exportId });
      if (!row) return http.reply(req.requestId, STATUS.NOT_FOUND, ERRORS.NOT_FOUND);
      await exportsTable.remove(row.exportId);
      return http.reply(req.requestId, STATUS.NO_CONTENT, null);
    },
  };
}
