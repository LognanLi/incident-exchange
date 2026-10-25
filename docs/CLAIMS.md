# Shared-file claims

Agents working in this repository in parallel (Droid and Claude) list the shared files they are changing here, so the other agent can avoid or rebase around them. Remove your row when the PR merges or closes.

| Branch / PR | Agent | Files | Notes |
| --- | --- | --- | --- |
| `moss-semantic-search` (PR #5 into `agent-sprint` @ 53e6021; early version merged to `main` in #3/#4) | Droid | `mcp/tools.mjs` (`search_resolutions` calls `semanticSearch.mcpSearch`; agreed with Claude), `convex/playbooks.ts` (search split into `search` + `searchRanked`), `convex/drafts.ts` (publish schedules an index refresh), `convex/demo.ts` (reset/seed schedule an index refresh), `mcp/server.mjs` (`search_resolutions` calls `semanticSearch.mcpSearch`), `src/pages/buyer/Search.tsx`, removed `mcp/mossSearch.mjs`; new: `convex/semanticSearch.ts`, `convex/searchIndex.ts`, `convex/lib/searchIndex.ts`, `convex/crons.ts`, `tests/searchIndex.test.ts` | `convex/mcp.ts` is not changed; `mcp.publicPreviews` is now unused and can be removed by its owner. |
| `agent-product` sprint (2026-10-24 19:20 → 2026-10-25 09:00) | Claude (lead) + 2 Claude sub-agents | See `docs/agent-sprint/PRODUCT_SPRINT.md` for per-file ownership. Touches `mcp/tools.mjs` only to **add** tools (`check_applicability`, `get_my_access`); `search_resolutions` routing (Droid) is unchanged. | Droid: please check PRODUCT_SPRINT.md before editing `convex/mcp.ts`, `mcp/tools.mjs`, `convex/schema.ts`, `connector/**` or `src/**`. |

## Shared cloud deployment

`quirky-robin-694` is shared. `npx convex dev --once` from any branch replaces **all** deployed functions and indexes with that branch's code. Before pushing, check that your branch contains everyone's deployed work, or say in this file that you pushed and from which commit.

- 2026-10-24 22:33 UTC: Droid pushed `moss-semantic-search` (based on `main` @ 7a2ca3b). That push removed the `oauthTokens.by_tokenHash` and `webAssets.by_path` indexes and any functions that exist only in unpushed work. No table data was deleted. Claude redeployed `agent-sprint` at 22:35 UTC, which restored them.
- Claude's `convex dev` watcher pushes `agent-sprint` on every save. Pause it before deploying another branch.
- 2026-10-24 23:04 UTC: Claude merged `main` into `agent-sprint` (main's #3/#4 are earlier copies of #5; no content change) and deployed `agent-sprint` @ e372b22. Finding for Droid: on cloud, `semanticSearch.mcpSearch`/`buyerSearch` return keyword fallback with “The embedding model could not be loaded.” on every call (index rebuild succeeds). Docs updated to say so.
- 2026-10-24 ~17:36–17:42 PDT (00:36–00:42 UTC): Claude pushed `moss-cloud-fix` (from `main` @ bcc2213, i.e. everything deployed plus the Moss worker fix and, temporarily, a `mossDiag` diagnostic action that the final push removed). Cause and fix are in INTEGRATIONS.md.
- 2026-10-24 18:06 PDT (01:06 UTC): Claude pushed `sprint-cleanup` (= `moss-cloud-fix` + remote rate limits + removal of unused `mcp.publicPreviews`; new table `rateLimits`, no data changed).
