import type { OpsEvent, OpsFloorPlanDraft } from '@prisma/client';

type EventWithDrafts = OpsEvent & { floorPlanDrafts?: OpsFloorPlanDraft[] };

function isoDate(value: Date) {
  return value.toISOString().slice(0, 10);
}

function timestamp(value: Date) {
  return value.toISOString();
}

function guestAccessCode(event: Pick<OpsEvent, 'id' | 'eventName'>) {
  const namePart =
    event.eventName
      .toUpperCase()
      .replace(/[^A-Z0-9]+/g, '-')
      .split('-')
      .filter(Boolean)
      .slice(0, 2)
      .join('-') || 'PRISM';
  const idPart = event.id.replace(/[^a-zA-Z0-9]/g, '').slice(-4).toUpperCase() || 'EVNT';
  return `${namePart}-${idPart}`;
}

export function mapReadModelFloorPlanDraft(draft: OpsFloorPlanDraft) {
  const expanded = draft as OpsFloorPlanDraft & {
    submittedSnapshot?: unknown;
    approvedSnapshot?: unknown;
    submittedSnapshotAt?: Date | null;
    approvedSnapshotAt?: Date | null;
    revisionComment?: string;
  };
  return {
    id: draft.id,
    eventId: draft.eventId,
    floorPlanId: draft.floorPlanId,
    name: draft.name,
    status: draft.status,
    isActive: draft.isActive,
    sourceType: draft.sourceType,
    createdByRole: draft.createdByRole,
    clientPreference: draft.clientPreference ?? undefined,
    submittedSnapshot: expanded.submittedSnapshot ?? undefined,
    approvedSnapshot: expanded.approvedSnapshot ?? undefined,
    submittedAt: draft.submittedAt ? timestamp(draft.submittedAt) : undefined,
    reviewedAt: draft.reviewedAt ? timestamp(draft.reviewedAt) : undefined,
    approvedAt: draft.approvedAt ? timestamp(draft.approvedAt) : undefined,
    submittedSnapshotAt: expanded.submittedSnapshotAt ? timestamp(expanded.submittedSnapshotAt) : undefined,
    approvedSnapshotAt: expanded.approvedSnapshotAt ? timestamp(expanded.approvedSnapshotAt) : undefined,
    revisionComment: expanded.revisionComment ?? '',
    createdAt: timestamp(draft.createdAt),
    updatedAt: timestamp(draft.updatedAt),
  };
}

export function mapBillingEvent(event: EventWithDrafts) {
  const floorPlanDrafts = event.floorPlanDrafts ?? [];
  const activeDraft =
    floorPlanDrafts.find((draft) => draft.isActive) ??
    floorPlanDrafts.find((draft) => draft.floorPlanId === event.floorPlanId);

  return {
    id: event.id,
    inquiryId: event.inquiryId,
    clientName: event.clientName,
    eventName: event.eventName,
    eventDate: isoDate(event.eventDate),
    walkInPolicy: event.walkInPolicy as 'closed' | 'open' | 'threshold',
    walkInThreshold: event.walkInThreshold,
    status: event.status,
    clientPortalStatus: event.clientPortalStatus as 'locked' | 'unlocked',
    clientEventDayViewEnabled: event.clientEventDayViewEnabled,
    readiness: event.readiness,
    archived: event.archived,
    floorPlanStatus: event.floorPlanStatus,
    floorPlanId: event.floorPlanId,
    guestAccessCode: guestAccessCode(event),
    activeFloorPlanDraftId: activeDraft?.id,
    floorPlanDrafts: floorPlanDrafts.map(mapReadModelFloorPlanDraft),
  };
}
