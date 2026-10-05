import { Injectable } from '@nestjs/common';
import { PrismaService } from '@prism/kernel/database';
import type { GuestEventProjectionReader } from '../../contracts/ports/guest-event-projection.port';

const MAX_GUEST_EVENT_FLOORPLAN_DRAFTS = 100;
const MAX_COORDINATOR_WORKSPACE_DRAFTS = 100;

@Injectable()
export class GuestEventProjectionService implements GuestEventProjectionReader {
  constructor(private readonly prisma: PrismaService) {}

  listGuestAccessCandidates(includeArchived: boolean) {
    // QUERY_AUDIT_ALLOW_UNBOUNDED: access codes derive from event name and ID, so candidates must cover the full active event set.
    return this.prisma.opsEvent.findMany({
      where: includeArchived ? {} : { archived: false },
      select: { id: true, eventName: true, eventDate: true, updatedAt: true, archived: true },
      orderBy: [{ eventDate: 'asc' }, { id: 'asc' }],
    });
  }

  findGuestEvent(eventId: string) {
    return this.prisma.opsEvent.findUnique({
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
        floorPlanDrafts: {
          select: { id: true, floorPlanId: true, isActive: true },
          orderBy: [{ updatedAt: 'desc' }, { id: 'desc' }],
          take: MAX_GUEST_EVENT_FLOORPLAN_DRAFTS,
        },
      },
    });
  }

  listCoordinatorWorkspaceEvents(eventIds: readonly string[]) {
    if (eventIds.length === 0) return Promise.resolve([]);
    return this.prisma.opsEvent.findMany({
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
        floorPlanDrafts: { orderBy: [{ updatedAt: 'desc' }, { id: 'desc' }], take: MAX_COORDINATOR_WORKSPACE_DRAFTS },
        briefings: {
          orderBy: [{ submittedAt: 'desc' }, { id: 'desc' }],
          take: 1,
          select: { venue: true },
        },
      },
      orderBy: [{ eventDate: 'asc' }, { id: 'asc' }],
      take: eventIds.length,
    });
  }
}