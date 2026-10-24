import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "../convex/_generated/api";
import type { Role } from "../convex/lib/domain";

type Org = { slug: string; displayName: string; demoRole: Role; description: string };

type Session = {
  actor: string;
  setActor: (slug: string) => void;
  org: Org | undefined;
  orgs: Org[] | undefined;
  role: Role | undefined;
  slugForRole: (role: Role) => string | undefined;
};

const SessionContext = createContext<Session | null>(null);
const STORAGE_KEY = "incident-exchange.actor";

export function SessionProvider({ children }: { children: ReactNode }) {
  const [actor, setActorState] = useState<string>(() => localStorage.getItem(STORAGE_KEY) ?? "northstar");
  const orgs = useQuery(api.demo.listOrgs);
  const ensureSeeded = useMutation(api.demo.ensureSeeded);

  useEffect(() => {
    if (orgs && orgs.length === 0) void ensureSeeded();
  }, [orgs, ensureSeeded]);

  const value = useMemo<Session>(() => {
    const org = orgs?.find((o) => o.slug === actor);
    return {
      actor,
      setActor: (slug) => {
        localStorage.setItem(STORAGE_KEY, slug);
        setActorState(slug);
      },
      org,
      orgs,
      role: org?.demoRole,
      slugForRole: (role) => orgs?.find((o) => o.demoRole === role)?.slug,
    };
  }, [actor, orgs]);

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession(): Session {
  const s = useContext(SessionContext);
  if (!s) throw new Error("useSession must be used inside SessionProvider");
  return s;
}
