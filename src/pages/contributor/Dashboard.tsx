import { useQuery } from "convex/react";
import { Link } from "react-router-dom";
import { api } from "../../../convex/_generated/api";
import { useSession } from "../../session";
import { Empty, EvidenceBadge, Loading, Money, PageHeader, RoleGate, StatusBadge, formatDate } from "../../components/ui";

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

  return (
    <div>
      <PageHeader eyebrow={data.org.displayName + " · contributor workspace"} title="My incidents">
        <Link className="btn primary" to="/contribute/new">
          Share an incident
        </Link>
      </PageHeader>

      <div className="stats">
        <div className="stat">
          <span className="stat-label">In progress</span>
          <span className="stat-value">{counts.working}</span>
        </div>
        <div className="stat">
          <span className="stat-label">In review</span>
          <span className="stat-value">{counts.review}</span>
        </div>
        <div className="stat">
          <span className="stat-label">Published</span>
          <span className="stat-value">{counts.published}</span>
        </div>
        <div className="stat earnings">
          <span className="stat-label">Demo earnings (simulated)</span>
          <span className="stat-value">
            <Money minor={data.earningsMinorUnits} currency={data.currency} />
          </span>
          <span className="small muted">
            {data.sales} simulated sale{data.sales === 1 ? "" : "s"} · 80% contributor share (prototype assumption)
          </span>
        </div>
      </div>

      <section className="card">
        <h2>Incident reports</h2>
        {data.drafts.length === 0 ? (
          <Empty title="No incident reports yet">
            <Link to="/contribute/new">Share your first incident</Link>
          </Empty>
        ) : (
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
                    <div className="small muted">Public title: {d.publicTitle || "—"}</div>
                    {d.reviewerNote && <div className="small note">Reviewer: {d.reviewerNote}</div>}
                  </td>
                  <td>
                    <StatusBadge status={d.status} />
                  </td>
                  <td>{d.evidenceLevel ? <EvidenceBadge level={d.evidenceLevel} /> : <span className="muted">—</span>}</td>
                  <td>
                    {d.stats ? (
                      <>
                        {d.stats.sales} · <Money minor={d.stats.earnings} />
                      </>
                    ) : (
                      <span className="muted">—</span>
                    )}
                  </td>
                  <td className="small">{formatDate(d.updatedAt)}</td>
                  <td>
                    <Link className="btn sm" to={nextStepPath(d)}>
                      Open
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      {data.catalog.length > 0 && (
        <section className="card">
          <h2>Previously published guides</h2>
          <ul className="plain-list">
            {data.catalog.map((c) => (
              <li key={c._id}>
                <Link to={`/playbooks/${c._id}`}>{c.publicTitle}</Link>{" "}
                <span className="muted small">
                  · {c.stats.sales} sales · <Money minor={c.stats.earnings} />
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
