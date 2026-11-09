import { BadRequestException, ForbiddenException, Inject, Injectable, NotFoundException, Optional, ServiceUnavailableException } from '@nestjs/common';
import type { OpsPresentationMeeting } from '@prisma/client';
import { randomUUID } from 'node:crypto';
import { PrismaService, toPrismaJson } from '@prism/kernel/database';
import { AuditActionType, AuditCategory, OpsUserRole } from '@prism/kernel/event-core';
import { AUDIT_WRITER, EventAccessPolicyService, type AuditWriter, type ResolvedEventOpsActor, writeAudit } from '@prism/kernel/access-control';
import { OPERATIONS_EVENT_REFERENCE_READER, type OperationsEventReferenceReader } from '@prism/contexts/event-lifecycle/operations-reference';
import { NOTIFICATION_OUTBOX_WRITER, type NotificationOutboxWriter, writeNotification } from '@prism/contexts/platform-ops';
import type {
  ChoosePresentationSlotInput,
  PrismPresentationMeeting,
  PrismPresentationMeetings,
  ProposePresentationMeetingInput,
  RecordPresentationOutcomeInput,
} from '@prism/types';
import { isPrimaryClientContact } from '../../domain/proposal-client-review.policy';
import { ZOOM_MEETINGS, type ZoomMeetings } from '../../contracts/zoom-meetings.port';

type Slot = { startsAt: string; endsAt: string };

function mapMeeting(row: OpsPresentationMeeting): PrismPresentationMeeting {
  return {
    id: row.id, eventId: row.eventId, title: row.title, slots: (Array.isArray(row.slots) ? row.slots : []) as Slot[],
    chosen: row.chosenStartAt && row.chosenEndAt ? { startsAt: row.chosenStartAt.toISOString(), endsAt: row.chosenEndAt.toISOString() } : null,
    meetingLink: row.meetingLink, zoomMeeting: row.createZoomMeeting, status: row.status as PrismPresentationMeeting['status'], createdAt: row.createdAt.toISOString(),
  };
}

/** Two no-shows in a row, counting only meetings whose attendance was recorded. */
export function presentationAtRisk(meetings: Array<{ status: string }>): boolean {
  const recorded = meetings.filter((meeting) => meeting.status === 'attended' || meeting.status === 'no_show');
  return recorded.length >= 2 && recorded.slice(0, 2).every((meeting) => meeting.status === 'no_show');
}

