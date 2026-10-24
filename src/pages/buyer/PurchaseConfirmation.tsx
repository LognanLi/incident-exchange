import { useQuery } from "convex/react";
import { Link, useParams } from "react-router-dom";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { CONTRIBUTOR_SHARE_PERCENT, PLATFORM_SHARE_PERCENT } from "../../../convex/lib/domain";
import { useSession } from "../../session";
import { explorerAddressUrl, explorerTxUrl } from "../../../convex/lib/x402";
import { Empty, Loading, Money, PageHeader, RoleGate, formatDate } from "../../components/ui";

const STATUS_TEXT = {
  pending: "Pending — simulator step not completed",
  simulated_success: "Simulated payment completed — no funds moved",
  test_success: "x402 test payment settled on Base Sepolia (test USDC, no real value)",
  cancelled: "Cancelled",
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
      <PageHeader eyebrow="Purchase confirmation" title={ok ? "Playbook unlocked" : "Purchase not completed"} />
      <section className="card receipt">
        {p.provider === "demo_simulator" && <div className="sim-banner">DEMO PAYMENT — SIMULATED · NOT SETTLED</div>}
        {p.provider === "x402_test" && <div className="x402-banner">COINBASE x402 · BASE SEPOLIA TESTNET · TEST USDC</div>}
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
              <td>{p.provider === "demo_simulator" ? "Demo payment simulator" : "Coinbase x402 · CDP server wallet · Base Sepolia"}</td>
            </tr>
            <tr>
              <td>{p.x402 ? "List price" : "Amount"}</td>
              <td>
                <Money minor={p.amountMinorUnits} currency={p.currency} />
              </td>
            </tr>
            <tr>
              <td>Contributor share ({CONTRIBUTOR_SHARE_PERCENT}%)</td>
              <td>
                <Money minor={p.contributorShareMinorUnits} currency={p.currency} /> to {p.contributorAlias}
              </td>
            </tr>
            <tr>
              <td>Platform fee ({PLATFORM_SHARE_PERCENT}%)</td>
              <td>
                <Money minor={p.platformShareMinorUnits} currency={p.currency} />
              </td>
            </tr>
            {p.x402 && (
              <>
                <tr>
                  <td>Settled on-chain</td>
                  <td>{(p.x402.chargeCents / 100).toFixed(2)} test USDC (list price scaled for the testnet faucet)</td>
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
        {p.x402 && (
          <p className="small muted">
            On-chain, the full test charge goes to the platform receiver wallet. The 80/20 contributor/platform split above
            is the app's demo accounting on the list price; contributor payouts are not sent on-chain in this prototype.
          </p>
        )}
        <div className="row gap">
          <Link className="btn primary" to={`/playbooks/${p.playbookId}`}>
            {ok ? "Read the playbook" : "Back to playbook"}
          </Link>
          {ok && (
            <Link className="btn" to={`/playbooks/${p.playbookId}/feedback`}>
              Report your outcome
            </Link>
          )}
        </div>
      </section>
    </div>
  );
}
