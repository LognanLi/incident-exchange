"use node";
// Node-only: building Moss indexes requires the @moss-js/moss SDK.
import { v } from "convex/values";
import { MossClient } from "@moss-js/moss";
import { internalAction } from "./_generated/server";
import { internal } from "./_generated/api";
import { mossCredentials, playbookDocuments } from "./lib/moss";

/** (Re)build one scope of a playbook's Moss index from its buyer-facing sections. */
export const buildIndex = internalAction({
  args: { playbookId: v.id("playbooks"), scope: v.union(v.literal("preview"), v.literal("full")) },
  handler: async (ctx, { playbookId, scope }): Promise<{ ok: boolean; name: string; error?: string }> => {
    const creds = mossCredentials();
    const src = await ctx.runQuery(internal.mossState.indexSource, { playbookId, scope });
    if (!creds || !src) return { ok: false, name: "", error: "Moss not configured or playbook missing" };
    const client = new MossClient(creds.projectId, creds.projectKey);
    await ctx.runMutation(internal.mossState.setStatus, { playbookId, scope, name: src.name, status: "building" });
    try {
      await client.deleteIndex(src.name).catch(() => undefined); // rebuilds replace the old index
      await client.createIndex(src.name, playbookDocuments(src.sections));
      await ctx.runMutation(internal.mossState.setStatus, { playbookId, scope, name: src.name, status: "ready" });
      return { ok: true, name: src.name };
    } catch (err) {
      const error = err instanceof Error ? err.message.slice(0, 200) : "unknown error";
      await ctx.runMutation(internal.mossState.setStatus, { playbookId, scope, name: src.name, status: "failed", error });
      return { ok: false, name: src.name, error };
    }
  },
});

export const buildAll = internalAction({
  args: { playbookId: v.id("playbooks") },
  handler: async (ctx, { playbookId }) => {
    await ctx.runAction(internal.mossIndex.buildIndex, { playbookId, scope: "preview" });
    await ctx.runAction(internal.mossIndex.buildIndex, { playbookId, scope: "full" });
  },
});

/** Best-effort cleanup of indexes for records removed by a demo reset. */
export const deleteIndexes = internalAction({
  args: { names: v.array(v.string()) },
  handler: async (_ctx, { names }) => {
    const creds = mossCredentials();
    if (!creds) return;
    const client = new MossClient(creds.projectId, creds.projectKey);
    for (const name of names) {
      // Only ever touch indexes this app created.
      if (!/^ix-[a-z0-9]+-(preview|full)$/.test(name)) continue;
      await client.deleteIndex(name).catch(() => undefined);
    }
  },
});
