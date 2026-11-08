export const PRIVACY_REQUEST_TYPES = [
  { value: "access", label: "Access", description: "A copy of the personal data PMCM holds about you" },
  { value: "export", label: "Export", description: "Your personal data in a portable file" },
  { value: "correction", label: "Correction", description: "Fix details that are wrong" },
  { value: "deletion", label: "Deletion", description: "Erase your personal data" },
] as const;

export type PrivacyRequestType = (typeof PRIVACY_REQUEST_TYPES)[number]["value"];

export const PRIVACY_REQUEST_EXPLANATION =
  "PMCM verifies your identity before acting on any privacy request. Your request stays open until PMCM finishes it, and its status is shown below.";

const STATUS_LABELS: Record<string, string> = {
  submitted: "Received",
  approved: "In progress",
  rejected: "Closed",
  executed: "Completed",
};

export function privacyRequestStatusLabel(status: string) {
  return STATUS_LABELS[status] ?? status;
}

export function privacyRequestTypeLabel(type: string) {
  return PRIVACY_REQUEST_TYPES.find((option) => option.value === type)?.label ?? type;
}

export function privacyRequestDateLabel(iso: string) {
  return new Date(iso).toLocaleDateString("en-PH", { dateStyle: "medium" });
}
