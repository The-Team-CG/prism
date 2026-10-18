import type { OpsEventHandoff } from '@prisma/client';
import type {
  PrismEventHandoff,
  PrismHandoffBriefAssignment,
  PrismHandoffBriefFileItem,
  PrismHandoffBriefIssue,
  PrismHandoffBriefKeyDetails,
  PrismHandoffBriefSupplier,
  PrismBriefing,
  PrismCoordinatorAssignment,
  PrismEvent,
  PrismSupplierQuoteRequest,
  PrismUrgentIssue,
} from '@prism/types';
import { UrgentIssueStatus } from '@prism/kernel/event-core';

/** Finance file requirements never appear in the handoff brief, for any role. */
export const HANDOFF_BRIEF_EXCLUDED_FILE_CATEGORY = 'finance';

export function mapEventHandoff(handoff: OpsEventHandoff): PrismEventHandoff {
  return {
    id: handoff.id,
    eventId: handoff.eventId,
    dayId: handoff.dayId,
    role: handoff.role,
    fromAssignmentId: handoff.fromAssignmentId,
    toAssignmentId: handoff.toAssignmentId,
    handedOffBy: handoff.handedOffBy,
    receivedBy: handoff.receivedBy,
    handedOffAt: handoff.handedOffAt.toISOString(),
    outstandingItems: Array.isArray(handoff.outstandingItems)
      ? handoff.outstandingItems.filter((item): item is string => typeof item === 'string')
      : [],
  };
}

export function projectHandoffKeyDetails(
  event: PrismEvent,
  briefing: PrismBriefing | null,
  includeClient: boolean,
): PrismHandoffBriefKeyDetails {
  return {
    eventId: event.id,
    eventName: event.eventName,
    eventDate: event.eventDate,
    status: event.status,
    archived: event.archived,
    venue: briefing?.venue ?? null,
    guestCount: briefing?.guestCount ?? null,
    walkInPolicy: event.walkInPolicy,
    clientName: includeClient ? event.clientName : null,
  };
}

/** Supplier readiness projection: status fields only, so readiness/verification notes stay private. */
export function projectHandoffSupplier(request: PrismSupplierQuoteRequest): PrismHandoffBriefSupplier {
  return {
    id: request.id,
    supplierName: request.supplierName,
    category: request.category,
    assignmentStatus: request.assignmentStatus,
    readinessStatus: request.readinessStatus,
    eventDayStatus: request.eventDayStatus,
    verificationStatus: request.verificationStatus,
  };
}

export function projectHandoffAssignment(assignment: PrismCoordinatorAssignment): PrismHandoffBriefAssignment {
  return {
    id: assignment.id,
    coordinatorName: assignment.coordinatorName,
    role: assignment.role,
    status: assignment.status,
    attendanceStatus: assignment.attendanceStatus ?? 'pending',
  };
}

export function isOpenHandoffIssue(issue: PrismUrgentIssue) {
  return issue.status !== UrgentIssueStatus.Resolved && issue.status !== UrgentIssueStatus.Cancelled && !issue.resolvedAt;
}

export function projectHandoffIssue(issue: PrismUrgentIssue): PrismHandoffBriefIssue {
  return {
    id: issue.id,
    title: issue.title,
    description: issue.description,
    severity: issue.severity,
    status: issue.status,
    affectedArea: issue.affectedArea,
    ownerRole: issue.ownerRole,
    ownerName: issue.ownerName,
    slaStatus: issue.slaStatus,
  };
}

type FileRequirementItem = {
  key: string;
  label: string;
  ownerRole: string;
  visibleToRoles: string[];
  status: string;
  dueDate?: string;
  auditCategory: string;
};

/** Keeps only items the actor's role may see and drops finance items; audit and detail fields are not projected. */
export function projectHandoffFiles(items: FileRequirementItem[], actorRole: string): PrismHandoffBriefFileItem[] {
  return items
    .filter((item) => item.auditCategory !== HANDOFF_BRIEF_EXCLUDED_FILE_CATEGORY && item.visibleToRoles.includes(actorRole))
    .map((item) => ({
      key: item.key,
      label: item.label,
      ownerRole: item.ownerRole,
      status: item.status,
      dueDate: item.dueDate ?? null,
    }));
}
