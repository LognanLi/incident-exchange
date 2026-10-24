import { useQuery } from "convex/react";
import { Link } from "react-router-dom";
import { api } from "../../../convex/_generated/api";
import { useSession } from "../../session";
import { Empty, EvidenceBadge, Loading, PageHeader, RoleGate, StatusBadge, formatDate } from "../../components/ui";

export default function ReviewQueuePage() {
  return (
    <RoleGate role="reviewer">
      <Queue />
    </RoleGate>
  );
}

function Queue() {
  const { actor } = useSession();
  const data = useQuery(api.reviews.queue, { actor });
  if (!data) return <Loading />;
  return (
    <div>
      <PageHeader eyebrow="Reviewer" title="Review queue" sub={`${data.pending.length} waiting`} />
      <section className="card">
        <h2>Waiting</h2>
        {data.pending.length === 0 ? <Empty title="All caught up." /> : <QueueTable rows={data.pending} primary />}
      </section>
      <section className="card">
        <h2>Decided</h2>
        {data.decided.length === 0 ? <p className="muted small">No decisions yet.</p> : <QueueTable rows={data.decided} />}
      </section>
    </div>
  );
}

type Row = {
  _id: string;
  publicTitle: string;
  status: Parameters<typeof StatusBadge>[0]["status"];
  systemCategories: string[];
  highFindings: number;
  evidenceLevel?: Parameters<typeof EvidenceBadge>[0]["level"];
  updatedAt: number;
};

function QueueTable({ rows, primary = false }: { rows: Row[]; primary?: boolean }) {
  return (
    <div className="table-wrap">
    <table className="table">
      <thead>
        <tr>
          <th>Guide</th>
          <th>Status</th>
          <th>Privacy</th>
          <th>Evidence</th>
          <th>Updated</th>
          <th />
        </tr>
      </thead>
      <tbody>
        {rows.map((r) => (
          <tr key={r._id}>
            <td>
              <strong>{r.publicTitle}</strong>
              <div className="small muted">{r.systemCategories.join(" · ")}</div>
            </td>
            <td>
              <StatusBadge status={r.status} />
            </td>
            <td>{r.highFindings === 0 ? <span className="badge ok">Clean</span> : <span className="badge sev-high">{r.highFindings} high</span>}</td>
            <td>{r.evidenceLevel ? <EvidenceBadge level={r.evidenceLevel} /> : <span className="muted">—</span>}</td>
            <td className="small muted">{formatDate(r.updatedAt)}</td>
            <td>
              <Link className={`btn sm ${primary ? "primary" : ""}`} to={`/review/${r._id}`}>
                Open
              </Link>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
    </div>
  );
}
