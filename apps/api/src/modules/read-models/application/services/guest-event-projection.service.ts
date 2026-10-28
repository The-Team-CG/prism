import { Injectable } from '@nestjs/common';
import { PrismaService } from '@prism/kernel/database';
import { findFloorPlanDraftsByEvent, withFloorPlanDrafts } from '@prism/contexts/floorplan/event-drafts';
import type { GuestEventProjectionReader } from '../../contracts/ports/guest-event-projection.port';

const MAX_GUEST_EVENT_FLOORPLAN_DRAFTS = 100;
const MAX_COORDINATOR_WORKSPACE_DRAFTS = 100;

/**
 * Guests only see arrival facts PMCM has agreed to: the briefing the client's approved proposal was built on.
 * A briefing resubmitted after that approval is unconfirmed until the proposal is approved again.
 */
function confirmedArrivalFrom(
  proposalClientStatus: string,
  proposalReviewedAt: Date | null,
  briefing?: { venue: string; confirmedStartTime: string | null; submittedAt: Date },
) {
  if (proposalClientStatus !== 'approved' || !proposalReviewedAt || !briefing) return undefined;
  if (briefing.submittedAt > proposalReviewedAt) return undefined;
  return { venue: briefing.venue, confirmedStartTime: briefing.confirmedStartTime };
}

@Injectable()
export class GuestEventProjectionService implements GuestEventProjectionReader {
  constructor(private readonly prisma: PrismaService) {}

  listGuestAccessCandidates(includeArchived: boolean) {
    // QUERY_AUDIT_ALLOW_UNBOUNDED: access codes derive from event name and ID, so candidates must cover the full active event set.
    return this.prisma.opsEvent.findMany({
      where: includeArchived ? {} : { archived: false },
      select: { id: true, eventName: true, eventDate: true, actualEndedAt: true, updatedAt: true, archived: true },
      orderBy: [{ eventDate: 'asc' }, { id: 'asc' }],
    });
  }

  async findGuestEvent(eventId: string) {
    const event = await this.prisma.opsEvent.findUnique({
      where: { id: eventId },
      select: {
        id: true,
        eventName: true,
        eventDate: true,
        status: true,
        archived: true,
        actualEndedAt: true,
        walkInPolicy: true,
        walkInThreshold: true,
        clientName: true,
        readiness: true,
        floorPlanStatus: true,
        floorPlanId: true,
        updatedAt: true,
        proposalClientStatus: true,
        proposalReviewedAt: true,
        briefings: {
          orderBy: [{ submittedAt: 'desc' }, { id: 'desc' }],
          take: 1,
          select: { venue: true, confirmedStartTime: true, submittedAt: true },
        },
      },
    });
    if (!event) return null;
    const { proposalClientStatus, proposalReviewedAt, briefings, ...guestEvent } = event;
    const drafts = await findFloorPlanDraftsByEvent(this.prisma, [eventId], { perEventLimit: MAX_GUEST_EVENT_FLOORPLAN_DRAFTS });
    const confirmedArrival = confirmedArrivalFrom(proposalClientStatus, proposalReviewedAt, briefings[0]);
    return {
      ...guestEvent,
      ...(confirmedArrival ? { confirmedArrival } : {}),
      floorPlanDrafts: (drafts.get(eventId) ?? []).map(({ id, floorPlanId, isActive }) => ({ id, floorPlanId, isActive })),
    };
  }

  async listCoordinatorWorkspaceEvents(eventIds: readonly string[]) {
    if (eventIds.length === 0) return [];
    const events = await this.prisma.opsEvent.findMany({
      where: { id: { in: [...eventIds] } },
      select: {
        id: true,
        inquiryId: true,
        clientName: true,
        eventName: true,
        eventDate: true,
        status: true,
        clientPortalStatus: true,
        readiness: true,
        archived: true,
        floorPlanStatus: true,
        floorPlanId: true,
        briefings: {
          orderBy: [{ submittedAt: 'desc' }, { id: 'desc' }],
          take: 1,
          select: { venue: true },
        },
      },
      orderBy: [{ eventDate: 'asc' }, { id: 'asc' }],
      take: eventIds.length,
    });
    const drafts = await findFloorPlanDraftsByEvent(this.prisma, events.map(({ id }) => id), { perEventLimit: MAX_COORDINATOR_WORKSPACE_DRAFTS });
    return withFloorPlanDrafts(events, drafts);
  }
}
