// report-exports: interfaces injected into the route handlers (documentation only; not editable by agents).

/**
 * A generated report export. Every export belongs to exactly one workspace.
 * @typedef {Object} ExportRow
 * @property {string} exportId      Opaque id, also used in download URLs.
 * @property {string} workspaceId   Workspace that owns the export.
 * @property {string} title
 * @property {string} format        "csv" | "pdf"
 * @property {string} content       The exported report body.
 */

/**
 * Incoming HTTP request, already authenticated by the gateway middleware.
 * `auth.workspaceId` is the caller's authenticated workspace (trusted, server-side).
 * `params.exportId` is taken from the URL path `/exports/:exportId` (client-supplied, untrusted).
 * @typedef {Object} Request
 * @property {string} requestId
 * @property {{ userId: string, workspaceId: string }} auth
 * @property {{ exportId?: string }} params
 */

/**
 * Export storage, queried by column filter.
 * @typedef {Object} ExportsTable
 * @property {(where: { exportId: string }) => Promise<ExportRow[]>} select   Rows matching the filter (0 or 1 for exportId).
 * @property {(exportId: string) => Promise<number>} remove                  Deletes by id; resolves the number of rows removed.
 */

/**
 * Response writer. Handlers answer each request exactly once via reply(); their return value is ignored.
 * @typedef {Object} Http
 * @property {(requestId: string, status: number, body: object | null) => Promise<void>} reply
 */

export {};
