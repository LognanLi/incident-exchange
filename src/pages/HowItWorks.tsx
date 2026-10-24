import { Link } from "react-router-dom";
import { Icon } from "../components/icons";
import { PageHeader } from "../components/ui";
import { Term } from "../components/PageGuide";

const STEPS: { who: string; title: string; body: string }[] = [
  { who: "Contributor", title: "Write down what happened", body: "Symptoms, what failed, what fixed it. Notes stay private." },
  { who: "Contributor", title: "Remove private details", body: "A privacy scan flags names, emails, and hosts. You approve the final text." },
  { who: "Reviewer", title: "Check the evidence", body: "Where possible, the fix is tested on a sample app: fails before, passes after." },
  { who: "Buyer", title: "Describe the problem", body: "Plain words. Each match says why it may or may not fit." },
  { who: "Buyer", title: "Unlock the guide", body: "A small payment (test money here) unlocks the full fix and checklist." },
  { who: "Everyone", title: "Report the outcome", body: "Buyers say if it helped. Contributors earn 80% of each sale." },
];

export default function HowItWorks() {
  return (
    <div>
      <PageHeader eyebrow="Overview" title="How it works" />
      <ol className="steps-timeline stagger">
        {STEPS.map((s, i) => (
          <li key={s.title} className="step-item">
            <span className="step-n">0{i + 1}</span>
            <span className="step-who">{s.who}</span>
            <div>
              <h3>{s.title}</h3>
              <p>{s.body}</p>
            </div>
          </li>
        ))}
      </ol>
      <section className="home-section">
        <h2 className="section-title">Compared with</h2>
        <div className="compare">
          <div>
            <h4>Public advisories</h4>
            <p>General fixes. Rarely say what failed or how it was confirmed.</p>
          </div>
          <div>
            <h4>AI assistants</h4>
            <p>Fast answers, but no proof and no source you can check.</p>
          </div>
          <div className="us">
            <h4>Incident Exchange</h4>
            <p>
              Real experience, privacy-reviewed, with an honest <Term k="evidence level" />.
            </p>
          </div>
        </div>
      </section>
      <div className="cta-row">
        <Link className="btn primary lg" to="/playbooks">
          Find a fix <Icon name="arrow" size={16} className="icon-arrow" />
        </Link>
        <Link className="btn lg" to="/contribute/new">
          Share an incident
        </Link>
      </div>
    </div>
  );
}
