import type { PrismEvent } from '@prism/types';
import type { OpsEvent, OpsFloorPlanDraft } from '@prisma/client';
import { mapOnboardingFloorPlanDraft } from '@prism/contexts/event-lifecycle';
import { guestAccessCode } from '@prism/contexts/operations';

type EventWithDrafts = OpsEvent & { floorPlanDrafts?: OpsFloorPlanDraft[] };

function isoDate(value: Date) {
  return value.toISOString().slice(0, 10);
}

function timestamp(value: Date) {
  return value.toISOString();
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
    eventType: event.eventType,
    coverObjectId: event.coverObjectId,
    walkInPolicy: event.walkInPolicy as 'closed' | 'open' | 'threshold',
    walkInThreshold: event.walkInThreshold,
    status: event.status,
    clientPortalStatus: event.clientPortalStatus as 'locked' | 'unlocked',
    clientEventDayViewEnabled: event.clientEventDayViewEnabled,
    disabledModules: event.disabledModules as PrismEvent['disabledModules'],
    proposalClientStatus: event.proposalClientStatus,
    // The client's own decision history and change cutoff: how many change requests are used, when they last
    // decided, and when changes close. PMCM's freeze reason and exceptions stay out.
    proposalRevisionCount: event.proposalRevisionCount,
    proposalReviewedAt: event.proposalReviewedAt?.toISOString() ?? null,
    freezeStatus: event.freezeStatus,
    freezeDeadlineAt: event.freezeDeadlineAt?.toISOString() ?? null,
    readiness: event.readiness,
    archived: event.archived,
    floorPlanStatus: event.floorPlanStatus,
    floorPlanId: event.floorPlanId,
    guestAccessCode: guestAccessCode(event),
    activeFloorPlanDraftId: activeDraft?.id,
    floorPlanDrafts: floorPlanDrafts.map(mapOnboardingFloorPlanDraft),
  };
}
