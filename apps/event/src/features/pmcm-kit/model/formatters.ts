import { formatPortalDate } from "@prism/ui/format-date";
/** Pure display formatters shared by PMCM-facing features. */

export function humanizeToken(value: string): string {
  return value.replaceAll("_", " ");
}

export function formatShortDate(value?: string | null): string {
  return formatPortalDate(value, value || "No date");
}
