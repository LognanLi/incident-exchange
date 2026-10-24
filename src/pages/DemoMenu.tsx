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
      <PageHeader eyebrow="Demo operator — not part of the production product" title="Demo menu" />

      <section className="card">
        <h2>Switch demo identity</h2>
        <p className="muted">
          A simple identity switcher replaces real sign-in for this demo. Every backend function re-checks the role of
          the organization you act as.
        </p>
        {!session.orgs ? (
          <Loading />
        ) : (
          <div className="org-grid">
            {session.orgs.map((o) => (
              <button
                key={o.slug}
                className={`org-card ${session.actor === o.slug ? "selected" : ""}`}
                onClick={() => {
                  session.setActor(o.slug);
                  navigate(ROLE_HOME[o.demoRole]);
                }}
                aria-pressed={session.actor === o.slug}
              >
                <span className={`role-chip role-${o.demoRole}`}>{o.demoRole}</span>
                <strong>{o.displayName}</strong>
                <span className="fictional">Fictional</span>
                <span className="muted small">{o.description}</span>
              </button>
            ))}
          </div>
        )}
      </section>

      <section className="card">
        <h2>Reset demo data</h2>
        <p className="muted">
          Restores the seeded organizations, Northstar Cloud’s draft incident, the background catalog, and the
          misconfigured local demo target. Deletes only records marked as demo data.
        </p>
        <button
          className="btn danger"
          disabled={resetAction.pending}
          onClick={async () => {
            setResetDone(false);
            const r = await resetAction.run({});
            if (r) {
              setResetDone(true);
              session.setActor("northstar");
            }
          }}
        >
          {resetAction.pending ? "Resetting…" : "Reset demo data"}
        </button>
        <ErrorBox message={resetAction.error} />
        {resetDone && <SuccessBox>Demo data restored. You are now acting as Northstar Cloud.</SuccessBox>}
      </section>

      <section className="card">
        <h2>Validation scenario</h2>
        <p className="muted">
          The validation panel lives on each draft in the reviewer console. After Northstar submits its report, switch
          to the Review Desk and open it from the <Link to="/review">review queue</Link>.
        </p>
      </section>

      <section className="card">
        <h2>Sponsor integration status</h2>
        {!integrations ? (
          <Loading />
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>Integration</th>
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
        )}
      </section>

      <section className="card">
        <h2>Three-minute demo script</h2>
        <ol className="script">
          <li>
            <strong>Contributor (Northstar Cloud):</strong> My incidents → open the seeded draft → Playbook → “Draft
            with Moss” (labeled fallback) → Accept all → Privacy → Run scan → Apply all generalizations → approve &
            submit.
          </li>
          <li>
            <strong>Reviewer (Review Desk):</strong> open the draft → Fetch references → run check (fails) → apply fix →
            re-run check (passes) → tick checklist → approve as “Test reproduced”.
          </li>
          <li>
            <strong>Contributor:</strong> Status → give final approval to publish.
          </li>
          <li>
            <strong>Buyer (Harbor Analytics):</strong> search “repeated authentication failures after a deployment” →
            open the guide → buy with Demo payment → read steps → submit feedback.
          </li>
          <li>
            <strong>Reviewer:</strong> Buyer feedback shows the outcome.
          </li>
        </ol>
      </section>
    </div>
  );
}
