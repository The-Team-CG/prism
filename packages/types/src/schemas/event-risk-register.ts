import { z } from "zod";

/** FR-07: the per-event risk register, organized by event phase. */
export const EVENT_RISK_PHASES = ["planning", "pre_event", "event_day", "post_event"] as const;
export const eventRiskPhaseSchema = z.enum(EVENT_RISK_PHASES);
export type EventRiskPhase = z.infer<typeof eventRiskPhaseSchema>;
export const EVENT_RISK_STATUSES = ["open", "mitigated", "closed"] as const;
const rating = z.number().int().min(1).max(5);

export const createEventRiskSchema = z.object({
  phase: eventRiskPhaseSchema,
  title: z.string().trim().min(1).max(200),
  likelihood: rating,
  impact: rating,
  mitigation: z.string().trim().max(2000).default(""),
  owner: z.string().trim().max(120).default(""),
});
export type CreateEventRiskInput = z.input<typeof createEventRiskSchema>;

export const updateEventRiskSchema = z.object({
  likelihood: rating.optional(),
  impact: rating.optional(),
  mitigation: z.string().trim().max(2000).optional(),
  owner: z.string().trim().max(120).optional(),
  status: z.enum(EVENT_RISK_STATUSES).optional(),
});
export type UpdateEventRiskInput = z.infer<typeof updateEventRiskSchema>;

export interface PrismEventRisk {
  id: string;
  eventId: string;
  phase: EventRiskPhase;
  title: string;
  likelihood: number;
  impact: number;
  /** likelihood × impact, 1 to 25. */
  score: number;
  mitigation: string;
  owner: string;
  status: (typeof EVENT_RISK_STATUSES)[number];
  catalogKey: string | null;
  updatedBy: string;
  updatedAt: string;
}

/** Known operational risks PMCM can load into any event's register. Keys stay stable so loading is idempotent. */
export const STANDARD_EVENT_RISKS: ReadonlyArray<{ key: string; phase: EventRiskPhase; title: string; likelihood: number; impact: number; mitigation: string }> = [
  { key: "client_owned_supplier", phase: "planning", title: "Client-owned supplier outside PMCM contracts", likelihood: 3, impact: 4, mitigation: "Collect the supplier's contact, scope and arrival time; brief them on venue rules and the run sheet." },
  { key: "permit_not_secured", phase: "planning", title: "Venue or LGU permit not secured in time", likelihood: 2, impact: 5, mitigation: "Track permits as required files with due dates; escalate two weeks out." },
  { key: "late_balance_payment", phase: "pre_event", title: "Balance payment not received before the event", likelihood: 3, impact: 4, mitigation: "Send payment reminders; agree a fallback with the client before supplier commitments fall due." },
  { key: "guest_count_over_capacity", phase: "pre_event", title: "Confirmed guests exceed venue capacity", likelihood: 2, impact: 4, mitigation: "Reconcile the masterlist against capacity; set the walk-in policy." },
  { key: "venue_access_delay", phase: "event_day", title: "Venue access or ingress delayed", likelihood: 3, impact: 3, mitigation: "Confirm ingress windows with the venue the day before; keep a production-first setup order." },
  { key: "supplier_no_show", phase: "event_day", title: "Supplier no-show or late arrival", likelihood: 2, impact: 5, mitigation: "Confirm readiness 7 days out; keep a Tier 2 backup per critical category." },
  { key: "technical_failure", phase: "event_day", title: "Power, sound or LED failure", likelihood: 2, impact: 4, mitigation: "Require a technical rehearsal and backup power from the production supplier." },
  { key: "weather_outdoor", phase: "event_day", title: "Bad weather at an outdoor venue", likelihood: 3, impact: 4, mitigation: "Reserve a covered fallback area and tents; decide on the call by noon on event day." },
  { key: "asset_return_loss", phase: "post_event", title: "Rented assets not returned or damaged", likelihood: 2, impact: 3, mitigation: "Check assets against the inventory at egress and record the logistics completion." },
];
