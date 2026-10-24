import { useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { useSession } from "../../session";
import { Empty, Loading, PageHeader, RoleGate, formatDate } from "../../components/ui";

export default function AuditLogPage() {
  return (
    <RoleGate role="reviewer">
      <AuditLog />
    </RoleGate>
  );
}

function AuditLog() {
  const { actor } = useSession();
  const events = useQuery(api.business.auditLog, { actor });
  if (!events) return <Loading />;
  const download = () => {
    const rows = [["time", "actor", "action", "subject", "detail"], ...events.map((e) => [new Date(e.at).toISOString(), e.actorName, e.action, e.subject, e.detail ?? ""])];
    const csv = rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = "incident-exchange-audit-log.csv";
    a.click();
    URL.revokeObjectURL(url);
  };
  return (
    <div>
      <PageHeader eyebrow="Append-only record" title="Audit log">
        <button className="btn" onClick={download} disabled={events.length === 0}>
          Export CSV
        </button>
      </PageHeader>
      {events.length === 0 ? (
        <Empty title="No events yet" />
      ) : (
        <section className="card">
          <table className="table">
            <thead>
              <tr>
                <th>When</th>
                <th>Who</th>
                <th>Action</th>
                <th>Item</th>
                <th>Details</th>
              </tr>
            </thead>
            <tbody>
              {events.map((e) => (
                <tr key={e._id}>
                  <td className="small">{formatDate(e.at)}</td>
                  <td>{e.actorName}</td>
                  <td>
                    <code>{e.action}</code>
                  </td>
                  <td>{e.subject}</td>
                  <td className="small muted">{e.detail}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}
    </div>
  );
}
