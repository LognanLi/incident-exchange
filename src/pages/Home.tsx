import { useQuery } from "convex/react";
import { Link, useNavigate } from "react-router-dom";
import { api } from "../../convex/_generated/api";
import { useSession } from "../session";
import { URGENT_SAFETY_ADVICE } from "../../convex/lib/domain";
import { Icon } from "../components/icons";
import { Term } from "../components/PageGuide";
import { CountUp } from "../components/motion";

type Role = "buyer" | "contributor" | "reviewer";

const PATHS: { role: Role; title: string; body: string; to: string; cta: string }[] = [
  { role: "buyer", title: "Something is broken", body: "Describe what you see. Get fixes from teams who solved it.", to: "/playbooks", cta: "Find a fix" },
  { role: "contributor", title: "We fixed something hard", body: "Turn your notes into a private, sellable guide. Keep 80%.", to: "/contribute", cta: "Share an incident" },
  { role: "reviewer", title: "I check quality", body: "Test each fix on a sample app before it’s sold.", to: "/review", cta: "Review queue" },
];

export default function Home() {
  const navigate = useNavigate();
  const session = useSession();
  const stats = useQuery(api.business.marketStats);

  const go = (role: Role, path: string) => {
    if (session.role !== role) {
      const slug = session.slugForRole(role);
      if (slug) session.setActor(slug);
    }
    navigate(path);
  };

  return (
    <div className="home">
      <section className="hero3">
        <div className="stagger">
          <span className="pill">
            <span className="dot good" /> Incident response marketplace
          </span>
          <h1>
            When something breaks, <span className="dim">learn from the team that already fixed it.</span>
          </h1>
          <p className="lede">Private write-ups of real incidents. Tested fixes. Pay only for what fits.</p>
          <div className="hero-actions">
            <button className="btn primary lg" onClick={() => go("buyer", "/playbooks")}>
              Describe your problem <Icon name="arrow" size={16} className="icon-arrow" />
            </button>
            <button className="btn lg" onClick={() => go("contributor", "/contribute")}>
              Share an incident
            </button>
          </div>
        </div>
        <div className="hero-demo" aria-label="Example search">
          <div className="small muted">Example</div>
          <div className="hero-demo-q">
            <Icon name="search" size={16} /> orders are created twice and the queue fills up after restarts
            <span className="caret" aria-hidden />
          </div>
          <div className="hero-demo-result">
            <div className="small">
              <span className="dot good" />
              Strong overlap · 2 of 2 signs match
            </div>
            <h4>Duplicate jobs after webhook retries</h4>
            <div className="hero-demo-meta">
              <span>Test reproduced</span>
              <span>TLP:GREEN</span>
              <span>0.50 USDC</span>
            </div>
          </div>
          <div className="hero-demo-result">
            <div className="small">
              <span className="dot warn" />
              May not apply · no repeated event IDs
            </div>
            <h4>Queue backlog after a deploy</h4>
            <div className="hero-demo-meta">
              <span>Contributor reported</span>
              <span>0.10 USDC</span>
            </div>
          </div>
        </div>
      </section>

      {stats && (
        <dl className="hero-proof" aria-label="Live counts">
          <div>
            <dt>Guides</dt>
            <dd>
              <CountUp to={stats.guides} />
            </dd>
          </div>
          <div>
            <dt>Fixes tested</dt>
            <dd>
              <CountUp to={stats.reproduced} />
            </dd>
          </div>
          <div>
            <dt>Test runs</dt>
            <dd>
              <CountUp to={stats.testRuns} />
            </dd>
          </div>
        </dl>
      )}

      <section className="home-section">
        <h2 className="section-title">Start here</h2>
        <ul className="path-list">
          {PATHS.map((p, i) => (
            <li key={p.role}>
              <button className="path-card" onClick={() => go(p.role, p.to)}>
                <span className="path-num">0{i + 1}</span>
                <h3>{p.title}</h3>
                <p>{p.body}</p>
                <span className="path-cta">
                  {p.cta} <Icon name="arrow" size={16} />
                </span>
              </button>
            </li>
          ))}
        </ul>
      </section>

      <section className="home-section">
        <h2 className="section-title">What you get</h2>
        <div className="facts">
          <div className="fact">
            <h3>Free to read</h3>
            <p>
              Symptoms, a fit checklist, warnings, and the <Term k="evidence level" />.
            </p>
          </div>
          <div className="fact">
            <h3>Paid to unlock</h3>
            <p>What failed, the full fix, and how to confirm it worked.</p>
          </div>
          <div className="fact">
            <h3>Never shared</h3>
            <p>
              The contributor’s raw notes and identity. Many fixes are <Term k="test reproduced">tested on a sample app</Term>.
            </p>
          </div>
        </div>
      </section>

      <section className="home-section">
        <h2 className="section-title">Active incident?</h2>
        <div className="facts">
          {URGENT_SAFETY_ADVICE.slice(0, 3).map((a, i) => (
            <div key={a} className={`fact ${i === 0 ? "urgent" : ""}`}>
              <p>{a}</p>
            </div>
          ))}
        </div>
        <p className="small muted" style={{ marginTop: 24 }}>
          <Link className="arrow-link" to="/how-it-works">
            How it works <Icon name="arrow" size={14} />
          </Link>
        </p>
      </section>
    </div>
  );
}
