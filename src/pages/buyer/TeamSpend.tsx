import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { dollarsToAtomic, formatAtomic } from "../../../convex/lib/money";
import { useSession } from "../../session";
import { ErrorBox, Loading, Money, PageHeader, RoleGate, SuccessBox, formatDate, useAction } from "../../components/ui";
import { Icon } from "../../components/icons";

export default function TeamSpendPage() {
  return (
    <RoleGate role="buyer">
      <TeamSpend />
    </RoleGate>
  );
}

function TeamSpend() {
  const { actor } = useSession();
  const data = useQuery(api.business.teamOverview, { actor });
  const setBudget = useAction(useMutation(api.business.setBudget));
  const [value, setValue] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  if (!data) return <Loading />;
  const spent = BigInt(data.spentThisMonthAtomic);
  const budget = BigInt(data.monthlyBudgetAtomic);
  const pct = budget > 0n ? Number((spent * 100n) / budget) : 0;
  const input = value ?? formatAtomic(data.monthlyBudgetAtomic);
  return (
    <div>
      <PageHeader eyebrow={data.org.displayName} title="Team & budget">
        {data.org.verified && (
          <span className="verified">
            <Icon name="check" size={16} /> Verified organization · {data.org.verifiedDomain}
          </span>
        )}
      </PageHeader>
      <div className="grid-2">
        <section className="card">
          <h2>This month</h2>
          <div className="big-stat stat-num">
            <Money atomic={data.spentThisMonthAtomic} /> <span className="muted small">of</span> <Money atomic={data.monthlyBudgetAtomic} />
          </div>
          <div className="meter" aria-label={`${pct}% of monthly budget used`}>
            <span style={{ width: `${Math.min(pct, 100)}%` }} />
          </div>
          <p className="small muted">Purchases that would go over the budget are blocked until a manager raises it.</p>
        </section>
        <section className="card">
          <h2>Monthly budget</h2>
          <form
            className="row gap"
            onSubmit={async (e) => {
              e.preventDefault();
              setSaved(false);
              const atomic = dollarsToAtomic(input);
              if (atomic === null) return;
              if (await setBudget.run({ actor, monthlyBudgetAtomic: atomic })) setSaved(true);
            }}
          >
            <label className="grow">
              <span className="label">Test USDC per month</span>
              <input inputMode="decimal" value={input} onChange={(e) => setValue(e.target.value)} />
            </label>
            <button className="btn primary" disabled={setBudget.pending || dollarsToAtomic(input) === null}>
              Save
            </button>
          </form>
          <ErrorBox message={setBudget.error} />
          {saved && <SuccessBox>Budget updated and recorded in the audit log.</SuccessBox>}
          <p className="small muted">Coming for Team plans: per-person limits, approval for purchases over a threshold, SSO.</p>
        </section>
      </div>
      <section className="card">
        <h2>Team activity</h2>
        {data.events.length === 0 ? (
          <p className="muted small">No activity yet.</p>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>When</th>
                <th>What</th>
                <th>Item</th>
                <th>Details</th>
              </tr>
            </thead>
            <tbody>
              {data.events.map((e) => (
                <tr key={e._id}>
                  <td className="small">{formatDate(e.at)}</td>
                  <td>
                    <code>{e.action}</code>
                  </td>
                  <td>{e.subject}</td>
                  <td className="small muted">{e.detail}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
}
