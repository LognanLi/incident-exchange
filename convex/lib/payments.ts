// Payment inspector model for agent purchases: one entry per quote, joined with its purchase, the buyer's
// operator policy, and the activity events that reference it. States come only from stored records.
// Never includes authorization nonces, signatures, or anything a payment signer holds.
import type { Doc } from "../_generated/dataModel";
import type { QueryCtx } from "../_generated/server";
import { sumAtomic } from "./money";

export type PaymentState = "requested" | "refused" | "expired" | "authorized" | "settling" | "settled" | "simulated" | "failed" | "canceled" | "unconfirmed";
export type StepState = "done" | "active" | "failed" | "skipped" | "todo";
export type Step = { key: "requested" | "authorized" | "payment" | "access"; label: string; state: StepState; at?: number; note?: string };

const PAID = new Set(["test_success", "simulated_success"]);

/** Pure: derive the state and four-step timeline from stored records. `refusal` is a denial event for this quote. */
export function derivePayment(
  quote: Pick<Doc<"quotes">, "createdAt" | "expiresAt" | "status">,
  purchase: Pick<Doc<"purchases">, "paymentStatus" | "provider" | "createdAt" | "completedAt" | "x402"> | null,
  refusal: { kind: string; at: number; summary: string } | null,
  now: number,
): { state: PaymentState; steps: Step[] } {
  const requested: Step = { key: "requested", label: "Quote requested", state: "done", at: quote.createdAt };
  const sim = purchase?.provider === "demo_simulator";
  const payLabel = sim ? "Simulated payment (no funds)" : "Test payment (x402, Base Sepolia)";
  if (!purchase) {
    if (refusal) {
      return {
        state: "refused",
        steps: [requested, { key: "authorized", label: refusal.kind === "budget_exceeded" ? "Refused by spend policy" : "Refused: terms or policy", state: "failed", at: refusal.at, note: refusal.summary }, { key: "payment", label: payLabel, state: "skipped" }, { key: "access", label: "Access granted", state: "skipped" }],
      };
    }
    const expired = quote.status === "open" && quote.expiresAt < now;
    return {
      state: expired ? "expired" : "requested",
      steps: [requested, { key: "authorized", label: expired ? "Quote expired unused" : "Waiting for the buyer to acquire", state: expired ? "skipped" : "active", at: expired ? quote.expiresAt : undefined }, { key: "payment", label: payLabel, state: expired ? "skipped" : "todo" }, { key: "access", label: "Access granted", state: expired ? "skipped" : "todo" }],
    };
  }
  const authorized: Step = { key: "authorized", label: "Authorized within policy (budget reserved)", state: "done", at: purchase.createdAt };
  const s = purchase.paymentStatus;
  if (PAID.has(s)) {
    return {
      state: s === "test_success" ? "settled" : "simulated",
      steps: [requested, authorized, { key: "payment", label: s === "test_success" ? "Settled on Base Sepolia" : "Simulated (no funds moved)", state: "done", at: purchase.completedAt }, { key: "access", label: "Access granted", state: "done", at: purchase.completedAt }],
    };
  }
  if (s === "failed") {
    return { state: "failed", steps: [requested, authorized, { key: "payment", label: "Payment failed (no funds moved; reservation released)", state: "failed", at: purchase.completedAt, note: purchase.x402?.error }, { key: "access", label: "Access granted", state: "skipped" }] };
  }
  if (s === "cancelled") {
    return { state: "canceled", steps: [requested, authorized, { key: "payment", label: "Canceled before payment", state: "skipped", at: purchase.completedAt }, { key: "access", label: "Access granted", state: "skipped" }] };
  }
  // pending
  const signed = !!purchase.x402?.settlingAt;
  if (purchase.x402?.error && signed) {
    return { state: "unconfirmed", steps: [requested, authorized, { key: "payment", label: "Authorization signed; settlement unconfirmed (awaiting on-chain reconciliation)", state: "active", at: purchase.x402.settlingAt, note: purchase.x402.error }, { key: "access", label: "Access granted", state: "todo" }] };
  }
  return {
    state: signed ? "settling" : "authorized",
    steps: [requested, authorized, { key: "payment", label: signed ? "Settling on Base Sepolia" : sim ? "Simulated payment next" : "Server wallet pays via x402 next", state: "active", at: purchase.x402?.settlingAt }, { key: "access", label: "Access granted", state: "todo" }],
  };
}

const DENIALS = new Set(["budget_exceeded", "acquire_denied"]);

