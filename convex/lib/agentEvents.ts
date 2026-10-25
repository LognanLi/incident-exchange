// The one place agent activity events are written. Details are sanitized here, whatever their source.
import type { Doc } from "../_generated/dataModel";
import type { MutationCtx } from "../_generated/server";
import { sanitizeEventDetail, sanitizeEventText } from "../../shared/eventDetail.mjs";

export type EventInput = {
  lane: Doc<"agentEvents">["lane"];
  actor: string;
  kind: string;
  summary: string;
  status?: Doc<"agentEvents">["status"];
  refs?: string[];
  mode?: string;
  detail?: unknown;
};

export async function recordAgentEvent(ctx: MutationCtx, e: EventInput) {
  const detail = sanitizeEventDetail(e.detail);
  await ctx.db.insert("agentEvents", {
    lane: e.lane, actor: sanitizeEventText(e.actor, 60), kind: sanitizeEventText(e.kind, 60), summary: sanitizeEventText(e.summary), status: e.status ?? "ok", mode: sanitizeEventText(e.mode ?? "local", 30),
    refs: (e.refs ?? []).filter((r) => /^[a-z0-9]{10,40}$/.test(r)).slice(0, 6), ...(detail ? { detail } : {}), at: Date.now(), isDemo: true,
  });
}
