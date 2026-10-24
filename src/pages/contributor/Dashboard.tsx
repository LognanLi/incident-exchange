import { useQuery } from "convex/react";
import { Link } from "react-router-dom";
import { api } from "../../../convex/_generated/api";
import { useSession } from "../../session";
import { Empty, EvidenceBadge, Loading, Money, PageHeader, RoleGate, StatusBadge, formatDate } from "../../components/ui";
import { Icon } from "../../components/icons";
import { CountUp } from "../../components/motion";

export default function ContributorDashboard() {
  return (
    <RoleGate role="contributor">
      <Dashboard />
    </RoleGate>
  );
}

function nextStepPath(d: { _id: string; status: string }) {
  if (d.status === "draft" || d.status === "changes_requested") return `/contribute/drafts/${d._id}/playbook`;
  return `/contribute/drafts/${d._id}/status`;
}

function Dashboard() {
  const { actor } = useSession();
  const data = useQuery(api.drafts.listMine, { actor });
  if (!data) return <Loading />;

  const counts = {
    working: data.drafts.filter((d) => d.status === "draft" || d.status === "changes_requested").length,
    review: data.drafts.filter((d) => d.status === "submitted" || d.status === "approved").length,
    published: data.drafts.filter((d) => d.status === "published").length + data.catalog.length,
  };

  const simulated = BigInt(data.simulatedAccruedAtomic ?? "0");

  return (
    <div>
      <PageHeader eyebrow={data.org.displayName} title="My incidents">
        <Link className="btn primary" to="/contribute/new">
          <Icon name="plus" size={16} /> Share an incident
        </Link>
      </PageHeader>

      <div className="stats stagger">
        <div className="stat">
          <span className="stat-label">In progress</span>
          <span className="stat-value">
            <CountUp to={counts.working} />
          </span>
        </div>
        <div className="stat">
          <span className="stat-label">In review</span>
          <span className="stat-value">
            <CountUp to={counts.review} />
          </span>
        </div>
        <div className="stat">
          <span className="stat-label">Published</span>
          <span className="stat-value">
            <CountUp to={counts.published} />
          </span>
        </div>
        <div className="stat earnings">
          <span className="stat-label">Earned</span>
          <span className="stat-value">
            <Money atomic={data.accruedAtomic} currency={data.currency} />
          </span>
          <span className="small muted" title="Accrued from settled test payments; nothing is paid out in this prototype.">
            {data.sales} sale{data.sales === 1 ? "" : "s"} · 80% share · not paid out
          </span>
          {simulated > 0n && (
            <span className="small muted">
              +<Money atomic={data.simulatedAccruedAtomic} currency={data.currency} /> simulated, not counted
            </span>
          )}
        </div>
      </div>

      <section className="card">
        <h2>Incidents</h2>
        {data.drafts.length === 0 ? (
          <Empty title="Nothing shared yet">
            <Link to="/contribute/new">Share your first incident</Link>
          </Empty>
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Incident</th>
                  <th>Status</th>
                  <th>Evidence</th>
                  <th>Sales</th>
                  <th>Updated</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {data.drafts.map((d) => (
                  <tr key={d._id}>
                    <td>
                      <strong>{d.title}</strong>
                      {d.publicTitle && d.publicTitle !== d.title && <div className="small muted">Public: {d.publicTitle}</div>}
                      {d.reviewerNote && <div className="small note">Reviewer: {d.reviewerNote}</div>}
                    </td>
                    <td>
                      <StatusBadge status={d.status} />
                    </td>
                    <td>{d.evidenceLevel ? <EvidenceBadge level={d.evidenceLevel} /> : <span className="muted">—</span>}</td>
                    <td>
                      {d.stats ? (
                        <>
                          {d.stats.sales} · <Money atomic={d.stats.accruedAtomic} />
                          {d.stats.outcomes.count > 0 && (
                            <div className="small muted">
                              {d.stats.outcomes.resolved}/{d.stats.outcomes.count} resolved
                            </div>
                          )}
                        </>
                      ) : (
                        <span className="muted">—</span>
                      )}
                    </td>
                    <td className="small muted">{formatDate(d.updatedAt)}</td>
                    <td>
                      <Link className="btn sm" to={nextStepPath(d)}>
                        Open
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {data.catalog.length > 0 && (
        <section className="card">
          <h2>Published earlier</h2>
          <ul className="plain-list">
            {data.catalog.map((c) => (
              <li key={c._id} className="row gap wrap">
                <Link className="grow" to={`/playbooks/${c._id}`}>{c.publicTitle}</Link>
                <span className="muted small">
                  {c.stats.sales} {c.stats.sales === 1 ? "sale" : "sales"}{c.stats.testnetSales < c.stats.sales ? ` (${c.stats.sales - c.stats.testnetSales} simulated)` : ""} · <Money atomic={c.stats.accruedAtomic} />
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