/** FR-61: PMCM offers presentation slots, the primary client picks one, and PMCM records attendance. */
@Injectable()
export class PresentationMeetingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: EventAccessPolicyService,
    @Inject(AUDIT_WRITER) private readonly auditWriter: AuditWriter,
    @Inject(OPERATIONS_EVENT_REFERENCE_READER) private readonly events: OperationsEventReferenceReader,
    @Inject(NOTIFICATION_OUTBOX_WRITER) private readonly notifications: NotificationOutboxWriter,
    @Optional() @Inject(ZOOM_MEETINGS) private readonly zoom?: ZoomMeetings | null,
  ) {}

  async list(eventId: string, actor: ResolvedEventOpsActor): Promise<PrismPresentationMeetings> {
    await this.access.requireActorRole(actor, [OpsUserRole.Client, OpsUserRole.PmcmAdmin], 'presentation meetings', eventId);
    if (actor.role === OpsUserRole.Client) await this.requirePrimaryClient(eventId, actor);
    const rows = await this.prisma.opsPresentationMeeting.findMany({ where: { eventId, status: { not: 'superseded' } }, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }], take: 20 });
    return { meetings: rows.map(mapMeeting), atRisk: presentationAtRisk(rows) };
  }

  /** Proposing again (to reschedule) replaces any meeting still waiting for a slot or held. */
  async propose(eventId: string, input: ProposePresentationMeetingInput, actor: ResolvedEventOpsActor): Promise<PrismPresentationMeeting> {
    await this.access.requireActorRole(actor, [OpsUserRole.PmcmAdmin], 'presentation meetings', eventId);
    const event = await this.events.findEventReadAccess(eventId);
    if (!event) throw new NotFoundException('Event not found');
    if (input.createZoomMeeting && !this.zoom) throw new ServiceUnavailableException('Zoom is not configured for this deployment; paste a meeting link instead');
    const { row, replacedZoomIds } = await this.prisma.$transaction(async (tx) => {
      const open = await tx.opsPresentationMeeting.findMany({ where: { eventId, status: { in: ['proposed', 'scheduled'] } }, select: { zoomMeetingId: true } });
      await tx.opsPresentationMeeting.updateMany({ where: { eventId, status: { in: ['proposed', 'scheduled'] } }, data: { status: 'superseded' } });
      const created = await tx.opsPresentationMeeting.create({ data: {
        id: `pmeet_${randomUUID()}`, eventId, title: input.title, slots: toPrismaJson(input.slots), meetingLink: input.meetingLink ?? null,
        createZoomMeeting: Boolean(input.createZoomMeeting), createdBy: actor.id ?? actor.name,
      } });
      return { row: created, replacedZoomIds: open.flatMap((meeting) => (meeting.zoomMeetingId ? [meeting.zoomMeetingId] : [])) };
    });
    await this.removeReplacedZoomMeetings(eventId, actor, replacedZoomIds);
    if (event.inquiry?.email) {
      await writeNotification(this.notifications, eventId, event.inquiry.email, `PMCM proposed times for "${input.title}". Choose one in your client portal.`, 'email', { idempotencyKey: `presentation-proposed:${row.id}` });
    }
    await this.audit(eventId, actor, `Proposed presentation times: ${input.title}`, row.id);
    return mapMeeting(row);
  }

  async choose(eventId: string, meetingId: string, input: ChoosePresentationSlotInput, actor: ResolvedEventOpsActor): Promise<PrismPresentationMeeting> {
    await this.access.requireActorRole(actor, [OpsUserRole.Client], 'presentation slot', eventId);
    await this.requirePrimaryClient(eventId, actor);
    const meeting = await this.requireMeeting(eventId, meetingId, ['proposed']);
    const slot = mapMeeting(meeting).slots.find((candidate) => Date.parse(candidate.startsAt) === Date.parse(input.startsAt));
    if (!slot) throw new BadRequestException('Choose one of the offered times');
    const zoom = meeting.createZoomMeeting ? await this.createZoomMeeting(meeting, slot) : null;
    try {
      const row = await this.prisma.opsPresentationMeeting.update({ where: { id: meetingId }, data: {
        status: 'scheduled', chosenStartAt: new Date(slot.startsAt), chosenEndAt: new Date(slot.endsAt),
        ...(zoom ? { meetingLink: zoom.joinUrl, zoomMeetingId: zoom.meetingId } : {}),
      } });
      await this.audit(eventId, actor, `Client chose a presentation time: ${slot.startsAt}`, row.id);
      return mapMeeting(row);
    } catch (error) {
      // The booking did not save, so the Zoom meeting made for it would be orphaned.
      if (zoom) await this.zoom?.remove(zoom.meetingId).catch(() => undefined);
      throw error;
    }
  }

  async recordOutcome(eventId: string, meetingId: string, input: RecordPresentationOutcomeInput, actor: ResolvedEventOpsActor): Promise<PrismPresentationMeeting> {
    await this.access.requireActorRole(actor, [OpsUserRole.PmcmAdmin], 'presentation attendance', eventId);
    await this.requireMeeting(eventId, meetingId, ['scheduled']);
    const row = await this.prisma.opsPresentationMeeting.update({ where: { id: meetingId }, data: { status: input.outcome } });
    await this.audit(eventId, actor, input.outcome === 'no_show' ? 'Client did not attend the presentation' : 'Presentation held', row.id);
    return mapMeeting(row);
  }

  private async createZoomMeeting(meeting: OpsPresentationMeeting, slot: Slot) {
    if (!this.zoom) throw new ServiceUnavailableException('Zoom is not configured for this deployment');
    const durationMinutes = Math.max(15, Math.round((Date.parse(slot.endsAt) - Date.parse(slot.startsAt)) / 60_000));
    return this.zoom.create({ topic: meeting.title, startsAt: new Date(slot.startsAt), durationMinutes });
  }

  /** A rescheduled presentation's old Zoom meeting is deleted; if Zoom refuses, the audit tells PMCM to remove it by hand. */
  private async removeReplacedZoomMeetings(eventId: string, actor: ResolvedEventOpsActor, meetingIds: string[]) {
    // QUERY_AUDIT_ALLOW_BOUNDED_LOOP: provider calls only, at most the one or two open meetings of one event.
    for (const meetingId of meetingIds) {
      try {
        await this.zoom?.remove(meetingId);
      } catch {
        await this.audit(eventId, actor, `Could not delete replaced Zoom meeting ${meetingId}; delete it in Zoom`, meetingId);
      }
    }
  }

  private async requireMeeting(eventId: string, meetingId: string, statuses: string[]) {
    const meeting = await this.prisma.opsPresentationMeeting.findFirst({ where: { id: meetingId, eventId } });
    if (!meeting) throw new NotFoundException('Meeting not found');
    if (!statuses.includes(meeting.status)) throw new BadRequestException('This meeting cannot change now');
    return meeting;
  }

  private async requirePrimaryClient(eventId: string, actor: ResolvedEventOpsActor) {
    const event = await this.events.findEventReadAccess(eventId);
    if (!event) throw new NotFoundException('Event not found');
    await this.access.requireCanReadEvent(actor, { ...event, inquiry: { email: event.inquiry?.email ?? '' } }, 'presentation meetings');
    if (!isPrimaryClientContact(actor.email ?? '', event.inquiry?.email ?? '')) throw new ForbiddenException('Only the primary client contact can schedule the presentation');
  }

  private audit(eventId: string, actor: ResolvedEventOpsActor, action: string, affectedId: string) {
    return writeAudit(this.auditWriter, eventId, actor.name, action, {
      actorRole: actor.role, actorEmail: actor.email, category: AuditCategory.Events, actionType: AuditActionType.Update,
      affectedType: 'presentation_meeting', affectedId, metadata: { actorId: actor.id ?? null },
    });
  }
}
