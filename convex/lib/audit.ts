import type { Doc } from "../_generated/dataModel";
import type { MutationCtx } from "../_generated/server";

/** Append an audit event. Never include private notes, secrets, or report content in `detail`. */
export async function audit(
  ctx: MutationCtx,
  org: Doc<"organizations"> | null,
  action: string,
  subject: string,
  detail?: string,
) {
  await ctx.db.insert("auditEvents", {
    orgId: org?._id,
    actorName: org?.displayName ?? "System",
    action,
    subject: subject.slice(0, 160),
    detail: detail?.slice(0, 240),
    at: Date.now(),
    isDemo: org?.isDemo ?? true,
  });
}
