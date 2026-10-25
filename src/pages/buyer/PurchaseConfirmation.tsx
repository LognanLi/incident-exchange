import { useQuery } from "convex/react";
import { Link, useParams } from "react-router-dom";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { CONTRIBUTOR_SHARE_PERCENT, PLATFORM_SHARE_PERCENT } from "../../../convex/lib/domain";
import { useSession } from "../../session";
import { explorerAddressUrl, explorerTxUrl } from "../../../convex/lib/x402";
import { Empty, Loading, Money, PageHeader, RoleGate, formatDate } from "../../components/ui";
import { Icon } from "../../components/icons";

const STATUS_TEXT = {
  pending: "Pending",
  simulated_success: "Simulated — no money moved",
  test_success: "x402 test payment settled on Base Sepolia",
  cancelled: "Cancelled",
  failed: "Payment failed — no money moved",
} as const;

export default function PurchaseConfirmationPage() {
  return (
    <RoleGate role="buyer">
      <PurchaseConfirmation />
    </RoleGate>
  );
}

function PurchaseConfirmation() {
  const { purchaseId } = useParams();
  const { actor } = useSession();
  const p = useQuery(api.purchases.get, { actor, purchaseId: purchaseId as Id<"purchases"> });
  if (p === undefined) return <Loading />;
  if (p === null) return <Empty title="Purchase not found" />;
  const ok = p.paymentStatus === "simulated_success" || p.paymentStatus === "test_success";

  return (
    <div className="confirmation">
      <PageHeader eyebrow="Receipt" title={ok ? "Guide unlocked" : "Purchase not completed"}>
        <Link className="btn primary" to={`/playbooks/${p.playbookId}`}>
          {ok ? "Read the guide" : "Back to the guide"} <Icon name="arrow" size={16} className="icon-arrow" />
        </Link>
      </PageHeader>
      <section className="card receipt">
        {p.provider === "demo_simulator" && <div className="sim-banner">Demo payment — simulated</div>}
        {p.provider === "x402_test" && <div className="x402-banner">Coinbase x402 · Base Sepolia testnet</div>}
        <h2>{p.playbookTitle}</h2>
        <table className="split-table">
          <tbody>
            <tr>
              <td>Status</td>
              <td>
                <span className={`badge ${ok ? "ok" : "warn"}`}>{STATUS_TEXT[p.paymentStatus]}</span>
              </td>
            </tr>
            <tr>
              <td>Provider</td>
              <td>{p.provider === "demo_simulator" ? "Simulator" : "Coinbase x402 · Base Sepolia"}</td>
            </tr>
            <tr>
              <td>Amount</td>
              <td>
                <Money atomic={p.amountAtomic} />
              </td>
            </tr>
            <tr>
              <td>Contributor ({CONTRIBUTOR_SHARE_PERCENT}%{p.paymentStatus === "test_success" ? ", accrued, not paid out" : p.paymentStatus === "simulated_success" ? ", simulated — not counted" : ""})</td>
              <td>
                <Money atomic={p.contributorShareAtomic} /> to {p.contributorAlias}
              </td>
            </tr>
            <tr>
              <td>Platform fee ({PLATFORM_SHARE_PERCENT}%)</td>
              <td>
                <Money atomic={p.platformShareAtomic} />
              </td>
            </tr>
            {p.x402 && p.paymentStatus === "test_success" && (
              <>
                <tr>
                  <td>Settled on-chain</td>
                  <td>
                    <Money atomic={p.x402.atomicAmount} /> (test) on Base Sepolia
                  </td>
                </tr>
                {p.x402.txHash && (
                  <tr>
                    <td>Transaction</td>
                    <td>
                      <a href={explorerTxUrl(p.x402.txHash)} target="_blank" rel="noreferrer noopener">
                        <code>{p.x402.txHash.slice(0, 10)}…{p.x402.txHash.slice(-8)}</code> ↗
                      </a>
                    </td>
                  </tr>
                )}
                {p.x402.payer && (
                  <tr>
                    <td>Payer wallet</td>
                    <td>
                      <a href={explorerAddressUrl(p.x402.payer)} target="_blank" rel="noreferrer noopener">
                        <code>{p.x402.payer.slice(0, 8)}…{p.x402.payer.slice(-6)}</code>
                      </a>
                    </td>
                  </tr>
                )}
              </>
            )}
            <tr>
              <td>Reference</td>
              <td>
                <code>{p.transactionReference}</code>
              </td>
            </tr>
            <tr>
              <td>Revision purchased</td>
              <td>{p.revision}</td>
            </tr>
            <tr>
              <td>Created</td>
              <td>{formatDate(p.createdAt)}</td>
            </tr>
            {p.completedAt && (
              <tr>
                <td>Completed</td>
                <td>{formatDate(p.completedAt)}</td>
              </tr>
            )}
          </tbody>
        </table>
        {p.x402 && p.paymentStatus === "test_success" && <p className="small muted">The full test charge settles to the platform; the 80/20 split is tracked internally.</p>}
        {ok && (
          <Link className="arrow-link" to={`/playbooks/${p.playbookId}/feedback`}>
            Report your outcome <Icon name="arrow" size={14} />
          </Link>
        )}
      </section>
    </div>
  );
}
