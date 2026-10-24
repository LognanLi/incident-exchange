import { Link } from "react-router-dom";
import { Icon, type IconName } from "../components/icons";
import { PageHeader } from "../components/ui";
import { Term } from "../components/PageGuide";

const STEPS: { icon: IconName; who: string; title: string; body: string }[] = [
  { icon: "folder", who: "Contributor", title: "A team writes down what happened", body: "In plain words: the symptoms, what they tried that failed, what fixed it, and how they checked. These notes stay private." },
  { icon: "lock", who: "Contributor", title: "Private details are removed", body: "An automatic privacy check finds names, emails, internal addresses and dates. The team approves the exact version buyers will see." },
  { icon: "shield", who: "Reviewer", title: "A human checks the evidence", body: "Where possible, the fix is tested on a small sample app with fake data: it must fail before the fix and pass after — while normal use still works." },
  { icon: "search", who: "Buyer", title: "Another team describes their problem", body: "No jargon needed. They type what they see and get matching guides — with reasons why each may or may not fit." },
  { icon: "coin", who: "Buyer", title: "They unlock the full guide", body: "A small payment (test money in this demo) unlocks the step-by-step fix, what didn't work, and a checklist to confirm it's solved." },
  { icon: "chat", who: "Everyone", title: "Outcomes make the library better", body: "Buyers report whether it helped. Contributors earn 80% of each sale and build a track record." },
];

export default function HowItWorks() {
  return (
    <div>
      <PageHeader eyebrow="The loop in 60 seconds" title="How Incident Exchange works" />
      <ol className="steps-timeline stagger">
        {STEPS.map((s, i) => (
          <li key={s.title} className="card lift step-item">
            <div className="step-icon">
              <Icon name={s.icon} size={20} />
            </div>
            <div>
              <div className="eyebrow">
                Step {i + 1} · {s.who}
              </div>
              <h3>{s.title}</h3>
              <p className="muted">{s.body}</p>
            </div>
          </li>
        ))}
      </ol>
      <section className="card">
        <h2>Why not just search the internet or ask an AI?</h2>
        <div className="grid-3 compact">
          <div>
            <h4>Public advisories</h4>
            <p className="muted small">Great for general fixes. Rarely say what failed, or how a real team confirmed the problem was gone.</p>
          </div>
          <div>
            <h4>AI assistants</h4>
            <p className="muted small">Fast explanations, but no proof, no source you can check, and no reward for the people who learned it the hard way.</p>
          </div>
          <div>
            <h4>Incident Exchange</h4>
            <p className="muted small">
              Real experience, privacy-reviewed, with an honest <Term k="evidence level" /> and clear limits — and the contributor gets paid.
            </p>
          </div>
        </div>
      </section>
      <div className="row gap wrap">
        <Link className="btn primary lg" to="/playbooks">
          Try finding a guide <Icon name="arrow" />
        </Link>
        <Link className="btn lg" to="/contribute/new">
          Share an incident
        </Link>
      </div>
    </div>
  );
}
