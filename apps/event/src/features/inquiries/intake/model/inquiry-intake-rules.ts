import type { PrismInquiry } from "@prism/types";

export interface LogInquiryOnBehalfInput {
  clientName: string;
  companyName?: string;
  email: string;
  eventName: string;
  eventType?: string;
  eventDate: string;
  clientType: string;
  source?: string;
  channel?: string;
  referralDetails?: string;
  message: string;
}

export const declineReasons = ["Date Unavailable", "Outside Service Scope", "Budget Too Low", "Prior Issue", "Other"];
export const logFormEventTypes = [
  "Corporate event",
  "Conference",
  "Gala",
  "Product launch",
  "Private celebration",
  "Training or workshop",
  "Other",
];
export const logFormClientTypes = ["Corporate", "Private", "Government", "School", "Non-profit", "Other"];
export const logFormChannels = ["Walk-In", "Phone"];
export const logFormReferralSources = [
  "P.R.I.S.M Website",
  "PMCM Facebook",
  "BNI Referral",
  "Colleague or Friend",
  "Attended a PMCM Event",
  "Other",
];

export const initialLogForm = {
  clientName: "",
  companyName: "",
  email: "",
  eventName: "",
  eventType: "",
  eventDate: "",
  clientType: "",
  source: logFormReferralSources[0],
  channel: logFormChannels[0],
  referralDetails: "",
  message: "",
};

export type InquiryLogForm = typeof initialLogForm;

const STATUS_ACCENT: Record<string, string> = {
  new: "border-l-(--prism-amber)",
  accepted: "border-l-(--prism-success)",
  declined: "border-l-destructive",
};

export function inquiryStatusAccent(status: string) {
  return STATUS_ACCENT[status] ?? "border-l-border";
}

export function matchesAllOrValue(selected: string, value?: string | null) {
  return selected === "all" || selected === value;
}

export function dateRangeMatches(value: string, range: string, now = new Date()) {
  if (range === "all") return true;
  const date = new Date(value);
  const days = Math.floor((date.getTime() - now.getTime()) / 86_400_000);
  if (range === "next_30") return days >= 0 && days <= 30;
  if (range === "next_90") return days >= 0 && days <= 90;
  if (range === "past_30") return days < 0 && days >= -30;
  return true;
}

export function inquiryMatchesIntakeFilters(
  inquiry: Pick<
    PrismInquiry,
    "clientName" | "companyName" | "email" | "eventName" | "status" | "source" | "clientType" | "eventDate"
  >,
  filters: { query: string; status: string; source: string; clientType: string; dateRange: string },
  now = new Date(),
) {
  const haystack = `${inquiry.clientName} ${inquiry.companyName ?? ""} ${inquiry.email} ${inquiry.eventName}`.toLowerCase();
  const query = filters.query.trim().toLowerCase();
  if (query && !haystack.includes(query)) return false;
  if (!matchesAllOrValue(filters.status, inquiry.status)) return false;
  if (!matchesAllOrValue(filters.source, inquiry.source)) return false;
  if (!matchesAllOrValue(filters.clientType, inquiry.clientType)) return false;
  return dateRangeMatches(inquiry.eventDate, filters.dateRange, now);
}

export function isInquiryLogFormReady(form: InquiryLogForm) {
  return Boolean(
    form.clientName.trim() &&
      form.email.trim() &&
      form.eventName.trim() &&
      form.eventType &&
      form.eventDate &&
      form.clientType &&
      form.source &&
      form.channel &&
      form.message.trim(),
  );
}

export function inquiryExtraDetailFields(inquiry: PrismInquiry) {
  const fields: Array<{ label: string; value: string }> = [];
  if (inquiry.referralDetails) fields.push({ label: "Referral", value: inquiry.referralDetails });
  if (inquiry.channel) fields.push({ label: "Channel", value: inquiry.channel });
  if (inquiry.loggedByName) fields.push({ label: "Logged by", value: inquiry.loggedByName });
  if (inquiry.duplicateOfInquiryId) fields.push({ label: "Duplicate of", value: inquiry.duplicateOfInquiryId });
  if (inquiry.previouslyDeclined) fields.push({ label: "Previously declined", value: "Yes" });
  if (inquiry.previousDeclineReason) fields.push({ label: "Previous decline", value: inquiry.previousDeclineReason });
  if (inquiry.declineReason) fields.push({ label: "Decline reason", value: inquiry.declineReason });
  return fields;
}

export function toLogInquiryInput(form: InquiryLogForm): LogInquiryOnBehalfInput {
  return {
    clientName: form.clientName.trim(),
    companyName: form.companyName.trim() || undefined,
    email: form.email.trim(),
    eventName: form.eventName.trim(),
    eventType: form.eventType,
    eventDate: form.eventDate,
    clientType: form.clientType,
    source: form.source,
    channel: form.channel,
    referralDetails: form.referralDetails.trim() || undefined,
    message: form.message.trim(),
  };
}
