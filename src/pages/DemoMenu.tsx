import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { Link, useNavigate } from "react-router-dom";
import { api } from "../../convex/_generated/api";
import { useSession } from "../session";
import { ErrorBox, IntegrationBadge, Loading, PageHeader, SuccessBox, useAction } from "../components/ui";

const ROLE_HOME = { contributor: "/contribute", reviewer: "/review", buyer: "/playbooks" } as const;

export default function DemoMenu() {
  const session = useSession();
  const navigate = useNavigate();
  const integrations = useQuery(api.integrations.status);
  const reset = useMutation(api.demo.reset);
  const resetAction = useAction(reset);
  const [resetDone, setResetDone] = useState(false);

  return (
    <div className="demo-menu">
      <PageHeader eyebrow="Demo controls" title="Choose who you are" sub="Fictional companies. Pick one to act as." />

      <section className="card">
        {!session.orgs ? (
          <Loading />
        ) : (
          <div className="org-grid stagger">
            {session.orgs.map((o) => (
              <button
                key={o.slug}
                className={`org-card ${session.slug === o.slug ? "selected" : ""}`}
                onClick={() => {
                  session.setActor(o.slug);
                  navigate(ROLE_HOME[o.demoRole]);
                }}
                aria-pressed={session.slug === o.slug}
              >
                <span className={`role-chip role-${o.demoRole}`}>{o.demoRole}</span>
                <strong>{o.displayName}</strong>
                <span className="muted small">{o.description}</span>
              </button>
            ))}
          </div>
        )}
      </section>

      <div className="grid-2">
        <section className="card">
          <h2>Guided tour</h2>
          <p className="small muted">Step-by-step presenter script that switches roles for you.</p>
          <button className="btn" onClick={() => window.dispatchEvent(new Event("ix:open-tour"))}>
            Start tour
          </button>
        </section>

        <section className="card">
          <h2>Reset demo data</h2>
          <p className="small muted">Restores seeded companies and drafts. Deletes only demo records.</p>
          <button
            className="btn danger"
            disabled={resetAction.pending}
            onClick={async () => {
              setResetDone(false);
              const r = await resetAction.run({ actor: session.actor });
              if (r) {
                setResetDone(true);
                session.setActor("northstar");
              }
            }}
          >
            {resetAction.pending ? "Resetting…" : "Reset demo data"}
          </button>
          <ErrorBox message={resetAction.error} />
          {resetDone && <SuccessBox>Demo data restored. You’re now Northstar Cloud.</SuccessBox>}
        </section>
      </div>

      <section className="card">
        <h2>Integrations</h2>
        {!integrations ? (
          <Loading />
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Service</th>
                  <th>Used for</th>
                  <th>Status</th>
                  <th>Detail</th>
                </tr>
              </thead>
              <tbody>
                {integrations.map((i) => (
                  <tr key={i.key}>
                    <td>
                      <strong>{i.name}</strong>
                    </td>
                    <td>{i.role}</td>
                    <td>
                      <IntegrationBadge state={i.state} />
                    </td>
                    <td className="muted small">{i.detail}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="card">
        <h2>Three-minute script</h2>
        <ol className="script">
          <li>
            <strong>Northstar Cloud</strong> · open the seeded draft → Draft with Moss → Accept all → Privacy → Run scan →
            Apply all → approve & submit.
          </li>
          <li>
            <strong>Review Desk</strong> · open the draft → Fetch references → Run check (fails) → apply fix → re-check
            (passes) → checklist → approve as “Test reproduced”.
          </li>
          <li>
            <strong>Northstar Cloud</strong> · Status → final approval → publish.
          </li>
          <li>
            <strong>Harbor Analytics</strong> · search “repeated authentication failures after a deployment” → open guide →
            pay → read steps → report outcome.
          </li>
          <li>
            <strong>Review Desk</strong> · Outcomes shows the result. The validation panel lives on each draft in the{" "}
            <Link to="/review">review queue</Link>.
          </li>
        </ol>
      </section>
    </div>
  );
}
