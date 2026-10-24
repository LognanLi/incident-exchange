import { Component, useState, type ReactNode } from "react";
import { ConvexError } from "convex/values";
import { Link } from "react-router-dom";
import {
  EVIDENCE_INFO,
  STATUS_LABELS,
  formatMoney,
  type DraftStatus,
  type EvidenceLevel,
  type Role,
} from "../../convex/lib/domain";
import { useSession } from "../session";

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

export function Money({ minor, currency = "USD" }: { minor: number; currency?: string }) {
  return <span className="money">{formatMoney(minor, currency)}</span>;
}

export function EvidenceBadge({ level, explain = false }: { level: EvidenceLevel; explain?: boolean }) {
  const info = EVIDENCE_INFO[level];
  return (
    <span className="evidence-wrap">
      <span className={`badge evidence evidence-${level}`} title={info.explanation}>
        {level === "test_reproduced" ? "✓ " : level === "evidence_reviewed" ? "◎ " : "○ "}
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
      <span className="boundary-tag">{kind === "private" ? "🔒 Private — only you and reviewers" : "👁 Buyer-visible"}</span>
      {children && <span className="boundary-text">{children}</span>}
    </div>
  );
}

export function PageHeader({ title, eyebrow, children }: { title: string; eyebrow?: string; children?: ReactNode }) {
  return (
    <header className="page-header">
      <div>
        {eyebrow && <div className="eyebrow">{eyebrow}</div>}
        <h1>{title}</h1>
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
    <div className="card gate">
      <h2>This screen is for the {ROLE_NAMES[role]} role</h2>
      <p className="muted">
        You are acting as <strong>{session.org?.displayName ?? "no one"}</strong>
        {session.role ? ` (${session.role})` : ""}. Access is enforced on the server too — switching here only
        changes which fictional demo organization you act as.
      </p>
      {target && (
        <button className="btn primary" onClick={() => session.setActor(target.slug)}>
          Switch to {target.displayName}
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
        <div className="card">
          <ErrorBox message={errorMessage(this.state.error)} />
          <p>
            <Link to="/">Back to home</Link> · <Link to="/demo">Open the demo menu</Link>
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
