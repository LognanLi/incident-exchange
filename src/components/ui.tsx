import { Component, useState, type ReactNode } from "react";
import { ConvexError } from "convex/values";
import { Link } from "react-router-dom";
import {
  EVIDENCE_INFO,
  STATUS_LABELS,
  type DraftStatus,
  type EvidenceLevel,
  type Role,
} from "../../convex/lib/domain";
import { useSession } from "../session";
import { formatPrice } from "../../convex/lib/money";
import { Icon } from "./icons";

export function errorMessage(err: unknown): string {
  if (err instanceof ConvexError) return typeof err.data === "string" ? err.data : JSON.stringify(err.data);
  if (err instanceof Error) {
    // Convex wraps server errors; surface the readable part only.
    const m = err.message.match(/Uncaught (?:ConvexError|Error): (.*?)(?:\n|$)/);
    return m ? m[1] : err.message;
  }
  return "Something went wrong.";
}

/** Run an async action with pending + error state for buttons. */
export function useAction<A extends unknown[], R>(fn: (...args: A) => Promise<R>) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const run = async (...args: A): Promise<R | undefined> => {
    setPending(true);
    setError(null);
    try {
      return await fn(...args);
    } catch (e) {
      setError(errorMessage(e));
      return undefined;
    } finally {
      setPending(false);
    }
  };
  return { run, pending, error, setError };
}

export function Loading({ label = "Loading…" }: { label?: string }) {
  return (
    <div className="state state-loading" role="status" aria-live="polite">
      <span className="spinner" aria-hidden /> {label}
    </div>
  );
}

export function ErrorBox({ message }: { message: string | null | undefined }) {
  if (!message) return null;
  return (
    <div className="state state-error" role="alert">
      <strong>Couldn’t complete that.</strong> {message}
    </div>
  );
}

export function SuccessBox({ children }: { children: ReactNode }) {
  return (
    <div className="state state-success" role="status">
      {children}
    </div>
  );
}

export function Empty({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="state state-empty">
      <strong>{title}</strong>
      {children && <div className="muted">{children}</div>}
    </div>
  );
}

/** Prices are integer atomic units (USDC: 6 decimals) formatted for display only. */
export function Money({ atomic, currency = "USDC" }: { atomic: string; currency?: string }) {
  return <span className="money">{formatPrice(atomic, currency)}</span>;
}

export function EvidenceBadge({ level, explain = false }: { level: EvidenceLevel; explain?: boolean }) {
  const info = EVIDENCE_INFO[level];
  return (
    <span className="evidence-wrap">
      <span className={`badge evidence evidence-${level}`} title={info.explanation}>
        {info.label}
      </span>
      {explain && <span className="evidence-explain">{info.explanation}</span>}
    </span>
  );
}

export function StatusBadge({ status }: { status: DraftStatus }) {
  return <span className={`badge status status-${status}`}>{STATUS_LABELS[status]}</span>;
}

export type IntegrationState = "connected" | "configured" | "demo" | "unavailable" | "error";
const INTEGRATION_LABEL: Record<IntegrationState, string> = {
  connected: "Connected",
  configured: "Configured · unverified",
  demo: "Demo adapter",
  unavailable: "Unavailable",
  error: "Error · fallback",
};
export function IntegrationBadge({ state, name }: { state: IntegrationState; name?: string }) {
  return (
    <span className={`badge integration integration-${state}`}>
      {name ? `${name}: ` : ""}
      {INTEGRATION_LABEL[state]}
    </span>
  );
}

export function Boundary({ kind, children }: { kind: "private" | "public"; children?: ReactNode }) {
  return (
    <div className={`boundary boundary-${kind}`}>
      <span className="boundary-tag">
        <Icon name={kind === "private" ? "lock" : "eye"} size={13} />
        {kind === "private" ? "Private" : "Buyer-visible"}
      </span>
      {children && <span className="boundary-text">{children}</span>}
    </div>
  );
}

export function PageHeader({ title, eyebrow, sub, children }: { title: string; eyebrow?: string; sub?: ReactNode; children?: ReactNode }) {
  return (
    <header className="page-header">
      <div>
        {eyebrow && <div className="eyebrow">{eyebrow}</div>}
        <h1>{title}</h1>
        {sub && <p className="page-sub">{sub}</p>}
      </div>
      {children && <div className="page-actions">{children}</div>}
    </header>
  );
}

const ROLE_NAMES: Record<Role, string> = { contributor: "contributor", buyer: "buyer", reviewer: "reviewer" };

/** Shows a switch prompt instead of the page when the demo identity has the wrong role. */
export function RoleGate({ role, children }: { role: Role; children: ReactNode }) {
  const session = useSession();
  if (!session.orgs) return <Loading />;
  if (session.role === role) return <>{children}</>;
  const slug = session.slugForRole(role);
  const target = session.orgs.find((o) => o.slug === slug);
  return (
    <div className="gate">
      <div className="eyebrow">Wrong role</div>
      <h2>This screen is for the {ROLE_NAMES[role]} role</h2>
      <p className="muted">
        You’re acting as {session.org?.displayName ?? "no one"}
        {session.role ? ` (${session.role})` : ""}.
      </p>
      {target && (
        <button className="btn primary" onClick={() => session.setActor(target.slug)}>
          Switch to {target.displayName} <Icon name="arrow" size={16} className="icon-arrow" />
        </button>
      )}
    </div>
  );
}

type BoundaryState = { error: Error | null };
export class ErrorBoundary extends Component<{ children: ReactNode; resetKey: string }, BoundaryState> {
  state: BoundaryState = { error: null };
  static getDerivedStateFromError(error: Error): BoundaryState {
    return { error };
  }
  componentDidUpdate(prev: { resetKey: string }) {
    if (prev.resetKey !== this.props.resetKey && this.state.error) this.setState({ error: null });
  }
  render() {
    if (this.state.error) {
      return (
        <div className="gate">
          <div className="eyebrow">Error</div>
          <h2>Something went wrong</h2>
          <ErrorBox message={errorMessage(this.state.error)} />
          <p className="row gap wrap">
            <Link className="btn" to="/">
              Home
            </Link>
            <Link className="btn ghost" to="/demo">
              Demo controls
            </Link>
          </p>
        </div>
      );
    }
    return this.props.children;
  }
}

export function formatDate(ms: number): string {
  return new Date(ms).toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" });
}

/** Render "- bullet" text as a list. */
export function BulletText({ text }: { text: string }) {
  const lines = text.split("\n").map((l) => l.trim()).filter(Boolean);
  if (lines.every((l) => l.startsWith("- "))) {
    return (
      <ul className="bullets">
        {lines.map((l, i) => (
          <li key={i}>{l.slice(2)}</li>
        ))}
      </ul>
    );
  }
  return (
    <div className="prose">
      {lines.map((l, i) => (
        <p key={i}>{l.replace(/^- /, "")}</p>
      ))}
    </div>
  );
}
