import { z } from "zod";
import {
  isoDateStringSchema,
  nonEmptyStringSchema,
  optionalTrimmedStringSchema,
  privacyConsentSchema,
} from "./common.js";
const eventDecisionFields = z.object({
  decision: z.enum(["cancelled", "postponed", "date_to_be_confirmed"]),
  reason: nonEmptyStringSchema,
  newEventDate: isoDateStringSchema.optional(),
  cancellationFeeAmount: z.number().int().nonnegative().default(0),
  depositTreatment: z.enum(["retain", "credit", "waive", "pending_review"]).default("pending_review"),
  supplierImpact: z.enum(["release_obligations", "preserve_obligations", "pending_review"]).default("pending_review"),
  // Required on frozen events; the service verifies it is an approved, unused exception for this event.
  freezeExceptionId: optionalTrimmedStringSchema,
  idempotencyKey: nonEmptyStringSchema.optional(),
});

type EventDecisionFields = z.infer<typeof eventDecisionFields>;

function refineEventDecision(value: EventDecisionFields, ctx: z.RefinementCtx) {
  if (value.decision === "postponed" && !value.newEventDate) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["newEventDate"], message: "A new date is required for postponement" });
  }
  // Impact review cannot be silently skipped: unresolved supplier impact is rejected outright.
  if (value.supplierImpact === "pending_review") {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["supplierImpact"], message: "Supplier impact must be resolved before recording this decision" });
  }
  // FR-97: postponements never carry a cancellation fee.
  if (value.decision !== "cancelled" && value.cancellationFeeAmount > 0) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["cancellationFeeAmount"], message: "Only a cancellation can carry a cancellation fee" });
  }
  const billingRequiresTreatment = value.decision === "cancelled" || value.cancellationFeeAmount > 0;
  if (billingRequiresTreatment && value.depositTreatment === "pending_review") {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["depositTreatment"], message: "Deposit treatment must be resolved when cancelling or charging a cancellation fee" });
  }
}

/** FR-96: once the conforme is signed the fee is 10 to 15 percent of the contract amount; before that, none. Amounts are whole pesos. */
export const CANCELLATION_FEE_POLICY = { minPercent: 10, maxPercent: 15 } as const;

export function cancellationFeeBounds(contractAmount: number, conformeSigned: boolean): { minimum: number; maximum: number } {
  if (!conformeSigned || contractAmount <= 0) return { minimum: 0, maximum: 0 };
  return {
    minimum: Math.round((contractAmount * CANCELLATION_FEE_POLICY.minPercent) / 100),
    maximum: Math.round((contractAmount * CANCELLATION_FEE_POLICY.maxPercent) / 100),
  };
}

/** Decision treatment rules shared by the service-facing input and the PMCM write boundary. */
export const eventDecisionSchema = eventDecisionFields.superRefine(refineEventDecision);
export type EventDecisionInput = z.infer<typeof eventDecisionSchema>;

/** FR-97: PMCM's outcome for the venue-confirmation sub-ticket opened by a postponement. */
export const resolveVenueConfirmationSchema = z.object({
  outcome: z.enum(["confirmed", "unavailable"]),
  note: z.string().trim().max(1000).default(""),
});
export type ResolveVenueConfirmationInput = z.input<typeof resolveVenueConfirmationSchema>;

/**
 * PMCM write boundary: a decision is recorded only after the coordinator, supplier, and billing impact review
 * has been confirmed, so the flag is required here rather than defaulted.
 */
export const recordEventDecisionSchema = eventDecisionFields
  .extend({
    impactReviewAcknowledged: z.literal(true, { message: "Confirm the coordinator, supplier, and billing impact review before recording this decision" }),
  })
  .superRefine(refineEventDecision);
export type RecordEventDecisionInput = z.infer<typeof recordEventDecisionSchema>;

/**
 * Write DTOs for portal ↔ API mutations.
 * Schemas are the source of truth; types are `z.infer`.
 * Nest controllers should validate with `ZodValidationPipe` + these schemas.
 */

/* ── Inquiry / onboarding ─────────────────────────────────────── */

