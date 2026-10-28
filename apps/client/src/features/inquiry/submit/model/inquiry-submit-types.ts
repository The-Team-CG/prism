import { INQUIRY_CLIENT_CATEGORIES, PRISM_PRIVACY_NOTICE_VERSION } from "@prism/types";

export type InquiryForm = {
  clientName: string;
  companyName: string;
  email: string;
  phoneNumber: string;
  clientType: string;
  eventName: string;
  eventType: string;
  eventTypeOther: string;
  eventDate: string;
  dateFlexibility: string;
  expectedGuests: string;
  venueCity: string;
  venueStatus: string;
  budgetRange: string;
  inquiryPriority: string;
  message: string;
  source: string;
  sourceOther: string;
  channel: string;
  privacyConsentAccepted: boolean;
  privacyNoticeVersion: string;
  marketingConsentAccepted: boolean;
};

export type InquirySubmitStatus = "idle" | "loading" | "submitted" | "error";

// Easy questions first: the event, then scale, then who to contact, then review.
export const INQUIRY_WIZARD_STEPS = ["Your event", "Venue and budget", "Your details", "Review and send"] as const;

export const INQUIRY_CLIENT_TYPES = INQUIRY_CLIENT_CATEGORIES;
export const INQUIRY_EVENT_TYPES = [
  "Corporate event",
  "Conference",
  "Gala",
  "Product launch",
  "Private celebration",
  "Training or workshop",
  "Other",
] as const;
export const INQUIRY_DATE_OPTIONS = [
  "Fixed date",
  "Flexible by a few days",
  "Flexible by a few weeks",
  "Still deciding",
] as const;
export const INQUIRY_OTHER_OPTION = "Other";
// Suggestions only; clients can still type a venue name or any other city.
export const INQUIRY_CITY_SUGGESTIONS = [
  "Makati",
  "Taguig (BGC)",
  "Pasay",
  "Manila",
  "Quezon City",
  "Pasig (Ortigas)",
  "Mandaluyong",
  "Parañaque",
  "Muntinlupa (Alabang)",
  "Tagaytay",
  "Clark, Pampanga",
  "Baguio",
  "Cebu City",
  "Iloilo City",
  "Davao City",
] as const;
export const INQUIRY_VENUE_OPTIONS = ["Confirmed", "Shortlisted", "Still looking", "Not applicable yet"] as const;
export const INQUIRY_BUDGET_RANGES = [
  "Below PHP 50k",
  "PHP 50k-150k",
  "PHP 150k-500k",
  "PHP 500k-1M",
  "PHP 1M+",
  "TBD / Flexible",
] as const;
export const INQUIRY_PRIORITY_OPTIONS = ["Standard", "Urgent", "Date-sensitive"] as const;
export const INQUIRY_REFERRAL_SOURCES = [
  "P.R.I.S.M Website",
  "PMCM Facebook",
  "BNI Referral",
  "Colleague or Friend",
  "Attended a PMCM Event",
  "Other",
] as const;

export const INITIAL_INQUIRY_FORM: InquiryForm = {
  clientName: "",
  companyName: "",
  email: "",
  phoneNumber: "",
  clientType: "",
  eventName: "",
  eventType: "",
  eventTypeOther: "",
  eventDate: "",
  dateFlexibility: "",
  expectedGuests: "",
  venueCity: "",
  venueStatus: "",
  budgetRange: "",
  inquiryPriority: "",
  message: "",
  source: "",
  sourceOther: "",
  channel: "",
  privacyConsentAccepted: false,
  privacyNoticeVersion: PRISM_PRIVACY_NOTICE_VERSION,
  marketingConsentAccepted: false,
};
