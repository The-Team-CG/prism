import type { PrismEventHandoff, PrismEventSchedule } from "./operations.js";

/**
 * Read model for the PMCM Handoff Brief (FL-021). Composed server-side from scoped reads.
 * Coordinator scope is a strict subset: no finance, private supplier notes, audit categories,
 * client identity, or guest access codes. Fields are projected, never passed through raw rows.
 */
export type PrismHandoffBriefScope = "pmcm" | "coordinator";

export interface PrismHandoffBriefKeyDetails {
  eventId: string;
  eventName: string;
  eventDate: string;
  status: string;
  archived: boolean;
  venue: string | null;
  guestCount: number | null;
  walkInPolicy: string;
  /** Null outside PMCM scope. */
  clientName: string | null;
}

export interface PrismHandoffBriefSupplier {
  id: string;
  supplierName: string;
  category: string;
  assignmentStatus: string;
  readinessStatus: string;
  eventDayStatus: string;
  verificationStatus: string;
}

export interface PrismHandoffBriefAssignment {
  id: string;
  coordinatorName: string;
  role: string;
  status: string;
  attendanceStatus: string;
}

export interface PrismHandoffBriefIssue {
  id: string;
  title: string;
  description: string;
  severity: string;
  status: string;
  affectedArea: string;
  ownerRole: string;
  ownerName: string;
  slaStatus: string;
}

export interface PrismHandoffBriefFileItem {
  key: string;
  label: string;
  ownerRole: string;
  status: string;
  dueDate: string | null;
}

export interface PrismHandoffBrief {
  eventId: string;
  scope: PrismHandoffBriefScope;
  generatedAt: string;
  keyDetails: PrismHandoffBriefKeyDetails;
  schedule: PrismEventSchedule;
  supplierReadiness: {
    /** False when the actor's role does not receive supplier readiness; items are then empty. */
    visible: boolean;
    items: PrismHandoffBriefSupplier[];
  };
  staffing: PrismHandoffBriefAssignment[];
  openIssues: PrismHandoffBriefIssue[];
  files: PrismHandoffBriefFileItem[];
  handoffs: PrismEventHandoff[];
}