/** Client categories offered for new inquiries (product policy, 2026-09-08). */
export const INQUIRY_CLIENT_CATEGORIES = ["Corporate", "Government", "Individual", "Non-profit"] as const;
export type InquiryClientCategory = (typeof INQUIRY_CLIENT_CATEGORIES)[number];

/** Legacy values rewritten to a current category on write. School/Other have no mapping and remain historical values. */
const LEGACY_INQUIRY_CLIENT_TYPE_MAPPINGS: ReadonlyMap<string, InquiryClientCategory> = new Map([["Private", "Individual"]]);

export function normalizeInquiryClientType(value: string): string {
  const trimmed = value.trim();
  return LEGACY_INQUIRY_CLIENT_TYPE_MAPPINGS.get(trimmed) ?? trimmed;
}

export const inquiryClientCategorySchema = z
  .string()
  .transform(normalizeInquiryClientType)
  .pipe(z.enum(INQUIRY_CLIENT_CATEGORIES));

/** Lightweight spatial preference offered on the public inquiry. Choices are preferences for PMCM to plan from, not a floor plan. */
export const INQUIRY_SEATING_ARRANGEMENTS = ["Theatre rows", "Banquet rounds", "Cocktail standing", "Classroom", "Boardroom or U-shape", "No preference"] as const;
export const INQUIRY_STAGE_POSITIONS = ["Centre", "Left", "Right", "No stage", "Not sure"] as const;

export const createPrismInquirySchema = privacyConsentSchema.extend({
  clientName: nonEmptyStringSchema,
  companyName: optionalTrimmedStringSchema,
  email: z.string().trim().email(),
  eventName: nonEmptyStringSchema,
  eventType: optionalTrimmedStringSchema,
  eventDate: isoDateStringSchema,
  clientType: inquiryClientCategorySchema,
  source: z.enum([
    "P.R.I.S.M Website",
    "PMCM Facebook",
    "BNI Referral",
    "Colleague or Friend",
    "Attended a PMCM Event",
    "Other",
  ]),
  channel: optionalTrimmedStringSchema,
  referralDetails: optionalTrimmedStringSchema,
  message: nonEmptyStringSchema,
  seatingArrangement: z.enum(INQUIRY_SEATING_ARRANGEMENTS).optional(),
  stagePosition: z.enum(INQUIRY_STAGE_POSITIONS).optional(),
  setupNotes: z.string().trim().max(500).optional(),
});
export type CreatePrismInquiryInput = z.infer<typeof createPrismInquirySchema>;

/** PMCM logs an inquiry on behalf of a client with basic detail only. Whatever else is missing is completed later. */
export const logInquiryOnBehalfSchema = z.object({
  clientName: nonEmptyStringSchema,
  companyName: optionalTrimmedStringSchema,
  email: z.string().trim().email(),
  eventName: nonEmptyStringSchema,
  eventType: optionalTrimmedStringSchema,
  eventDate: isoDateStringSchema,
  clientType: inquiryClientCategorySchema.optional(),
  source: createPrismInquirySchema.shape.source.optional(),
  channel: optionalTrimmedStringSchema,
  referralDetails: optionalTrimmedStringSchema,
  message: optionalTrimmedStringSchema,
});
export type LogInquiryOnBehalfInput = z.infer<typeof logInquiryOnBehalfSchema>;

/* FR-50 Abandoned inquiry draft save and the 24-hour edit window. */
export const INQUIRY_EDIT_WINDOW_HOURS = 24;
export const INQUIRY_DRAFT_REMINDER_HOURS = 24;
export const INQUIRY_DRAFT_RETENTION_DAYS = 30;
export const inquiryAccessTokenSchema = z.string().trim().regex(/^[A-Za-z0-9_-]{32,64}$/, "This link is not valid");

/** Saved only after the visitor accepts the privacy notice; before that the draft stays in the browser. */
export const saveInquiryDraftSchema = z.object({
  privacyConsentAccepted: z.literal(true),
  email: z.string().trim().email().optional(),
  payload: z.record(z.string().max(60), z.union([z.string().max(2_000), z.boolean()]))
    .refine((payload) => Object.keys(payload).length <= 40, "Too many draft fields"),
}).strict();
export type SaveInquiryDraftInput = z.infer<typeof saveInquiryDraftSchema>;

