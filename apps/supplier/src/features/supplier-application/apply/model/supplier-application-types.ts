export type SupplierApplicationForm = {
  companyName: string;
  contactName: string;
  email: string;
  phone: string;
  categoryId: string;
  pastEvents: string;
  serviceInclusions: string;
  priceRange: string;
  certifications: string;
  portfolioUrl: string;
  additionalNotes: string;
  bniMember: boolean;
  privacyConsentAccepted: boolean;
  privacyNoticeVersion: string;
};

export type SupplierApplicationSubmitStatus = "idle" | "loading" | "submitted" | "error";

export const PRIVACY_NOTICE_VERSION = "2026-05-01";

export const APPLICATION_WIZARD_STEPS = ["Company Info", "Services & Portfolio", "Certifications", "Review & Submit"] as const;

export const APPLICATION_PRICE_RANGES = [
  "Below PHP 50k",
  "PHP 50k-150k",
  "PHP 150k-500k",
  "PHP 500k-1M",
  "PHP 1M+",
  "TBD / Flexible",
] as const;

export const FALLBACK_SUPPLIER_CATEGORIES: { id: string; name: string }[] = [
  { id: "supcat_production", name: "Production" },
  { id: "supcat_technicals", name: "Technicals" },
  { id: "supcat_digital_registration", name: "Digital Registration" },
  { id: "supcat_documentation", name: "Documentation" },
  { id: "supcat_food_beverages", name: "Food and Beverages" },
  { id: "supcat_venue", name: "Venue" },
  { id: "supcat_decor", name: "Decor & Styling" },
];

export const INITIAL_SUPPLIER_APPLICATION_FORM: SupplierApplicationForm = {
  companyName: "",
  contactName: "",
  email: "",
  phone: "",
  categoryId: "",
  pastEvents: "",
  serviceInclusions: "",
  priceRange: "",
  certifications: "",
  portfolioUrl: "",
  additionalNotes: "",
  bniMember: false,
  privacyConsentAccepted: false,
  privacyNoticeVersion: PRIVACY_NOTICE_VERSION,
};
