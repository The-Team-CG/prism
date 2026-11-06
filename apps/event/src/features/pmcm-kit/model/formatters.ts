import { formatPortalDate } from "@prism/ui/format-date";
/** Pure display formatters shared by PMCM-facing features. */

export function humanizeToken(value: string): string {
  return value.replaceAll("_", " ");
}

export function formatShortDate(value?: string | null): string {
  return formatPortalDate(value, value || "No date");
}

/**
 * "1 check", "3 checks", "2 deliverables". The singular carries any leading words ("generated check"),
 * so the plural only changes the final word; pass an explicit plural for irregular nouns.
 */
export function pluralize(count: number, singular: string, plural = `${singular}s`): string {
  return `${count} ${count === 1 ? singular : plural}`;
}

/** Visible copy for a session's device: unknown or missing values read as "Unknown device", never "unknown". */
export function sessionDeviceLabel(device?: string | null): string {
  const value = device?.trim();
  return value && value.toLowerCase() !== "unknown" ? value : "Unknown device";
}
