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
      <PageHeader eyebrow="Purchases" title="My guides" />
      {list.length === 0 ? (
        <Empty title="Nothing unlocked yet">
          <Link to="/playbooks">Find a fix</Link>
        </Empty>
      ) : (
        <section className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Guide</th>
                <th>Amount</th>
                <th>Status</th>
                <th>Date</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {list.map((p) => (
                <tr key={p._id}>
                  <td>
                    <Link to={`/playbooks/${p.playbookId}`}>{p.playbookTitle}</Link>
                  </td>
                  <td>
                    <Money atomic={p.amountAtomic} />
                  </td>
                  <td>
                    <span className={`badge ${p.paymentStatus.endsWith("success") ? "ok" : p.paymentStatus === "pending" ? "warn" : ""}`}>
                      {p.paymentStatus === "simulated_success" ? "Simulated" : p.paymentStatus === "test_success" ? "Paid · x402" : p.paymentStatus.charAt(0).toUpperCase() + p.paymentStatus.slice(1).replace(/_/g, " ")}
                    </span>
                  </td>
                  <td className="small">{formatDate(p.createdAt)}</td>
                  <td>
                    <Link className="btn sm ghost" to={`/purchases/${p._id}`}>
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
