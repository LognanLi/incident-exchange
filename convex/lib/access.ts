import { ConvexError } from "convex/values";
import type { Doc, Id } from "../_generated/dataModel";
import type { QueryCtx } from "../_generated/server";
import type { Role } from "./domain";

/**
 * Demo identity: the browser sends the slug of the organization it is acting as.
 * Every function re-loads the organization and checks its role server-side.
 * A production deployment would replace this with real authentication (e.g. Convex Auth / Clerk).
 */
export async function getActor(ctx: QueryCtx, actor: string): Promise<Doc<"organizations">> {
  const org = await ctx.db
    .query("organizations")
    .withIndex("by_slug", (q) => q.eq("slug", actor))
    .unique();
  if (!org) throw new ConvexError("Unknown demo identity. Open the Demo menu and pick a role, or reset demo data.");
  return org;
}

export async function requireRole(ctx: QueryCtx, actor: string, roles: Role | Role[]): Promise<Doc<"organizations">> {
  const org = await getActor(ctx, actor);
  const allowed = Array.isArray(roles) ? roles : [roles];
  if (!allowed.includes(org.demoRole)) {
    throw new ConvexError(`This action requires the ${allowed.join(" or ")} role.`);
  }
  return org;
}

export async function requireOwnDraft(
  ctx: QueryCtx,
  actor: string,
  draftId: Id<"incidentDrafts">,
): Promise<{ org: Doc<"organizations">; draft: Doc<"incidentDrafts"> }> {
  const org = await requireRole(ctx, actor, "contributor");
  const draft = await ctx.db.get(draftId);
  if (!draft || draft.contributorOrgId !== org._id) throw new ConvexError("Draft not found.");
  return { org, draft };
}

/** Contributor who owns the draft, or any reviewer. */
export async function requireDraftAccess(
  ctx: QueryCtx,
  actor: string,
  draftId: Id<"incidentDrafts">,
): Promise<{ org: Doc<"organizations">; draft: Doc<"incidentDrafts"> }> {
  const org = await requireRole(ctx, actor, ["contributor", "reviewer"]);
  const draft = await ctx.db.get(draftId);
  if (!draft) throw new ConvexError("Draft not found.");
  if (org.demoRole === "contributor" && draft.contributorOrgId !== org._id) throw new ConvexError("Draft not found.");
  return { org, draft };
}
