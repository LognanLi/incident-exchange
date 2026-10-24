import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { Link } from "react-router-dom";
import { api } from "../../../convex/_generated/api";
import { useSession } from "../../session";
import { Empty, ErrorBox, Loading, PageHeader, RoleGate, formatDate, useAction } from "../../components/ui";
import { Icon } from "../../components/icons";

export default function WatchlistPage() {
  return (
    <RoleGate role="buyer">
      <Watchlist />
    </RoleGate>
  );
}

function Watchlist() {
  const { actor } = useSession();
  const data = useQuery(api.business.listWatches, { actor });
  const add = useAction(useMutation(api.business.addWatch));
  const remove = useAction(useMutation(api.business.removeWatch));
  const markRead = useMutation(api.business.markAlertsRead);
  const [text, setText] = useState("");
  if (!data) return <Loading />;
  return (
    <div>
      <PageHeader eyebrow="Get notified, instantly" title="Alerts" />
      <section className="card">
        <h2>Watch for a problem</h2>
        <p className="muted small">Describe symptoms you are worried about. The moment a guide with overlapping symptoms is published, you’ll see a notification — no refresh needed.</p>
        <form
          className="row gap"
          onSubmit={async (e) => {
            e.preventDefault();
            if (await add.run({ actor, query: text })) setText("");
          }}
        >
          <input className="grow" aria-label="Symptoms to watch for" placeholder="e.g. customers can see another workspace's files" value={text} onChange={(e) => setText(e.target.value)} />
          <button className="btn primary" disabled={add.pending || !text.trim()}>
            <Icon name="bell" /> Add alert
          </button>
        </form>
        <ErrorBox message={add.error ?? remove.error} />
        {data.watches.length === 0 ? (
          <p className="muted small">No alerts yet.</p>
        ) : (
          <ul className="plain-list">
            {data.watches.map((w) => (
              <li key={w._id} className="row gap">
                <Icon name="bell" />
                <span className="grow">{w.query}</span>
                <button className="btn sm ghost" onClick={() => void remove.run({ actor, watchId: w._id })}>
                  Remove
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
      <section className="card">
        <div className="toolbar">
          <h2>Matches</h2>
          {data.alerts.some((a) => !a.read) && (
            <button className="btn sm" onClick={() => void markRead({ actor })}>
              Mark all read
            </button>
          )}
        </div>
        {data.alerts.length === 0 ? (
          <Empty title="No matches yet">When a contributor publishes a guide that fits one of your alerts, it appears here and as a pop-up.</Empty>
        ) : (
          <ul className="plain-list stagger">
            {data.alerts.map((a) => (
              <li key={a._id}>
                {!a.read && <span className="pill">New</span>} <Link to={`/playbooks/${a.playbookId}`}>{a.title}</Link>
                <div className="small muted">
                  {a.relevance} · {a.matchedClues.join("; ")} · {formatDate(a.createdAt)}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
