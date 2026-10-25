// report-exports: shared HTTP helpers (not part of the fix surface).
export const STATUS = Object.freeze({ OK: 200, NO_CONTENT: 204, BAD_REQUEST: 400, NOT_FOUND: 404 });
export const ERRORS = Object.freeze({ NOT_FOUND: { error: "export_not_found" } });
