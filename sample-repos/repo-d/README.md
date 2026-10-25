# repo-d: report-exports (toy, fictional)

HTTP route handlers for downloading and deleting generated report exports in a multi-workspace
analytics product. Every export belongs to one workspace.
Bug: `/exports/:exportId` looks the export up by the client-supplied id only, so a member of one
workspace can download or delete another workspace's export by changing the id in the URL.

Editable file: `src/routes/exports.mjs` only. `src/ports.mjs` (interfaces) and `src/lib/http.mjs`
are read-only. `environment-facts.json` holds the operator's declared environment facts (exports are
never shared across workspaces). Tests in `protected-tests/` are run by a separate runner.
No reference fix: the buyer's repair agent adapts a purchased lesson.
