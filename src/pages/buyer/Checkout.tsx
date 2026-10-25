import { useState } from "react";
import { useAction as useConvexAction, useMutation, useQuery } from "convex/react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { CONTRIBUTOR_SHARE_PERCENT, PLATFORM_SHARE_PERCENT } from "../../../convex/lib/domain";
import { formatAtomic, splitRevenue } from "../../../convex/lib/money";
import { explorerAddressUrl } from "../../../convex/lib/x402";
import { LICENSE_TERMS, LICENSE_VERSION, TLP_INFO } from "../../../convex/lib/license";
import { useSession } from "../../session";
import { Empty, ErrorBox, EvidenceBadge, Loading, Money, PageHeader, RoleGate, useAction } from "../../components/ui";

export default function CheckoutPage() {
  return (
    <RoleGate role="buyer">
      <Checkout />
    </RoleGate>
  );
}

function Checkout() {
  const { playbookId } = useParams();
  const id = playbookId as Id<"playbooks">;
  const { actor } = useSession();
  const navigate = useNavigate();
  const pb = useQuery(api.playbooks.get, { actor, playbookId: id });
  const start = useAction(useMutation(api.purchases.startCheckout));
  const payX402 = useAction(useConvexAction(api.x402Node.payWithX402));
  const reconcile = useAction(useConvexAction(api.x402Node.reconcilePayment));
  const [reconcileMsg, setReconcileMsg] = useState<string | null>(null);
  const options = useQuery(api.purchases.paymentOptions);
  const complete = useAction(useMutation(api.purchases.completeSimulated));
  const cancel = useAction(useMutation(api.purchases.cancel));
  const [purchaseId, setPurchaseId] = useState<Id<"purchases"> | null>(null);
  const purchase = useQuery(api.purchases.get, purchaseId ? { actor, purchaseId } : "skip");
  const [understood, setUnderstood] = useState(false);
  const [license, setLicense] = useState(false);

  if (pb === undefined || options === undefined) return <Loading />;
  if (pb === null) return <Empty title="Guide not found" />;
  if (pb.unlocked && pb.successfulPurchaseId && !purchaseId) {
    return (
      <Empty title="You already unlocked this guide">
        <Link to={`/playbooks/${id}`}>Read it now</Link>
      </Empty>
    );
  }
  const split = splitRevenue(pb.priceAtomic);

  return (
    <div className="checkout">
      <PageHeader eyebrow="Checkout" title="Unlock the full guide" />
      <div className="checkout-grid">
        <section className="card">
          <h2>{pb.publicTitle}</h2>
          <EvidenceBadge level={pb.evidenceLevel} />
          <ul className="unlock-list">
            <li>
              <strong>Check</strong> Evidence to collect, safely
            </li>
            <li>
              <strong>Contain</strong> Limit further harm
            </li>
            <li>
              <strong>Recover</strong> Fix and restore
            </li>
            <li>
              <strong>Verify</strong> Confirm it’s resolved
            </li>
            <li>
              <strong>Q&A</strong> Ask the full guide
            </li>
          </ul>
          <table className="split-table">
            <tbody>
              <tr>
                <td>Price</td>
                <td>
                  <Money atomic={pb.priceAtomic} />
                </td>
              </tr>
              <tr>
                <td>Contributor share ({CONTRIBUTOR_SHARE_PERCENT}%)</td>
                <td>
                  <Money atomic={split.contributorShareAtomic} />
                </td>
              </tr>
              <tr>
                <td>Platform fee ({PLATFORM_SHARE_PERCENT}%)</td>
                <td>
                  <Money atomic={split.platformShareAtomic} />
                </td>
              </tr>
            </tbody>
          </table>
          <p className="small muted">80/20 split is a demo assumption.</p>
        </section>

        {!purchaseId ? (
          <section className={`card ${options.x402Ready ? "x402-card" : "simulator"}`}>
            {options.x402Ready ? (
              <>
                <div className="x402-banner">Coinbase x402 · Base Sepolia testnet</div>
                <p>
                  Pay <strong>
                    <Money atomic={pb.priceAtomic} />
                  </strong>{" "}
                  in test USDC. No real value; capped at 1.00 per payment.
                </p>
              </>
            ) : (
              <>
                <div className="sim-banner">Demo payment — simulated</div>
                <p>x402 isn’t set up here, so this uses a simulator. No money moves.</p>
              </>
            )}
            <div className="license-box">
              <div className="row gap">
                <strong>Data Use License {LICENSE_VERSION}</strong>
                <span className={`tlp tlp-${pb.tlp}`}>{TLP_INFO[pb.tlp].label}</span>
              </div>
              <details>
                <summary>Read terms</summary>
                <ul className="bullets small">
                  {LICENSE_TERMS.map((t) => (
                    <li key={t}>{t}</li>
                  ))}
                </ul>
              </details>
              <label className="check">
                <input type="checkbox" checked={license} onChange={(e) => setLicense(e.target.checked)} />I agree on behalf of my organization.
              </label>
            </div>
            <ErrorBox message={start.error} />
            <button
              className="btn primary block"
              onClick={async () => {
                const pid = await start.run({ actor, playbookId: id, acceptLicense: license });
                if (pid) setPurchaseId(pid);
              }}
              disabled={start.pending || !license}
            >
              {start.pending ? "Starting…" : options.x402Ready ? "Start x402 test checkout" : "Start demo checkout"}
            </button>
            {options.x402Ready && (
              <button
                className="btn block"
                onClick={async () => {
                  const pid = await start.run({ actor, playbookId: id, preference: "demo_simulator", acceptLicense: license });
                  if (pid) setPurchaseId(pid);
                }}
                disabled={start.pending || !license}
              >
                Use simulator instead (no funds move)
              </button>
            )}
          </section>
        ) : !purchase ? (
          <section className="card">
            <Loading />
          </section>
        ) : purchase.provider === "x402_test" && purchase.x402 ? (
          <section className="card x402-card">
            <div className="x402-banner">Coinbase x402 · Base Sepolia testnet</div>
            <table className="split-table">
              <tbody>
                <tr>
                  <td>Test charge</td>
                  <td>
                    <Money atomic={purchase.x402.atomicAmount} /> (test)
                  </td>
                </tr>
                <tr>
                  <td>Network</td>
                  <td>Base Sepolia ({purchase.x402.network})</td>
                </tr>
                <tr>
                  <td>Pays from</td>
                  <td>
                    {options.buyerAddress ? (
                      <a href={explorerAddressUrl(options.buyerAddress)} target="_blank" rel="noreferrer noopener">
                        <code>{options.buyerAddress.slice(0, 8)}…{options.buyerAddress.slice(-6)}</code>
                      </a>
                    ) : (
                      "backend buyer wallet"
                    )}
                  </td>
                </tr>
                <tr>
                  <td>Pays to</td>
                  <td>
                    <a href={explorerAddressUrl(purchase.x402.payTo)} target="_blank" rel="noreferrer noopener">
                      <code>{purchase.x402.payTo.slice(0, 8)}…{purchase.x402.payTo.slice(-6)}</code>
                    </a>
                  </td>
                </tr>
              </tbody>
            </table>
            <p className="small muted">The guide unlocks once the payment settles on-chain.</p>
            {purchase.x402.error && <ErrorBox message={purchase.x402.error} />}
            <ErrorBox message={payX402.error ?? reconcile.error} />
            {purchase.x402.awaitingConfirmation && (
              <div className="state state-info small">
                A payment is already being confirmed. Check its status instead of paying again.{" "}
                <button
                  className="btn sm"
                  disabled={reconcile.pending}
                  onClick={async () => {
                    const r = await reconcile.run({ actor, purchaseId });
                    if (!r) return;
                    if (r.status === "settled" || r.status === "already_done") navigate(`/purchases/${purchaseId}`);
                    else setReconcileMsg(r.status === "still_pending" ? "Still confirming — try again in a minute." : "That payment never went through. You can safely pay now.");
                  }}
                >
                  {reconcile.pending ? "Checking the blockchain…" : "Check payment status"}
                </button>
              </div>
            )}
            {reconcileMsg && <div className="state state-info small">{reconcileMsg}</div>}
            <div className="row gap wrap">
              <button
                className="btn primary"
                disabled={payX402.pending || purchase.x402.awaitingConfirmation}
                onClick={async () => {
                  if (await payX402.run({ actor, purchaseId })) navigate(`/purchases/${purchaseId}`);
                }}
              >
                {payX402.pending ? "Paying on Base Sepolia…" : `Pay ${formatAtomic(purchase.x402.atomicAmount)} test USDC with x402`}
              </button>
              <button
                className="btn ghost"
                disabled={payX402.pending || start.pending}
                onClick={async () => {
                  const pid = await start.run({ actor, playbookId: id, preference: "demo_simulator", acceptLicense: true });
                  if (pid) setPurchaseId(pid);
                }}
              >
                Use simulator instead
              </button>
            </div>
          </section>
        ) : (
          <section className="card simulator">
            <div className="sim-banner">Demo payment — simulated</div>
            <div className="sim-step">
              <p>
                Demo charge: <strong><Money atomic={pb.priceAtomic} /></strong>. No money moves.
              </p>
              <label className="check">
                <input type="checkbox" checked={understood} onChange={(e) => setUnderstood(e.target.checked)} />I understand
                this is a simulated payment and no real funds move.
              </label>
            </div>
            <ErrorBox message={complete.error ?? cancel.error} />
            <div className="row gap">
              <button
                className="btn primary"
                disabled={!understood || complete.pending}
                onClick={async () => {
                  const r = await complete.run({ actor, purchaseId, confirmed: understood });
                  if (r) navigate(`/purchases/${purchaseId}`);
                }}
              >
                {complete.pending ? "Completing…" : "Complete simulated payment"}
              </button>
              <button
                className="btn ghost"
                disabled={cancel.pending}
                onClick={async () => {
                  if (await cancel.run({ actor, purchaseId })) navigate(`/playbooks/${id}`);
                }}
              >
                Cancel
              </button>
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
