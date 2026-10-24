import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { Link, useLocation } from "react-router-dom";
import { api } from "../../convex/_generated/api";
import { useSession } from "../session";
import { Icon } from "./icons";

const DISMISSED_KEY = "incident-exchange.dismissed-alerts";

/** Real-time alert toasts (Convex subscription): appears the moment a matching guide is published. */
export function LiveToasts() {
  const { actor, role } = useSession();
  const alerts = useQuery(api.business.unreadAlerts, role === "buyer" ? { actor } : "skip");
  const markRead = useMutation(api.business.markAlertsRead);
  const { pathname } = useLocation();
  // Dismissals persist across reloads so an alert doesn't keep coming back over the page.
  const [dismissed, setDismissedState] = useState<Set<string>>(() => {
    try {
      return new Set(JSON.parse(localStorage.getItem(DISMISSED_KEY) ?? "[]") as string[]);
    } catch {
      return new Set();
    }
  });
  const setDismissed = (update: (d: Set<string>) => Set<string>) =>
    setDismissedState((d) => {
      const next = update(d);
      localStorage.setItem(DISMISSED_KEY, JSON.stringify([...next].slice(-200)));
      return next;
    });
  const seen = useRef<Set<string>>(new Set());
  useEffect(() => {
    for (const a of alerts ?? []) seen.current.add(a._id);
  }, [alerts]);
  // One toast per guide (several saved alerts can match the same guide), never over checkout or payment screens.
  const perGuide = new Map<string, NonNullable<typeof alerts>[number]>();
  for (const a of alerts ?? []) if (!dismissed.has(a._id) && !perGuide.has(a.playbookId)) perGuide.set(a.playbookId, a);
  const visible = [...perGuide.values()].slice(0, 1);
  const sameGuide = (playbookId: string) => (alerts ?? []).filter((x) => x.playbookId === playbookId).map((x) => x._id);
  if (role !== "buyer" || visible.length === 0 || /\/(checkout|purchases)/.test(pathname)) return null;
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
                setDismissed((d) => new Set([...d, ...sameGuide(a.playbookId)]));
                void markRead({ actor });
              }}
            >
              Open preview <Icon name="arrow" size={14} />
            </Link>
          </div>
          <button className="icon-btn" aria-label="Dismiss" onClick={() => setDismissed((d) => new Set([...d, ...sameGuide(a.playbookId)]))}>
            <Icon name="x" size={16} />
          </button>
        </div>
      ))}
    </div>
  );
}
