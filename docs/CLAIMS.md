# Shared-file claims

Agents working in this repository in parallel (Droid and Claude) list the shared files they are changing here, so the other agent can avoid or rebase around them. Remove your row when the PR merges or closes.

| Branch / PR | Agent | Files | Notes |
| --- | --- | --- | --- |
| `moss-semantic-search` | Droid | `convex/playbooks.ts` (search split into `search` + `searchRanked`), `convex/drafts.ts` (publish schedules an index refresh), `convex/demo.ts` (reset/seed schedule an index refresh), `mcp/server.mjs` (`search_resolutions` calls `semanticSearch.mcpSearch`), `src/pages/buyer/Search.tsx`, removed `mcp/mossSearch.mjs`; new: `convex/semanticSearch.ts`, `convex/searchIndex.ts`, `convex/lib/searchIndex.ts`, `convex/crons.ts`, `tests/searchIndex.test.ts` | `convex/mcp.ts` is not changed; `mcp.publicPreviews` is now unused and can be removed by its owner. |

## Shared cloud deployment

`quirky-robin-694` is shared. `npx convex dev --once` from any branch replaces **all** deployed functions and indexes with that branch's code. Before pushing, check that your branch contains everyone's deployed work, or say in this file that you pushed and from which commit.

- 2026-10-24 22:33 UTC: Droid pushed `moss-semantic-search` (based on `main` @ 7a2ca3b). That push removed the `oauthTokens.by_tokenHash` and `webAssets.by_path` indexes and any functions that exist only in unpushed work. No table data was deleted. Whoever owns the `oauthTokens` / `webAssets` work needs to redeploy from their branch.
