// Payment inspector and contributor earnings. Built from stored quotes, purchases, policies and events
// (convex/lib/payments.ts). Shows public addresses and transaction hashes only; signing happens server-side
// with the exchange's wallet and no key, signature, authorization or token ever reaches this page.
import { useState } from "react";
import { formatAtomic } from "../../../convex/lib/money";
import type { Overview } from "./activity";

export type Payment = Overview["payments"][number];
export type Earnings = Overview["earnings"];

const STATE_TEXT: Record<Payment["state"], { label: string; cls: string; explain: string }> = {
  requested: { label: "Quote requested", cls: "", explain: "Quoted; the buyer has not acquired it yet." },
  refused: { label: "Refused", cls: "sev-high", explain: "The exchange refused the purchase before any payment. No funds moved." },
  expired: { label: "Quote expired", cls: "", explain: "The quote expired unused. No funds moved." },
  authorized: { label: "Authorized", cls: "warn", explain: "Terms matched the buyer's pinned policy; the budget is reserved. Payment is next." },
  settling: { label: "Pending settlement", cls: "warn", explain: "The exchange's wallet signed a test-USDC authorization; settlement on Base Sepolia is in progress." },
  unconfirmed: { label: "Unconfirmed", cls: "warn", explain: "An authorization was signed but settlement is unconfirmed; it stays pending until reconciled on-chain, so it can never be charged twice." },
  settled: { label: "Settled · testnet", cls: "ok", explain: "Settled on Base Sepolia with test USDC; access granted." },
  simulated: { label: "Simulated", cls: "", explain: "Payment simulator: access granted, no funds moved, not counted as earnings." },
  failed: { label: "Failed", cls: "sev-high", explain: "The payment failed before settlement could start. No funds moved; the reservation was released." },
  canceled: { label: "Canceled", cls: "", explain: "Canceled before payment. No funds moved." },
};
const EXPLORER = "https://sepolia.basescan.org";
const usdc = (atomic: string, mode: Payment["mode"]) => `${formatAtomic(atomic)} ${mode === "simulated" ? "USDC (simulated)" : "test USDC"}`;
const short = (a: string) => (a.length > 14 ? `${a.slice(0, 8)}…${a.slice(-6)}` : a);
const when = (ms?: number | null) => (ms ? new Date(ms).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" }) : "");

export function PaymentInspector({ payments, recorded }: { payments: Payment[]; recorded: boolean }) {
  const [selected, setSelected] = useState<string | null>(null);
  const current = payments.find((p) => p.quoteId === selected) ?? payments[0];
  return (
    <section className="card" aria-labelledby="pay-h">
      <h2 id="pay-h">Payments</h2>
      {payments.length === 0 ? (
        <p className="muted small">{recorded ? "This recording has no payment records." : "No agent payments yet. A buyer agent's quote and purchase appear here as they happen."}</p>
      ) : (
        <div className="pay-layout">
          <ul className="pay-list" aria-label="Agent payments">
            {payments.map((p) => {
              const s = STATE_TEXT[p.state];
              const active = p.quoteId === current.quoteId;
              return (
                <li key={p.quoteId}>
                  <button type="button" className={`pay-item${active ? " active" : ""}`} aria-pressed={active} onClick={() => setSelected(p.quoteId)}>
                    <span className={`badge ${s.cls}`}>{s.label}</span>
                    <span className="pay-item-title">{p.title}</span>
                    <span className="small muted">
                      {p.buyer} · {usdc(p.amountAtomic, p.mode)} · {when(p.quotedAt)}
                      {p.reusedCount > 0 && ` · reused ${p.reusedCount}×`}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
          <PaymentDetail p={current} recorded={recorded} />
        </div>
      )}
      <p className="small muted">
        Signing happens on the exchange server with its test wallet, under spend controls pinned to the quote's payee, network, asset and amount. Retrieved
        content can't change any of them. Re-acquiring a revision you own returns the earlier purchase and never charges again.
      </p>
    </section>
  );
}

function PaymentDetail({ p, recorded }: { p: Payment; recorded: boolean }) {
  const s = STATE_TEXT[p.state];
  const a = p.allowanceNow;
  return (
    <div className="pay-detail" aria-live="polite">
      <div className="row gap wrap">
        <span className={`badge ${s.cls}`}>{s.label}</span>
        <strong>{p.title}</strong>
        <span className="small muted">revision {p.revision}</span>
      </div>
      <p className="small">{s.explain}</p>
      <ol className="pay-steps" aria-label="Payment progress">
        {p.steps.map((st) => (
          <li key={st.key} className={`pay-step step-${st.state}`}>
            <span className="pay-step-dot" aria-hidden />
            <span>
              {st.label}
              <span className="sr-only"> ({st.state})</span>
              {st.at ? <span className="small muted"> · {when(st.at)}</span> : null}
              {st.note && <span className="small block warn-text">{st.note}</span>}
            </span>
          </li>
        ))}
      </ol>
      <dl className="kv small pay-kv">
        <dt>Quoted amount</dt>
        <dd>{usdc(p.amountAtomic, p.mode)} <span className="muted">({p.amountAtomic} atomic units)</span></dd>
        <dt>Quote expiry</dt>
        <dd>{new Date(p.expiresAt).toLocaleString()}{p.expiresAt < Date.now() && p.state === "requested" ? " (expired)" : ""}</dd>
        <dt>Network</dt>
        <dd>{p.network === "eip155:84532" ? "Base Sepolia (test network, eip155:84532)" : p.network}</dd>
        <dt>Recipient (public)</dt>
        <dd><code>{p.payTo}</code></dd>
        {p.payer && (<><dt>Payer (public)</dt><dd><code title={p.payer}>{short(p.payer)}</code></dd></>)}
        <dt>Receipt</dt>
        <dd>
          {p.txHash ? (
            <a href={`${EXPLORER}/tx/${p.txHash}`} target="_blank" rel="noreferrer noopener">
              Base Sepolia tx <code>{short(p.txHash)}</code> ↗
            </a>
          ) : p.mode === "simulated" ? "simulated, no transaction" : p.state === "settling" || p.state === "unconfirmed" ? "awaiting settlement" : "no transaction"}
        </dd>
        <dt>Buyer</dt>
        <dd>{p.buyer}{p.buyerOrg ? ` (${p.buyerOrg})` : ""}</dd>
        <dt>Budget at authorization</dt>
        <dd>{p.authorizedBudget ? <>
          ≤ {formatAtomic(p.authorizedBudget.maxPerPurchaseAtomic)} test USDC per purchase · ≤ {formatAtomic(p.authorizedBudget.sessionMaxAtomic)} per session · ≤ {p.authorizedBudget.maxPurchases} purchase(s).
          <span className="block muted">After this reservation: {formatAtomic(p.authorizedBudget.remainingAfterAtomic)} test USDC and {p.authorizedBudget.remainingPurchases} purchase(s) remained.</span>
        </> : p.purchaseId ? "Not captured on this older receipt; current policy is shown below." : "No purchase authorized."}</dd>
        {a && (
          <>
            <dt>Current budget policy</dt>
            <dd>
              ≤ {formatAtomic(a.maxPerPurchaseAtomic)} test USDC per purchase · ≤ {formatAtomic(a.sessionMaxAtomic)} per session · ≤ {a.maxPurchases} purchase(s) · simulator{" "}
              {a.allowSimulator ? "allowed" : "not allowed"}
            </dd>
            <dt>{recorded ? "Remaining at capture" : "Remaining now"}</dt>
            <dd>
              {formatAtomic(a.remainingAtomic)} test USDC · {a.remainingPurchases} purchase(s) <span className="muted">(committed {formatAtomic(a.committedAtomic)})</span>
              {recorded && <span className="small block muted">Policy snapshot from the recording; it does not change during replay.</span>}
            </dd>
          </>
        )}
        {p.contributorShareAtomic && p.platformShareAtomic && (
          <>
            <dt>Split</dt>
            <dd>
              contributor {formatAtomic(p.contributorShareAtomic)} + platform {formatAtomic(p.platformShareAtomic)} = {formatAtomic(p.amountAtomic)}{" "}
              <span className="muted">{p.state === "settled" ? "(accrued, not paid out)" : p.state === "simulated" ? "(simulated: not counted)" : "(not accrued: not settled)"}</span>
            </dd>
          </>
        )}
        {p.reusedCount > 0 && (<><dt>Reused</dt><dd>{p.reusedCount} observed request(s) reused this purchase; last {p.lastReusedAt ? new Date(p.lastReusedAt).toLocaleString() : ""}. No new payment.</dd></>)}
      </dl>
    </div>
  );
}

export function EarningsPanel({ e, recorded }: { e: Earnings | undefined; recorded?: boolean }) {
  if (!e) return null;
  return (
    <section className="card" aria-labelledby="earn-h">
      <h2 id="earn-h">Contributor earnings</h2>
      <p className="small muted">{recorded ? "Ledger snapshot at recording capture (not a replay counter)." : "Ledger totals across all agent purchases on this deployment."}</p>
      {!e.balanced && <p className="state state-error"><strong>Ledger mismatch.</strong> Contributor share plus platform fee don't equal the gross amount.</p>}
      <div className="earn-grid">
        <div><div className="earn-label">Gross (settled testnet sales)</div><div className="earn-value">{formatAtomic(e.grossAtomic)} <span className="small">test USDC</span></div><div className="small muted">{e.testnetSales} sale(s)</div></div>
        <div><div className="earn-label">Contributor accrued (80%)</div><div className="earn-value">{formatAtomic(e.contributorAccruedAtomic)}</div><div className="small muted">owed, not paid out</div></div>
        <div><div className="earn-label">Platform fee (20%)</div><div className="earn-value">{formatAtomic(e.platformFeeAtomic)}</div><div className="small muted">exact integer split</div></div>
        <div><div className="earn-label">Paid out</div><div className="earn-value">{formatAtomic(e.paidOutAtomic)}</div><div className="small muted">payouts are not implemented</div></div>
      </div>
      {e.byGuide.length > 0 && (
        <div className="table-wrap">
          <table className="table small">
            <thead><tr><th>Guide</th><th>Settled sales</th><th>Gross</th><th>Contributor (accrued)</th><th>Platform</th><th>Simulated (not counted)</th></tr></thead>
            <tbody>
              {e.byGuide.map((g) => (
                <tr key={g.resolutionId}>
                  <td>{g.title}</td><td>{g.sales}</td><td>{formatAtomic(g.grossAtomic)}</td><td>{formatAtomic(g.contributorAtomic)}</td><td>{formatAtomic(g.platformAtomic)}</td><td>{g.simulatedSales}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <p className="small muted">
        {e.simulatedSales} simulated purchase(s) ({formatAtomic(e.simulatedGrossAtomic)} USDC simulated) are excluded: no funds moved. Amounts are summed in integer atomic units (1 USDC = 1,000,000).
      </p>
    </section>
  );
}
