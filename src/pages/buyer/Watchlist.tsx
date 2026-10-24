import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { Link } from "react-router-dom";
import { api } from "../../../convex/_generated/api";
import { useSession } from "../../session";
import { ErrorBox, Loading, PageHeader, RoleGate, formatDate, useAction } from "../../components/ui";
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
      <PageHeader eyebrow="Alerts" title="Get told when a fix appears." />
      <section className="card watch-form">
        <form
          className="search-row"
          onSubmit={async (e) => {
            e.preventDefault();
            if (await add.run({ actor, query: text })) setText("");
          }}
        >
          <Icon name="bell" size={20} />
          <input className="grow" aria-label="Symptoms to watch for" placeholder="e.g. customers can see another workspace’s files" value={text} onChange={(e) => setText(e.target.value)} />
          <button className="btn primary" disabled={add.pending || !text.trim()}>
            Add alert
          </button>
        </form>
        <ErrorBox message={add.error ?? remove.error} />
      </section>
      <div className="grid-2">
        <section className="card">
          <h2>Watching</h2>
          {data.watches.length === 0 ? (
            <p className="muted small">Nothing yet.</p>
          ) : (
            <ul className="plain-list stagger">
              {data.watches.map((w) => (
                <li key={w._id} className="row gap">
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
              <button className="btn sm ghost" onClick={() => void markRead({ actor })}>
                Mark all read
              </button>
            )}
          </div>
          {data.alerts.length === 0 ? (
            <p className="muted small">No matches yet.</p>
          ) : (
            <ul className="plain-list stagger">
              {data.alerts.map((a) => (
                <li key={a._id}>
                  {!a.read && <span className="dot good" role="img" aria-label="New" />}
                  <Link to={`/playbooks/${a.playbookId}`}>{a.title}</Link>
                  <div className="small muted">
                    {a.relevance} · {a.matchedClues.join("; ")} · {formatDate(a.createdAt)}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