export interface PrismInquiryDraft {
  payload: Record<string, string | boolean>;
  updatedAt: string;
}

/** What a submitter may still change in the first 24 hours, before PMCM reviews the inquiry. */
export const editPublicInquirySchema = createPrismInquirySchema.pick({
  eventName: true, eventType: true, eventDate: true, message: true, seatingArrangement: true, stagePosition: true, setupNotes: true,
}).partial().strict();
export type EditPublicInquiryInput = z.infer<typeof editPublicInquirySchema>;

export interface PrismPublicInquiryEdit {
  eventName: string;
  eventType: string;
  eventDate: string;
  message: string;
  seatingArrangement: string | null;
  stagePosition: string | null;
  setupNotes: string | null;
  editableUntil: string;
}

/**
 * Full-details fields of the public inquiry. Privacy consent is left out: a client gives it on the public form,
 * which an inquiry logged on behalf never goes through.
 */
const inquiryFullDetailsSchema = createPrismInquirySchema.pick({
  clientName: true,
  email: true,
  eventName: true,
  eventDate: true,
  clientType: true,
  source: true,
  message: true,
});

/**
 * Derived, never stored. An inquiry logged on behalf is "Pending Full Details" while any full-details field is missing;
 * it clears by itself once they are filled in.
 */
export function inquiryPendingFullDetails(inquiry: {
  clientName: string;
  email: string;
  eventName: string;
  eventDate: string;
  clientType: string;
  source: string;
  message: string;
}): boolean {
  return !inquiryFullDetailsSchema.safeParse(inquiry).success;
}

/** PMCM-only organization merge. The target inquiry comes from the route; public writers cannot reach this schema. */
export const mergeInquirySchema = z.object({
  sourceInquiryId: nonEmptyStringSchema,
  reason: nonEmptyStringSchema,
});
export type MergeInquiryInput = z.infer<typeof mergeInquirySchema>;

/** FR-44: PMCM corrects a client's company name; every change is logged with a reason. */
export const updateInquiryCompanyNameSchema = z.object({
  companyName: z.string().trim().min(1).max(200),
  reason: nonEmptyStringSchema,
});
export type UpdateInquiryCompanyNameInput = z.infer<typeof updateInquiryCompanyNameSchema>;

/** FR-02: an inquiry follows the standard path or the bidding path (a pitch against other agencies). */
export const INQUIRY_INTAKE_PATHS = ["standard", "bidding"] as const;
export const INQUIRY_BID_STATUSES = ["preparing", "submitted", "won", "lost"] as const;
export const setInquiryIntakePathSchema = z.object({
  intakePath: z.enum(INQUIRY_INTAKE_PATHS),
  bidStatus: z.enum(INQUIRY_BID_STATUSES).optional(),
  bidDueAt: isoDateStringSchema.optional(),
}).superRefine((value, ctx) => {
  if (value.intakePath === "bidding" && !value.bidStatus) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["bidStatus"], message: "A bid needs a status" });
});
export type SetInquiryIntakePathInput = z.infer<typeof setInquiryIntakePathSchema>;

export interface PrismCompanyNameChange {
  id: string;
  inquiryId: string;
  fromName: string;
  toName: string;
  reason: string;
  changedBy: string;
  changedAt: string;
}

export const updateInquiryStatusSchema = z.object({
  status: z.enum(["new", "accepted", "pending", "declined"]),
  declineReason: z
    .enum(["Date Unavailable", "Outside Service Scope", "Budget Too Low", "Prior Issue", "Other"])
    .optional(),
});
export type UpdateInquiryStatusInput = z.infer<typeof updateInquiryStatusSchema>;

