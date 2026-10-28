/** User-facing names for stored role and status identifiers shown in PMCM metadata. */

const ROLE_LABELS: Record<string, string> = {
  "pmcm-admin": "PMCM administrator",
  pmcm_admin: "PMCM administrator",
  coordinator: "Coordinator",
  client: "Client",
  supplier: "Supplier",
  guest: "Guest",
  system: "System",
  unknown: "Unknown",
};

const FLOORPLAN_SOURCE_LABELS: Record<string, string> = {
  client_preference: "Client preference",
  template: "PMCM template",
  blank: "Blank layout",
};

function sentenceCase(value: string): string {
  const words = value.replaceAll(/[_-]+/g, " ").trim();
  return words ? words.charAt(0).toUpperCase() + words.slice(1) : "";
}

/** Role label for a stored role identifier; unknown identifiers fall back to readable sentence case. */
export function roleLabel(role?: string | null): string {
  if (!role) return "—";
  return ROLE_LABELS[role] ?? sentenceCase(role);
}

/** Label for where a floorplan draft came from (template, client preference…). */
export function floorplanSourceLabel(source?: string | null): string {
  if (!source) return "—";
  return FLOORPLAN_SOURCE_LABELS[source] ?? sentenceCase(source);
}

/** Readable sentence-case label for a stored status token such as `in_review`. */
export function statusLabel(status?: string | null): string {
  if (!status) return "—";
  return sentenceCase(status);
}
