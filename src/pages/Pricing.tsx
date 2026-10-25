import { Link } from "react-router-dom";
import { Icon } from "../components/icons";
import { PageHeader } from "../components/ui";

const TIERS = [
  {
    name: "Pay as you go",
    price: "Per guide",
    sub: "$0.10–$1.00 in this demo (test USDC)",
    features: ["Free previews and fit checks", "Unlock single guides", "Symptom alerts", "License per guide"],
    cta: "Find a fix",
    to: "/playbooks",
  },
  {
    name: "Team",
    price: "Seats + credits",
    sub: "Pricing to be validated",
    features: ["Shared library", "Monthly budget controls", "Audit log export", "Verified badge for TLP:AMBER guides"],
    cta: "See budget controls",
    to: "/team",
    featured: true,
  },
  {
    name: "Enterprise",
    price: "Annual",
    sub: "Security programs and sharing groups",
    features: ["SSO / SAML (roadmap)", "Private partner exchanges", "STIX 2.1 export", "Invoicing and legal review"],
    cta: "Read about trust",
    to: "/trust",
  },
];

export default function Pricing() {
  return (
    <div>
      <PageHeader eyebrow="Pricing" title="Pay for what fits." sub="80% of every sale accrues to the contributor." />
      <div className="tiers stagger">
        {TIERS.map((t) => (
          <section key={t.name} className="tier">
            <div className={`eyebrow ${t.featured ? "featured" : ""}`}>{t.featured ? "Most teams" : " "}</div>
            <h3>{t.name}</h3>
            <div className="tier-price">{t.price}</div>
            <p className="tier-sub">{t.sub}</p>
            <ul className="tier-list">
              {t.features.map((f) => (
                <li key={f}>
                  <Icon name="check" size={14} /> {f}
                </li>
              ))}
            </ul>
            <Link className={`btn block ${t.featured ? "primary" : ""}`} to={t.to}>
              {t.cta}
            </Link>
          </section>
        ))}
      </div>
      <p className="small muted">Earnings are tracked, not paid out, in this prototype. The 80/20 split is a demo assumption.</p>
    </div>
  );
}
