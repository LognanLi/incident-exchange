import { PageHeader } from "../components/ui";
import { Icon, type IconName } from "../components/icons";
import { TLP_INFO, LICENSE_TERMS } from "../../convex/lib/license";

const PILLARS: { icon: IconName; title: string; body: string }[] = [
  { icon: "lock", title: "Contributor privacy", body: "Raw notes never leave the contributor. A privacy scan removes identifiers and buyers see a pseudonym. Risk is reduced, not eliminated." },
  { icon: "shield", title: "Human review", body: "Every guide is reviewed before sale. Labels state exactly what backs it. AI never certifies safety." },
  { icon: "users", title: "Who can buy", body: "Defensive guides only. Sensitive guides (TLP:AMBER) are sold only to verified organizations." },
  { icon: "coin", title: "Payments", body: "Test USDC on Base Sepolia via x402, or a labeled simulator. Access unlocks only after payment settles." },
  { icon: "list", title: "Audit trail", body: "Submissions, reviews, purchases, and test runs go to an append-only log." },
  { icon: "flask", title: "Safe testing", body: "Fixes are tested only on bundled sample apps with fake data — never on real systems." },
];

export default function Trust() {
  return (
    <div>
      <PageHeader eyebrow="Trust & safety" title="Built to be safe to share." />
      <div className="pillars stagger">
        {PILLARS.map((p) => (
          <section key={p.title} className="pillar">
            <Icon name={p.icon} size={20} />
            <h3>{p.title}</h3>
            <p>{p.body}</p>
          </section>
        ))}
      </div>
      <div className="grid-2">
        <section className="card">
          <h2>Sharing labels (TLP)</h2>
          <ul className="plain-list tlp-list">
            {Object.values(TLP_INFO).map((t) => (
              <li key={t.label}>
                <span className={`tlp tlp-${t.label.split(":")[1].toLowerCase()}`}>{t.label}</span> <span className="small">{t.explanation}</span>
              </li>
            ))}
          </ul>
        </section>
        <section className="card">
          <h2>Data use license</h2>
          <ol className="bullets small">
            {LICENSE_TERMS.map((t) => (
              <li key={t}>{t}</li>
            ))}
          </ol>
        </section>
      </div>
      <section className="card">
        <h2>Prototype limits</h2>
        <ul className="bullets small muted">
          <li>Organization verification is a demo flag.</li>
          <li>Legal protections for sharing threat information vary by country.</li>
          <li>Match labels help find candidates; they don’t prove a shared cause.</li>
        </ul>
      </section>
    </div>
  );
}
