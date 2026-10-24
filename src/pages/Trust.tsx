import { PageHeader } from "../components/ui";
import { Icon, type IconName } from "../components/icons";
import { TLP_INFO, LICENSE_TERMS } from "../../convex/lib/license";

const PILLARS: { icon: IconName; title: string; body: string }[] = [
  { icon: "lock", title: "Contributor privacy", body: "Raw notes never leave the contributor's workspace. An automatic privacy check removes identifiers, and the contributor approves the exact text. Buyers see a pseudonym; the platform privately keeps the relationship for review and payouts. Re-identification risk can be reduced, not eliminated." },
  { icon: "shield", title: "Human review & honest evidence", body: "Every guide is reviewed before it is sold. Labels say exactly what backs it: the contributor's account, reviewed evidence, or a fix reproduced on a sample app. AI never certifies safety." },
  { icon: "users", title: "Who can buy", body: "Guides are defensive only. Sensitive guides are labeled TLP:AMBER and sold only to verified organizations. Every purchase includes a Data Use License and is recorded in the audit log." },
  { icon: "coin", title: "Payments", body: "This demo uses test USDC on Base Sepolia via the x402 standard, or a clearly labeled simulator. Access unlocks only after a verified settlement. Contributor earnings are an internal ledger until paid out." },
  { icon: "list", title: "Accountability", body: "Submissions, reviews, publications, purchases, and validation runs are written to an append-only audit log your security team can review." },
  { icon: "flask", title: "Safe testing", body: "Fixes are tested only against bundled sample apps with synthetic data — never against real customer systems or the internet." },
];

export default function Trust() {
  return (
    <div>
      <PageHeader eyebrow="How we keep everyone safe" title="Trust & safety" />
      <div className="grid-3 stagger">
        {PILLARS.map((p) => (
          <section key={p.title} className="card lift">
            <div className="step-icon">
              <Icon name={p.icon} size={20} />
            </div>
            <h3>{p.title}</h3>
            <p className="muted small">{p.body}</p>
          </section>
        ))}
      </div>
      <div className="grid-2">
        <section className="card">
          <h2>Sharing labels (Traffic Light Protocol)</h2>
          <p className="muted small">The standard security teams already use (FIRST TLP 2.0).</p>
          <ul className="plain-list">
            {Object.values(TLP_INFO).map((t) => (
              <li key={t.label}>
                <span className={`tlp tlp-${t.label.split(":")[1].toLowerCase()}`}>{t.label}</span> <span className="small">{t.explanation}</span>
              </li>
            ))}
          </ul>
        </section>
        <section className="card">
          <h2>Data Use License (every purchase)</h2>
          <ol className="bullets small">
            {LICENSE_TERMS.map((t) => (
              <li key={t}>{t}</li>
            ))}
          </ol>
        </section>
      </div>
      <section className="card">
        <h2>Honest limits of this prototype</h2>
        <ul className="bullets small">
          <li>Organization verification is a demo flag; production would verify the business and its domain.</li>
          <li>Legal protections for sharing threat information vary by country and change over time; a real launch needs legal review.</li>
          <li>Matching labels help you find candidates; they are not proof two incidents share a cause.</li>
        </ul>
      </section>
    </div>
  );
}
