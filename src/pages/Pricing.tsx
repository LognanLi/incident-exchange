import { Link } from "react-router-dom";
import { Icon } from "../components/icons";
import { PageHeader } from "../components/ui";

const TIERS = [
  {
    name: "Pay as you go",
    price: "Per guide",
    sub: "Typical guide: $0.10–$1.00 in this demo (test USDC)",
    features: ["Free previews, fit checks, and public sources", "Unlock individual guides", "Symptom alerts", "Data Use License per guide"],
    cta: "Find a guide",
    to: "/playbooks",
  },
  {
    name: "Team",
    price: "Seats + credits",
    sub: "Pricing hypothesis — to validate with customers",
    features: ["Shared guide library for your org", "Monthly budget & spend controls", "Audit log export", "Verified-organization badge (unlocks TLP:AMBER guides)"],
    cta: "See team controls",
    to: "/team",
    featured: true,
  },
  {
    name: "Enterprise",
    price: "Annual",
    sub: "For security programs and ISAC-style groups",
    features: ["SSO / SAML and SCIM (roadmap)", "Private exchange rings between partner companies", "STIX 2.1 export into your threat-intel tools", "Invoicing, procurement, legal review"],
    cta: "Read trust & safety",
    to: "/trust",
  },
];

export default function Pricing() {
  return (
    <div>
      <PageHeader eyebrow="Simple, usage-based" title="Pricing" />
      <div className="grid-3 stagger">
        {TIERS.map((t) => (
          <section key={t.name} className={`card lift tier ${t.featured ? "gradient-border" : ""}`}>
            {t.featured && <span className="pill">Most teams</span>}
            <h3>{t.name}</h3>
            <div className="tier-price">{t.price}</div>
            <p className="small muted">{t.sub}</p>
            <ul className="tier-list">
              {t.features.map((f) => (
                <li key={f}>
                  <Icon name="check" size={16} /> {f}
                </li>
              ))}
            </ul>
            <Link className={`btn block ${t.featured ? "primary" : ""}`} to={t.to}>
              {t.cta}
            </Link>
          </section>
        ))}
      </div>
      <section className="card">
        <h2>Contributors earn 80% of every sale</h2>
        <p className="muted">
          Earnings accrue per sale and, in a production version, pay out after a short holding period (to allow refunds and
          fraud checks). In this prototype, accruals are an internal ledger — nothing is paid out. The 80/20 split is a
          demo assumption, not final commercial policy.
        </p>
      </section>
    </div>
  );
}
