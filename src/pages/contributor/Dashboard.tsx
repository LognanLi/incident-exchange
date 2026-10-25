import { useQuery } from "convex/react";
import { Link } from "react-router-dom";
import { api } from "../../../convex/_generated/api";
import { useSession } from "../../session";
import { Empty, EvidenceBadge, Loading, Money, PageHeader, RoleGate, StatusBadge, formatDate } from "../../components/ui";
import { Icon } from "../../components/icons";
import { CountUp } from "../../components/motion";
import { CONTRIBUTOR_SHARE_PERCENT } from "../../../convex/lib/domain";

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
  const allStats = [...data.drafts.map((d) => d.stats), ...data.catalog.map((c) => c.stats)].filter((x): x is NonNullable<typeof x> => !!x);
  const testnetSales = allStats.reduce((n, x) => n + x.testnetSales, 0);
  const simulatedSales = Math.max(0, data.sales - testnetSales);

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
      </div>
      <section className="earn-split" aria-label="Earnings">
        <div>
          <span className="stat-label">Accrued (owed, not paid out)</span>
          <span className="stat-value">
            <Money atomic={data.accruedAtomic} currency={data.currency} />
          </span>
          <span className="small muted">
            Your {CONTRIBUTOR_SHARE_PERCENT}% share of {testnetSales} settled x402 testnet sale{testnetSales === 1 ? "" : "s"} (test USDC)
          </span>
        </div>
        <div>
          <span className="stat-label">Paid out</span>
          <span className="stat-value">
            <Money atomic={data.paidOutAtomic} currency={data.currency} />
          </span>
          <span className="small muted">Payouts are not implemented in this prototype.</span>
        </div>
        <div>
          <span className="stat-label">Simulated sales (not counted)</span>
          <span className="stat-value">{simulatedSales}</span>
          <span className="small muted">
            {simulated > 0n ? (
              <>
                <Money atomic={data.simulatedAccruedAtomic} currency={data.currency} /> share, no funds moved
              </>
            ) : (
              "No funds move in simulated sales."
            )}
          </span>
        </div>
      </section>

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
                  <th>Testnet sales · accrued</th>
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
                          {d.stats.testnetSales} · <Money atomic={d.stats.accruedAtomic} /> accrued
                          {d.stats.sales > d.stats.testnetSales && <div className="small muted">+{d.stats.sales - d.stats.testnetSales} simulated, not counted</div>}
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
                  {c.stats.testnetSales} testnet {c.stats.testnetSales === 1 ? "sale" : "sales"} · <Money atomic={c.stats.accruedAtomic} /> accrued{c.stats.testnetSales < c.stats.sales ? ` · ${c.stats.sales - c.stats.testnetSales} simulated, not counted` : ""}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