export const uploadConformeSchema = z.object({
  type: optionalTrimmedStringSchema,
  fileName: z
    .string()
    .trim()
    .min(1)
    .regex(/\.pdf$/i, "fileName must have a .pdf extension"),
  mimeType: optionalTrimmedStringSchema,
  sizeBytes: z.number().int().nonnegative().optional(),
  storageObjectId: optionalTrimmedStringSchema,
});
export type UploadConformeInput = z.infer<typeof uploadConformeSchema>;

/** Venue kind on the briefing; suppliers see it on quote requests, including confidential bids (FR-36/FR-49). */
export const BRIEFING_VENUE_TYPES = ["Hotel ballroom", "Function hall", "Convention center", "Restaurant", "Garden or outdoor", "Beach or resort", "Corporate office", "School or campus", "Other"] as const;
export const briefingVenueTypeSchema = z.enum(BRIEFING_VENUE_TYPES);
export type BriefingVenueType = z.infer<typeof briefingVenueTypeSchema>;

export const submitBriefingSchema = z.object({
  venue: nonEmptyStringSchema,
  venueType: briefingVenueTypeSchema.optional(),
  guestCount: z.number().int().min(1),
  budgetRange: nonEmptyStringSchema,
  serviceRequirements: z.array(z.string()),
  notes: nonEmptyStringSchema,
  confirmedDate: isoDateStringSchema.optional(),
  confirmedStartTime: optionalTrimmedStringSchema,
  confirmedEndTime: optionalTrimmedStringSchema,
  program: z.array(z.object({ time: optionalTrimmedStringSchema, activity: nonEmptyStringSchema })).optional().default([]),
  moodAndStyling: optionalTrimmedStringSchema,
  stylingBudget: z.number().int().nonnegative().optional(),
});
type ParsedSubmitBriefingInput = z.infer<typeof submitBriefingSchema>;
export type SubmitBriefingInput = Omit<ParsedSubmitBriefingInput, "program"> & { program?: ParsedSubmitBriefingInput["program"] };

export const archiveSearchFiltersSchema = z.object({
  venue: optionalTrimmedStringSchema,
  eventType: optionalTrimmedStringSchema,
  eventName: optionalTrimmedStringSchema,
  clientName: optionalTrimmedStringSchema,
  month: z
    .string()
    .trim()
    .optional()
    .refine((value) => !value || /^\d{4}-\d{2}$/.test(value), "month must be YYYY-MM"),
});
export type ArchiveSearchFilters = z.infer<typeof archiveSearchFiltersSchema>;

export const wrapUpModeSchema = z.enum(["full", "quick"]);
export type WrapUpMode = z.infer<typeof wrapUpModeSchema>;

/** The post-event wrap-up window: PMCM has five days to endorse deliverables after the recorded actual end of the event. */
export const WRAP_UP_WINDOW_HOURS = 5 * 24;

export const wrapUpSectionSchema = z.object({
  status: z.enum(["pending", "complete", "blocked"]).default("pending"),
  evidence: z.string().trim().max(4000).default(""),
  completedAt: z.string().datetime({ offset: true }).nullable().default(null),
});

/** One additional billing item PMCM spotted at wrap-up, kept as a draft until it is billed through the billing panel. */
export const wrapUpBillingDraftItemSchema = z.object({
  label: z.string().trim().min(1).max(200),
  amount: z.number().int().min(0).max(2147483647),
  note: z.string().trim().max(500).default(""),
});
export const wrapUpBillingDraftSectionSchema = wrapUpSectionSchema.extend({
  items: z.array(wrapUpBillingDraftItemSchema).max(20).default([]),
});

export const startEventWrapUpSchema = z.object({ mode: wrapUpModeSchema.default("full") });
export type StartEventWrapUpInput = z.infer<typeof startEventWrapUpSchema>;

export const updateEventWrapUpSchema = z.object({
  mode: wrapUpModeSchema.optional(),
  requiredItems: z.record(z.string(), z.boolean()).optional(),
  // Logistics is not writable here: its checklist state mirrors the PMCM logistics completion record.
  sections: z.object({
    issues: wrapUpSectionSchema.optional(),
    feedback: wrapUpSectionSchema.optional(),
    supplierEgress: wrapUpSectionSchema.optional(),
    billingDraft: wrapUpBillingDraftSectionSchema.optional(),
  }).strict().optional(),
  clientAcknowledged: z.boolean().optional(),
  clientAcknowledgementNote: z.string().trim().max(2000).optional(),
});
export type UpdateEventWrapUpInput = z.infer<typeof updateEventWrapUpSchema>;

