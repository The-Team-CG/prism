export type AccessRequestDraft = {
  fullName: string;
  email: string;
  organization: string;
  eventName: string;
  inquiryCode: string;
  message: string;
};

export type SignUpStatus = "idle" | "sent";

export const INITIAL_ACCESS_REQUEST: AccessRequestDraft = {
  fullName: "",
  email: "",
  organization: "",
  eventName: "",
  inquiryCode: "",
  message: "",
};

export const ACCESS_GATE_POINTS = [
  {
    id: "inquiry-gated",
    label: "Inquiry gated",
    detail: "Review opens after inquiry → accepted → signed conforme.",
  },
  {
    id: "pmcm-activated",
    label: "PMCM-activated",
    detail: "Only the PMCM team can activate client access roles.",
  },
  {
    id: "event-scoped",
    label: "Event-scoped",
    detail: "Approved layout, documents, billing, and activity updates.",
  },
] as const;
