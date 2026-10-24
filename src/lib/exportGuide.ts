// Client-side exports of a purchased guide. Content is only available after the server grants access.
import { LICENSE_VERSION, TLP_INFO } from "../../convex/lib/license";

type Exportable = {
  publicTitle: string;
  publicSummary: string;
  recognize: string;
  publicLimitations: string;
  tlp: keyof typeof TLP_INFO;
  revision: number;
  evidenceLevel: string;
  evidenceScope: string;
  lockedSteps: { check: string; contain: string; recover: string; verify: string };
  failedAttempts: string | null;
};

export function toRunbookMarkdown(g: Exportable, licensee: string): string {
  const tlp = TLP_INFO[g.tlp].label;
  const section = (title: string, body: string, check = false) =>
    `## ${title}\n\n${body
      .split("\n")
      .map((l) => l.replace(/^\s*-\s*/, "").trim())
      .filter(Boolean)
      .map((l) => (check ? `- [ ] ${l}` : `- ${l}`))
      .join("\n")}\n`;
  return [
    `<!-- ${tlp} · Licensed to ${licensee} under ${LICENSE_VERSION}: internal defensive use only, no redistribution. -->`,
    `# ${g.publicTitle}`,
    `**${tlp}** · revision ${g.revision} · evidence: ${g.evidenceLevel} — ${g.evidenceScope}`,
    ``,
    g.publicSummary,
    ``,
    section("Recognize", g.recognize),
    g.failedAttempts ? section("What they tried that did not work", g.failedAttempts) : "",
    section("Check", g.lockedSteps.check, true),
    section("Contain", g.lockedSteps.contain, true),
    section("Recover", g.lockedSteps.recover, true),
    section("Verify", g.lockedSteps.verify, true),
    section("Limitations", g.publicLimitations),
    `---\nSource: Incident Exchange. ${tlp}: ${TLP_INFO[g.tlp].explanation}`,
  ].join("\n");
}

// STIX 2.1 predefined TLP marking-definition ids (TLP v1 objects in the STIX 2.1 spec; CLEAR maps to WHITE).
const STIX_TLP: Record<string, string> = {
  clear: "marking-definition--613f2e26-407d-48c7-9eca-b8e91df99dc9",
  green: "marking-definition--34098fce-860f-48ae-8e50-ebd3cc5e41da",
  amber: "marking-definition--f88d31f6-486f-44da-b317-01333bde0b82",
};

/** STIX 2.1 bundle with one course-of-action carrying the response steps, for threat-intel platforms. */
export function toStixBundle(g: Exportable): string {
  const now = new Date().toISOString();
  const coa = {
    type: "course-of-action",
    spec_version: "2.1",
    id: `course-of-action--${crypto.randomUUID()}`,
    created: now,
    modified: now,
    name: g.publicTitle,
    description: toRunbookMarkdown(g, "recipient organization"),
    labels: [`incident-exchange-revision-${g.revision}`, `evidence-${g.evidenceLevel}`],
    object_marking_refs: [STIX_TLP[g.tlp]],
  };
  return JSON.stringify({ type: "bundle", id: `bundle--${crypto.randomUUID()}`, objects: [coa] }, null, 2);
}

export function download(filename: string, text: string, type: string) {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