/** PMCM-recorded logistics completion. Notes are PMCM-only and never returned to portals. */
export const recordLogisticsCompletionSchema = z.object({
  assetReturnsVerified: z.literal(true),
  completionSummary: z.string().trim().min(1).max(2000),
  privateNotes: z.string().trim().max(4000).default(""),
  correctionReason: z.string().trim().min(1).max(500).optional(),
});
export type RecordLogisticsCompletionInput = z.infer<typeof recordLogisticsCompletionSchema>;

/** Side-by-side archive comparison: 2 to 4 distinct archived event ids, comma-separated in the query. */
export const archiveComparisonQuerySchema = z.object({
  eventIds: z
    .string()
    .trim()
    .transform((value) => value.split(",").map((id) => id.trim()).filter(Boolean))
    .pipe(
      z
        .array(z.string().min(1))
        .min(2, "Select at least two archived events to compare")
        .max(4, "Compare at most four archived events")
        .refine((ids) => new Set(ids).size === ids.length, "Compared events must be distinct"),
    ),
});
export type ArchiveComparisonQuery = z.infer<typeof archiveComparisonQuerySchema>;
/** PMCM-set event privacy. Private events may use table assignment and the seating list (under 200 guests). */
export const eventPrivacySchema = z.enum(["private", "public"]);
export type PrismEventPrivacy = z.infer<typeof eventPrivacySchema>;
export const setEventPrivacySchema = z.object({ privacy: eventPrivacySchema });
export type SetEventPrivacyInput = z.infer<typeof setEventPrivacySchema>;

/** FR-24 Toggle System: optional modules PMCM switches off for a simpler event. Every module starts on. */
export const EVENT_MODULES = ["floorplans", "games", "venue_scouting", "accreditation", "logistics", "client_owned_suppliers"] as const;
export type EventModule = (typeof EVENT_MODULES)[number];
export const EVENT_MODULE_LABELS: Record<EventModule, string> = {
  floorplans: "Floor plans",
  games: "In-event games",
  venue_scouting: "Venue scouting",
  accreditation: "Accreditation documents",
  logistics: "Logistics bookings",
  client_owned_suppliers: "Client-owned suppliers",
};
export const setEventModulesSchema = z.object({
  disabledModules: z.array(z.enum(EVENT_MODULES)).max(EVENT_MODULES.length).refine((modules) => new Set(modules).size === modules.length, "Each module is listed once"),
}).strict();
export type SetEventModulesInput = z.infer<typeof setEventModulesSchema>;

export function isEventModuleEnabled(event: { disabledModules?: readonly string[] | null } | null | undefined, module: EventModule): boolean {
  return !(event?.disabledModules ?? []).includes(module);
}

export const setClientEventDayViewSchema = z.object({
  enabled: z.boolean(),
});
export type SetClientEventDayViewInput = z.infer<typeof setClientEventDayViewSchema>;

export const submitClientOcularVisitSchema = z.object({
  clientNote: optionalTrimmedStringSchema,
});
export type SubmitClientOcularVisitInput = z.infer<typeof submitClientOcularVisitSchema>;

export const scheduleOcularVisitSchema = z.object({
  scheduledAt: z.string().datetime({ offset: true }),
  note: optionalTrimmedStringSchema,
});
export type ScheduleOcularVisitInput = z.infer<typeof scheduleOcularVisitSchema>;

export const waiveOcularVisitSchema = z.object({
  reason: nonEmptyStringSchema,
});
export type WaiveOcularVisitInput = z.infer<typeof waiveOcularVisitSchema>;

export const grantSecondaryClientAccessSchema = z.object({
  userId: nonEmptyStringSchema,
});
export type GrantSecondaryClientAccessInput = z.infer<typeof grantSecondaryClientAccessSchema>;


