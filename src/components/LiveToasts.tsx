import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { Link } from "react-router-dom";
import { api } from "../../convex/_generated/api";
import { useSession } from "../session";
import { Icon } from "./icons";

/** Real-time alert toasts (Convex subscription): appears the moment a matching guide is published. */
export function LiveToasts() {
  const { actor, role } = useSession();
  const alerts = useQuery(api.business.unreadAlerts, role === "buyer" ? { actor } : "skip");
  const markRead = useMutation(api.business.markAlertsRead);
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());
  const seen = useRef<Set<string>>(new Set());
  useEffect(() => {
    for (const a of alerts ?? []) seen.current.add(a._id);
  }, [alerts]);
  const visible = (alerts ?? []).filter((a) => !dismissed.has(a._id)).slice(0, 2);
  if (role !== "buyer" || visible.length === 0) return null;
  return (
    <div className="toasts" aria-live="polite">
      {visible.map((a) => (
        <div key={a._id} className="toast">
          <span className="toast-icon">
            <Icon name="bell" />
          </span>
          <div className="toast-body">
            <div className="toast-title">New guide matches your alert</div>
            <div className="toast-text">{a.title}</div>
            <div className="toast-meta">
              {a.relevance} · {a.matchedClues[0]}
            </div>
            <Link
              className="toast-link"
              to={`/playbooks/${a.playbookId}`}
              onClick={() => {
                setDismissed((d) => new Set(d).add(a._id));
                void markRead({ actor });
              }}
            >
              Open preview <Icon name="arrow" size={14} />
            </Link>
          </div>
          <button className="icon-btn" aria-label="Dismiss" onClick={() => setDismissed((d) => new Set(d).add(a._id))}>
            <Icon name="x" size={16} />
          </button>
        </div>
      ))}
    </div>
  );
}
