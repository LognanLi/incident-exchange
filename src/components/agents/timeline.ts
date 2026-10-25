import type { Overview } from "./activity";
import type { Payment } from "./payments";

export type Recording = {
  recordedAt: number;
  run: { startedAt: number; finishedAt: number; durationMs: number };
  source: { deployment: string; commit: string; workingTree?: string };
  overview: Overview;
};

export const checksOf = (o: Overview) => o.applicabilityChecks ?? [];
export const paymentsOf = (o: Overview) => o.payments ?? [];

/** A run is a real stored job's time window, never the deployment's aggregate history. */
export function duringRun(o: Overview, job: Overview["jobs"][number]): Overview {
  const inRun = (at: number) => at >= job.startedAt && at <= (job.finishedAt ?? Infinity);
  return { ...o, events: o.events.filter((e) => inRun(e.at)), runs: o.runs.filter((r) => inRun(r.at)), outcomes: o.outcomes.filter((x) => inRun(x.at)), applicabilityChecks: checksOf(o).filter((c) => inRun(c.at)) };
}

/** Reconstruct only what the recording proves at t. Never reveal a later receipt or final status early. */
export function paymentAt(p: Payment, t: number): Payment {
  const auth = p.steps.find((s) => s.key === "authorized");
  const payment = p.steps.find((s) => s.key === "payment");
  const notAuthorized = !auth?.at || auth.at > t;
  const beforePayment = !payment?.at || payment.at > t;
  const noPayment = ["refused", "expired"].includes(p.state);
  const future = notAuthorized || (!noPayment && beforePayment);
  const state = notAuthorized ? "requested" : beforePayment && !noPayment ? "authorized" : p.state;
  return {
    ...p, state,
    purchaseId: notAuthorized ? null : p.purchaseId,
    authorizedBudget: notAuthorized ? null : p.authorizedBudget,
    contributorShareAtomic: notAuthorized ? null : p.contributorShareAtomic,
    platformShareAtomic: notAuthorized ? null : p.platformShareAtomic,
    txHash: future ? null : p.txHash, payer: future ? null : p.payer, error: future ? null : p.error,
    reusedCount: p.lastReusedAt && p.lastReusedAt > t ? 0 : p.reusedCount,
    lastReusedAt: p.lastReusedAt && p.lastReusedAt > t ? null : p.lastReusedAt,
    steps: p.steps.map((s) => {
      if (s.at && s.at <= t) return s;
      if (!future) return s;
      return { key: s.key, label: s.key === "requested" ? "Quote requested" : s.key === "authorized" ? "Waiting for the buyer to acquire" : s.key === "payment" ? "Payment" : "Access granted", state: "todo" };
    }),
  };
}

export function recordedUntil(recording: Recording, t: number): Overview {
  const o = recording.overview;
  const events = o.events.filter((e) => e.at <= t);
  const payments = paymentsOf(o).filter((p) =>
    (p.quotedAt >= recording.run.startedAt && p.quotedAt <= t) || events.some((e) => e.refs.includes(p.quoteId) || (p.purchaseId && e.refs.includes(p.purchaseId))),
  ).map((p) => paymentAt(p, t));
  return {
    ...o, events, payments,
    runs: o.runs.filter((r) => r.at <= t), outcomes: o.outcomes.filter((x) => x.at <= t), applicabilityChecks: checksOf(o).filter((c) => c.at <= t),
    purchases: o.purchases.filter((p) => payments.some((x) => x.purchaseId === p._id && ["settled", "simulated"].includes(x.state))),
    submissions: o.submissions.filter((s) => events.some((e) => e.refs.includes(s._id))),
  };
}
