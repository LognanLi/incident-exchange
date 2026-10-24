import type { Doc, Id } from "../_generated/dataModel";
import type { MutationCtx } from "../_generated/server";
import type { EvidenceLevel } from "./domain";
import type { Clue, MismatchSignal, ToyCase } from "./scenarioTypes";
import { deriveClues, matchGuide, RELEVANCE_INFO } from "./matching";

export function publicAliasFor(sharingLevel: Doc<"incidentDrafts">["sharingLevel"], org: Doc<"organizations">): string {
  return sharingLevel === "anonymous" ? "Anonymous contributor" : org.publicAlias;
}

/** Only buyer-facing preview fields are indexed for search. */
export function buildSearchText(pb: { publicTitle: string; publicSummary: string; previewRecognize: string; systemCategories: string[] }): string {
  return [pb.publicTitle, pb.publicSummary, pb.previewRecognize, pb.systemCategories.join(" ")].join("\n");
}

export type PublishInput = {
  existingPlaybookId?: Id<"playbooks">;
  incidentDraftId?: Id<"incidentDrafts">;
  contributorOrgId: Id<"organizations">;
  contributorAlias: string;
  sharingLevel: Doc<"playbooks">["sharingLevel"];
  tlp?: Doc<"playbooks">["tlp"];
  publicTitle: string;
  publicSummary: string;
  systemCategories: string[];
  environment: string[];
  clues: Clue[];
  mismatchSignals: MismatchSignal[];
  checksBeforeUse: string[];
  evidenceScope: string;
  evidenceLevel: EvidenceLevel;
  toyCase?: ToyCase;
  priceAtomic: string;
  revision: number;
  contentHash: string;
  sections: { recognize: string; check: string; contain: string; recover: string; verify: string; limitations: string };
  failedAttempts: string;
  publishedAt: number;
  isDemo: boolean;
};

/**
 * Write the public projection (playbooks) and the paid content for this revision (playbookRevisions).
 * Paid sections are never stored on the public row.
 */
export async function publishPlaybook(ctx: MutationCtx, input: PublishInput): Promise<Id<"playbooks">> {
  const clues = input.clues.length ? input.clues : deriveClues(input.sections.recognize);
  const projection = {
    incidentDraftId: input.incidentDraftId,
    contributorOrgId: input.contributorOrgId,
    contributorAlias: input.contributorAlias,
    publicTitle: input.publicTitle,
    publicSummary: input.publicSummary,
    previewRecognize: input.sections.recognize,
    publicLimitations: input.sections.limitations,
    systemCategories: input.systemCategories,
    environment: input.environment,
    applicability: { clues, mismatchSignals: input.mismatchSignals, checksBeforeUse: input.checksBeforeUse },
    evidenceScope: input.evidenceScope,
    toyCase: input.toyCase,
    sharingLevel: input.sharingLevel,
    tlp: input.tlp ?? "green",
    evidenceLevel: input.evidenceLevel,
    priceAtomic: input.priceAtomic,
    currency: "USDC",
    revision: input.revision,
    publishedAt: input.publishedAt,
    active: true,
    isDemo: input.isDemo,
  };
  const searchText = buildSearchText(projection);
  let playbookId = input.existingPlaybookId;
  if (playbookId) await ctx.db.patch(playbookId, { ...projection, searchText });
  else playbookId = await ctx.db.insert("playbooks", { ...projection, searchText });

  const existing = await ctx.db
    .query("playbookRevisions")
    .withIndex("by_playbook_revision", (q) => q.eq("playbookId", playbookId!).eq("revision", input.revision))
    .unique();
  const paid = {
    playbookId,
    revision: input.revision,
    contentHash: input.contentHash,
    check: input.sections.check,
    contain: input.sections.contain,
    recover: input.sections.recover,
    verify: input.sections.verify,
    failedAttempts: input.failedAttempts,
    publishedAt: input.publishedAt,
    isDemo: input.isDemo,
  };
  if (existing) await ctx.db.patch(existing._id, paid);
  else await ctx.db.insert("playbookRevisions", paid);
  await notifyWatchers(ctx, playbookId, { ...projection, clues });
  return playbookId;
}

/** Match a newly published guide against saved symptom alerts; matching buyers get a real-time alert. */
async function notifyWatchers(
  ctx: MutationCtx,
  playbookId: Id<"playbooks">,
  pb: { publicTitle: string; publicSummary: string; previewRecognize: string; systemCategories: string[]; environment: string[]; clues: Clue[]; applicability: { mismatchSignals: MismatchSignal[] } },
) {
  const watches = await ctx.db.query("watches").collect();
  for (const w of watches) {
    const m = matchGuide(w.query, {
      publicTitle: pb.publicTitle,
      publicSummary: pb.publicSummary,
      recognize: pb.previewRecognize,
      systemCategories: pb.systemCategories,
      environment: pb.environment,
      clues: pb.clues,
      mismatchSignals: pb.applicability.mismatchSignals,
    });
    if (!m || m.relevanceLabel === "needs_evidence") continue;
    const dup = (await ctx.db.query("alerts").withIndex("by_buyer", (q) => q.eq("buyerOrgId", w.buyerOrgId)).collect()).some(
      (a) => a.playbookId === playbookId && a.watchId === w._id,
    );
    if (dup) continue;
    await ctx.db.insert("alerts", {
      buyerOrgId: w.buyerOrgId,
      watchId: w._id,
      playbookId,
      title: pb.publicTitle,
      relevance: RELEVANCE_INFO[m.relevanceLabel].label,
      matchedClues: m.matchedClues.slice(0, 3),
      read: false,
      createdAt: Date.now(),
      isDemo: w.isDemo,
    });
  }
}
