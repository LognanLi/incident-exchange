import { useState } from "react";
import { useAction as useConvexAction, useMutation, useQuery } from "convex/react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { CONTRIBUTOR_SHARE_PERCENT, PLATFORM_SHARE_PERCENT } from "../../../convex/lib/domain";
import { splitRevenue } from "../../../convex/lib/money";
import { explorerAddressUrl, testChargeCents } from "../../../convex/lib/x402";
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
  const options = useQuery(api.purchases.paymentOptions);
  const complete = useAction(useMutation(api.purchases.completeSimulated));
  const cancel = useAction(useMutation(api.purchases.cancel));
  const [purchaseId, setPurchaseId] = useState<Id<"purchases"> | null>(null);
  const purchase = useQuery(api.purchases.get, purchaseId ? { actor, purchaseId } : "skip");
  const [understood, setUnderstood] = useState(false);

  if (pb === undefined || options === undefined) return <Loading />;
  if (pb === null) return <Empty title="Playbook not found" />;
  if (pb.unlocked && pb.successfulPurchaseId && !purchaseId) {
    return (
      <Empty title="You already unlocked this playbook">
        <Link to={`/playbooks/${id}`}>Read it now</Link>
      </Empty>
    );
  }
  const split = splitRevenue(pb.priceMinorUnits);

  return (
    <div className="checkout">
      <PageHeader eyebrow="Checkout" title="Unlock detailed playbook" />
      <div className="grid-2 align-start">
        <section className="card">
          <h2>{pb.publicTitle}</h2>
          <EvidenceBadge level={pb.evidenceLevel} explain />
          <h3>What unlocks</h3>
          <ul className="bullets">
            <li>Check — defensive evidence to collect and safe checks</li>
            <li>Contain — steps to limit additional harm</li>
            <li>Recover — corrective and restoration steps</li>
            <li>Verify — a checklist to confirm the issue is resolved</li>
            <li>Grounded Q&A over all six sections</li>
          </ul>
          <table className="split-table">
            <tbody>
              <tr>
                <td>Price</td>
                <td>
                  <Money minor={pb.priceMinorUnits} currency={pb.currency} />
                </td>
              </tr>
              <tr>
                <td>Contributor share ({CONTRIBUTOR_SHARE_PERCENT}%)</td>
                <td>
                  <Money minor={split.contributorShareMinorUnits} currency={pb.currency} />
                </td>
              </tr>
              <tr>
                <td>Platform fee ({PLATFORM_SHARE_PERCENT}%)</td>
                <td>
                  <Money minor={split.platformShareMinorUnits} currency={pb.currency} />
                </td>
              </tr>
            </tbody>
          </table>
          <p className="small muted">Prototype 80/20 split — a demo assumption, not finalized commercial policy.</p>
        </section>

        {!purchaseId ? (
          <section className={`card ${options.x402Ready ? "x402-card" : "simulator"}`}>
            {options.x402Ready ? (
              <>
                <div className="x402-banner">COINBASE x402 · BASE SEPOLIA TESTNET</div>
                <p>
                  Pays with <strong>test USDC</strong> from a backend Coinbase-managed buyer wallet. Test tokens have no
                  real value. Because the faucet hands out small amounts, the test charge is the list price ÷{" "}
                  {options.divisor}: <strong>{(testChargeCents(pb.priceMinorUnits, options.divisor) / 100).toFixed(2)} USDC</strong>.
                </p>
              </>
            ) : (
              <>
                <div className="sim-banner">DEMO PAYMENT — SIMULATED</div>
                <p>
                  Coinbase x402 is not set up on this deployment, so checkout uses a payment <strong>simulator</strong>.
                  No wallet is connected, no funds move, and nothing is settled on any network.
                </p>
              </>
            )}
            <ErrorBox message={start.error} />
            <button
              className="btn primary block"
              disabled={start.pending}
              onClick={async () => {
                const pid = await start.run({ actor, playbookId: id });
                if (pid) setPurchaseId(pid);
              }}
            >
              {start.pending ? "Starting…" : options.x402Ready ? "Start x402 test checkout" : "Start demo checkout"}
            </button>
          </section>
        ) : !purchase ? (
          <section className="card">
            <Loading />
          </section>
        ) : purchase.provider === "x402_test" && purchase.x402 ? (
          <section className="card x402-card">
            <div className="x402-banner">COINBASE x402 · BASE SEPOLIA TESTNET</div>
            <table className="split-table">
              <tbody>
                <tr>
                  <td>Test charge</td>
                  <td>{(purchase.x402.chargeCents / 100).toFixed(2)} USDC (test)</td>
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
            <p className="small muted">
              The backend wallet signs an x402 payment (EIP-3009 authorization); the Coinbase facilitator verifies and
              settles it on Base Sepolia. The guide unlocks only after settlement succeeds.
            </p>
            {purchase.x402.error && <ErrorBox message={purchase.x402.error} />}
            <ErrorBox message={payX402.error} />
            <div className="row gap wrap">
              <button
                className="btn primary"
                disabled={payX402.pending}
                onClick={async () => {
                  if (await payX402.run({ actor, purchaseId })) navigate(`/purchases/${purchaseId}`);
                }}
              >
                {payX402.pending ? "Paying on Base Sepolia…" : `Pay ${(purchase.x402.chargeCents / 100).toFixed(2)} test USDC with x402`}
              </button>
              <button
                className="btn ghost"
                disabled={payX402.pending || start.pending}
                onClick={async () => {
                  const pid = await start.run({ actor, playbookId: id, preference: "demo_simulator" });
                  if (pid) setPurchaseId(pid);
                }}
              >
                Use demo simulator instead
              </button>
            </div>
          </section>
        ) : (
          <section className="card simulator">
            <div className="sim-banner">DEMO PAYMENT — SIMULATED</div>
            <p>
              Payment <strong>simulator</strong>: no wallet is connected, no funds move, and nothing is settled on any
              network.
            </p>
            <div className="sim-step">
              <div className="small muted">Simulator step</div>
              <p>
                Pending demo charge of <Money minor={pb.priceMinorUnits} currency={pb.currency} />.
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
