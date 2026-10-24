export const LICENSE_VERSION = "IX-DUL-1.0";

/** Plain-language Data Use License shown at checkout. */
export const LICENSE_TERMS = [
  "Use this guide only to detect, contain, recover from, or prevent incidents in systems your organization operates.",
  "Do not resell, publish, or share it outside your organization (respect its TLP label).",
  "Do not try to identify the contributing company or its people.",
  "It is guidance from another team's experience, not a guarantee. Test changes before applying them in production.",
];

export const TLP_INFO = {
  clear: { label: "TLP:CLEAR", explanation: "No sharing limits beyond the license." },
  green: { label: "TLP:GREEN", explanation: "Share within your organization and trusted partners, not publicly." },
  amber: { label: "TLP:AMBER", explanation: "Need-to-know inside your organization only. Sold only to verified organizations." },
} as const;