/** All recent agent payments, newest first, plus exact earnings totals for agent-bought guides. */
export async function loadPayments(ctx: QueryCtx, events: Doc<"agentEvents">[], limit = 12) {
  const now = Date.now();
  const agentPurchases = (await ctx.db.query("purchases").collect()).filter((p) => p.principalId);
  const allQuotes = (await ctx.db.query("quotes").collect()).sort((a, b) => b.createdAt - a.createdAt);
  // Keep earlier receipts inspectable even after many newer quotes. A used quote may point to an
  // earlier purchase through a duplicate/reuse event rather than the purchase's original quoteId.
  const purchaseQuotes = new Set(agentPurchases.map((p) => p.quoteId));
  const quotes = allQuotes.filter((q, i) => i < limit || purchaseQuotes.has(q._id) || events.some((e) => e.refs.includes(q._id)));
  const principals = new Map((await ctx.db.query("agentPrincipals").collect()).map((p) => [p._id, p]));
  const titles = new Map<string, string>();
  const title = async (id: Doc<"playbooks">["_id"]) => {
    if (!titles.has(id)) titles.set(id, (await ctx.db.get(id))?.publicTitle ?? "guide");
    return titles.get(id)!;
  };
  const allowance = (principalId: Doc<"agentPrincipals">["_id"]) => {
    const p = principals.get(principalId);
    if (!p) return null;
    const live = agentPurchases.filter((x) => x.principalId === principalId && (x.paymentStatus === "pending" || PAID.has(x.paymentStatus)));
    const committed = BigInt(sumAtomic(live.map((x) => x.amountAtomic)));
    const max = BigInt(p.policy.sessionMaxAtomic);
    return {
      maxPerPurchaseAtomic: p.policy.maxPerPurchaseAtomic, sessionMaxAtomic: p.policy.sessionMaxAtomic, maxPurchases: p.policy.maxPurchases, allowSimulator: !!p.policy.allowSimulator,
      committedAtomic: committed.toString(), remainingAtomic: (max > committed ? max - committed : 0n).toString(), remainingPurchases: Math.max(0, p.policy.maxPurchases - live.length),
    };
  };

  const payments = [];
  for (const q of quotes) {
    const reuse = events.find((e) => ["entitlement_reused", "purchase_reused"].includes(e.kind) && e.refs.includes(q._id));
    const purchase = agentPurchases.find((x) => x.quoteId === q._id || x._id === q.purchaseId || (reuse?.refs.includes(x._id) && x.principalId === q.principalId && x.playbookId === q.playbookId && x.revision === q.revision)) ?? null;
    const related = events.filter((e) => e.refs.includes(q._id) || (purchase && e.refs.includes(purchase._id)));
    const refusalEvent = related.find((e) => DENIALS.has(e.kind)) ?? null;
    const { state, steps } = derivePayment(q, purchase, refusalEvent && { kind: refusalEvent.kind, at: refusalEvent.at, summary: refusalEvent.summary }, now);
    const reuses = purchase ? events.filter((e) => e.kind === "entitlement_reused" && e.refs.includes(purchase._id)) : [];
    const principal = principals.get(q.principalId);
    payments.push({
      quoteId: q._id, purchaseId: purchase?._id ?? null, buyer: principal?.name ?? "agent", buyerOrg: principal?.orgSlug ?? "",
      resolutionId: q.playbookId, title: await title(q.playbookId), revision: q.revision,
      amountAtomic: q.priceAtomic, quotedAt: q.createdAt, expiresAt: q.expiresAt, network: q.network, payTo: q.payTo,
      mode: purchase ? (purchase.provider === "x402_test" ? ("testnet" as const) : ("simulated" as const)) : null,
      state, steps,
      txHash: purchase?.x402?.txHash ?? null, payer: purchase?.x402?.payer ?? null, error: purchase?.x402?.error ?? null,
      contributorShareAtomic: purchase?.contributorShareAtomic ?? null, platformShareAtomic: purchase?.platformShareAtomic ?? null,
      allowanceNow: allowance(q.principalId), allowanceAsOf: now,
      authorizedBudget: purchase?.spendPolicySnapshot ?? null,
      reusedCount: reuses.length, lastReusedAt: reuses.length ? reuses[0].at : null,
      eventIds: related.map((e) => e._id),
    });
  }

  // Earnings: exact integer arithmetic over settled testnet purchases; simulated reported separately, never as earnings.
  const testnet = agentPurchases.filter((p) => p.paymentStatus === "test_success");
  const simulated = agentPurchases.filter((p) => p.paymentStatus === "simulated_success");
  const byGuide = new Map<string, { resolutionId: string; title: string; sales: number; grossAtomic: string; contributorAtomic: string; platformAtomic: string; simulatedSales: number }>();
  for (const p of [...testnet, ...simulated]) {
    const g = byGuide.get(p.playbookId) ?? { resolutionId: p.playbookId, title: await title(p.playbookId), sales: 0, grossAtomic: "0", contributorAtomic: "0", platformAtomic: "0", simulatedSales: 0 };
    if (p.paymentStatus === "test_success") {
      g.sales += 1;
      g.grossAtomic = sumAtomic([g.grossAtomic, p.amountAtomic]);
      g.contributorAtomic = sumAtomic([g.contributorAtomic, p.contributorShareAtomic]);
      g.platformAtomic = sumAtomic([g.platformAtomic, p.platformShareAtomic]);
    } else g.simulatedSales += 1;
    byGuide.set(p.playbookId, g);
  }
  const gross = sumAtomic(testnet.map((p) => p.amountAtomic));
  const contributor = sumAtomic(testnet.map((p) => p.contributorShareAtomic));
  const platform = sumAtomic(testnet.map((p) => p.platformShareAtomic));
  const earnings = {
    grossAtomic: gross, contributorAccruedAtomic: contributor, platformFeeAtomic: platform, paidOutAtomic: "0",
    // The ledger split must add up exactly; the console shows a warning if it ever doesn't.
    balanced: BigInt(contributor) + BigInt(platform) === BigInt(gross),
    testnetSales: testnet.length, simulatedSales: simulated.length, simulatedGrossAtomic: sumAtomic(simulated.map((p) => p.amountAtomic)),
    byGuide: [...byGuide.values()],
  };
  return { payments, earnings };
}
