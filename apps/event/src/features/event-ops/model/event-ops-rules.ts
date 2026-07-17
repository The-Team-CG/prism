/** Shared pure display helpers for PMCM event features (no React / I/O). */

export function humanizeToken(value: string): string {
  return value.replaceAll("_", " ");
}

export function formatShortDate(value?: string | null): string {
  if (!value) return "No date";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}
