import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "../convex/_generated/api";
import type { Role } from "../convex/lib/domain";

type Org = { slug: string; displayName: string; demoRole: Role; description: string };

type Session = {
  /** Signed demo session token for the current org. Pass this as `actor` to Convex functions. */
  actor: string;
  /** The current org's slug (for display and comparisons only; the backend does not trust it). */
  slug: string;
  setActor: (slug: string) => void;
  /** Signed token for another org (e.g. the guided tour reading the contributor's drafts). */
  actorFor: (slug: string) => string;
  org: Org | undefined;
  orgs: Org[] | undefined;
  role: Role | undefined;
  slugForRole: (role: Role) => string | undefined;
};

const SessionContext = createContext<Session | null>(null);
const STORAGE_KEY = "incident-exchange.actor";
const RUNNER_URL = (import.meta.env.VITE_FACTORY_RUNNER_URL as string | undefined) ?? "http://127.0.0.1:3299";

export function SessionProvider({ children }: { children: ReactNode }) {
  const [slug, setSlug] = useState<string>(() => {
    const saved = localStorage.getItem(STORAGE_KEY) ?? "";
    return /^[a-z0-9-]{2,40}$/.test(saved) ? saved : "northstar";
  });
  const [tokens, setTokens] = useState<Record<string, string> | null>(null);
  const [offline, setOffline] = useState(false);
  const orgs = useQuery(api.demo.listOrgs);
  const ensureSeeded = useMutation(api.demo.ensureSeeded);

  useEffect(() => {
    if (orgs && orgs.length === 0) void ensureSeeded();
  }, [orgs, ensureSeeded]);

  // Demo sessions are minted by the local runner (it holds DEMO_SESSION_SECRET); the browser never sees the secret.
  const slugKey = orgs?.map((o) => o.slug).join(",");
  useEffect(() => {
    if (!slugKey) return;
    let cancelled = false;
    const load = () =>
      fetch(`${RUNNER_URL}/session`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ slugs: slugKey.split(",") }) })
        .then((r) => (r.ok ? (r.json() as Promise<{ tokens: Record<string, string> }>) : Promise.reject(new Error(String(r.status)))))
        .then((b) => {
          if (cancelled) return;
          setTokens(b.tokens);
          setOffline(false);
        })
        .catch(() => !cancelled && setOffline(true));
    void load();
    const refresh = setInterval(load, 6 * 3600_000);
    return () => {
      cancelled = true;
      clearInterval(refresh);
    };
  }, [slugKey]);

  const value = useMemo<Session>(() => {
    const org = orgs?.find((o) => o.slug === slug);
    return {
      actor: tokens?.[slug] ?? "",
      slug,
      setActor: (next) => {
        localStorage.setItem(STORAGE_KEY, next);
        setSlug(next);
      },
      actorFor: (s) => tokens?.[s] ?? "",
      org,
      orgs,
      role: org?.demoRole,
      slugForRole: (role) => orgs?.find((o) => o.demoRole === role)?.slug,
    };
  }, [slug, orgs, tokens]);

  if (!tokens) {
    return (
      <div className="session-gate" role="status">
        {offline ? (
          <p>
            Can’t start a demo session. Start the local services with <code>npm run dev</code>, then reload.
          </p>
        ) : (
          <p className="muted">Connecting…</p>
        )}
      </div>
    );
  }
  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession(): Session {
  const s = useContext(SessionContext);
  if (!s) throw new Error("useSession must be used inside SessionProvider");
  return s;
}
