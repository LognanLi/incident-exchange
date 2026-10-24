import { useQuery } from "convex/react";
import { Link } from "react-router-dom";
import { api } from "../../../convex/_generated/api";
import { useSession } from "../../session";
import { Empty, Loading, Money, PageHeader, RoleGate, formatDate } from "../../components/ui";

export default function PurchasesPage() {
  return (
    <RoleGate role="buyer">
      <Purchases />
    </RoleGate>
  );
}

function Purchases() {
  const { actor } = useSession();
  const list = useQuery(api.purchases.listMine, { actor });
  if (!list) return <Loading />;
  return (
    <div>
      <PageHeader eyebrow="Unlocked guides and receipts" title="My guides" />
      {list.length === 0 ? (
        <Empty title="No purchases yet">
          <Link to="/playbooks">Find a playbook</Link>
        </Empty>
      ) : (
        <section className="card">
          <table className="table">
            <thead>
              <tr>
                <th>Playbook</th>
                <th>Amount</th>
                <th>Status</th>
                <th>Date</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {list.map((p) => (
                <tr key={p._id}>
                  <td>{p.playbookTitle}</td>
                  <td>
                    <Money atomic={p.amountAtomic} />
                  </td>
                  <td>
                    <span className="badge">{p.paymentStatus.replace("_", " ")}</span>
                    {p.provider === "demo_simulator" && <span className="badge muted-badge">Demo payment</span>}
                    {p.provider === "x402_test" && <span className="badge ok">x402 · Base Sepolia</span>}
                  </td>
                  <td className="small">{formatDate(p.createdAt)}</td>
                  <td>
                    <Link className="btn sm" to={`/purchases/${p._id}`}>
                      Receipt
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}
    </div>
  );
}
