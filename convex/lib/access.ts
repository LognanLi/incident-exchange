import { ConvexError } from "convex/values";
import type { Doc, Id } from "../_generated/dataModel";
import type { QueryCtx } from "../_generated/server";
import type { Role } from "./domain";
import { verifySession, verifySessionInfo } from "../../shared/session.mjs";

/**
 * Demo identity: the browser sends the slug of the organization it is acting as.
 * Every function re-loads the organization and checks its role server-side.
 * A production deployment would replace this with real authentication (e.g. Convex Auth / Clerk).
 */
export async function getActor(ctx: QueryCtx, actor: string): Promise<Doc<"organizations">> {
  // A signed demo session (minted only by the local runner) is required. Bare slugs are accepted only
  // when DEMO_OPEN_IDENTITY=on (automated tests), never on a shared deployment.
  let slug = await verifySession(process.env.DEMO_SESSION_SECRET, actor);
  if (!slug && process.env.DEMO_OPEN_IDENTITY === "on" && /^[a-z0-9-]{2,40}$/.test(actor)) slug = actor;
  if (!slug) throw new ConvexError("Demo session required or expired. Reload the page to start a new one."); 
  const org = await ctx.db
    .query("organizations")
    .withIndex("by_slug", (q) => q.eq("slug", slug))
    .unique();
  if (!org) throw new ConvexError("Unknown demo identity. Open the Demo menu and pick a role, or reset demo data.");
  return org;
}

/**
 * Operator-only demo controls (reset, starting agent runs): the session must have been minted by the
 * presenter's local runner. Viewer sessions from the hosted access code are refused.
 */
export async function requireOperator(ctx: QueryCtx, actor: string): Promise<Doc<"organizations">> {
  const org = await getActor(ctx, actor);
  const info = await verifySessionInfo(process.env.DEMO_SESSION_SECRET, actor);
  const openTestIdentity = !info && process.env.DEMO_OPEN_IDENTITY === "on";
  if (!info?.operator && !openTestIdentity) throw new ConvexError("Only the demo operator can do this (requires the presenter's local runner).");
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
