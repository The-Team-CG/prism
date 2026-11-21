import { Inject, Injectable } from '@nestjs/common';
import { EventAccessPolicyService, type ResolvedEventOpsActor } from '@prism/kernel/access-control';
import { OpsUserRole } from '@prism/kernel/event-core';
import { FILE_REQUIREMENT_READER, type FileRequirementReader } from '@prism/contexts/event-lifecycle';
import { NotFoundException } from '@nestjs/common';
import type { PmcmCalendarQuery, PrismPmcmCalendar, PrismPmcmClientActivity, PrismPmcmClientFacts, PrismPmcmEventSummaries, PrismPmcmFileSummaries, PrismPmcmSupplierNextBookings } from '@prism/types';
import {
  buildEventSummaries,
  buildPmcmCalendarItems,
  manilaDateKeyOf,
  nextBookingPerSupplier,
  summarizeEventBalances,
  summarizeFileRequirements,
  unreadMessagesByEvent,
} from '../mappers/pmcm-overview.mappers';
import { PmcmOverviewQueries } from '../queries/pmcm-overview.queries';

const PMCM_ROLES = [OpsUserRole.PmcmAdmin, OpsUserRole.System];

/** Each event's file requirements take about a dozen queries to derive, so the read covers a bounded set in small batches. */
export const FILE_SUMMARY_EVENT_LIMIT = 25;
const FILE_SUMMARY_BATCH = 5;

/** Read-only PMCM overviews that span events: money and unread messages per event, and the cross-event calendar. */
@Injectable()
export class PmcmOverviewService {
  constructor(
    private readonly queries: PmcmOverviewQueries,
    private readonly policy: EventAccessPolicyService,
    @Inject(FILE_REQUIREMENT_READER) private readonly fileRequirements: FileRequirementReader,
  ) {}

  async eventSummaries(actor: ResolvedEventOpsActor): Promise<PrismPmcmEventSummaries> {
    await this.policy.requireActorRole(actor, PMCM_ROLES, 'PMCM event summaries');
    const now = new Date();
    const [milestones, unread] = await Promise.all([this.queries.openMilestones(), this.unreadFor(actor)]);
    return {
      generatedAt: now.toISOString(),
      items: buildEventSummaries(summarizeEventBalances(milestones, manilaDateKeyOf(now)), unread),
    };
  }

  /**
   * Per-event facts the client list and client profiles roll up per client: billed and paid across current
   * milestones, the client's closeout rating, and their last portal sign-in. Clients are grouped in the portal, the
   * same way it groups them for the client list, so the API never has to agree with that grouping.
   */
  async clientFacts(actor: ResolvedEventOpsActor): Promise<PrismPmcmClientFacts> {
    await this.policy.requireActorRole(actor, PMCM_ROLES, 'PMCM client facts');
    const [totals, ratings, events, logins] = await Promise.all([
      this.queries.milestoneTotals(),
      this.queries.closeoutRatings(),
      this.queries.eventClients(),
      this.queries.clientLogins(),
    ]);
    const totalsByEvent = new Map(totals.map((row) => [row.eventId, row._sum]));
    const ratingByEvent = new Map(ratings.map((row) => [row.eventId, row.rating]));
    const loginByEmail = new Map(logins.map((row) => [row.email.trim().toLowerCase(), row.lastLoginAt?.toISOString() ?? null]));
    return {
      generatedAt: new Date().toISOString(),
      items: events.map((event) => {
        const sums = totalsByEvent.get(event.id);
        return {
          eventId: event.id,
          billed: Number(sums?.amount ?? 0),
          paid: Number(sums?.amountPaid ?? 0),
          closeoutRating: ratingByEvent.get(event.id) ?? null,
          clientLastActiveAt: loginByEmail.get(event.inquiry.email.trim().toLowerCase()) ?? null,
        };
      }),
    };
  }

  /** Each supplier's next confirmed booking on or after today, for the supplier directory's cards. */
  async supplierNextBookings(actor: ResolvedEventOpsActor): Promise<PrismPmcmSupplierNextBookings> {
    await this.policy.requireActorRole(actor, PMCM_ROLES, 'PMCM supplier bookings');
    const now = new Date();
    const assignments = await this.queries.confirmedSupplierAssignments();
    const events = await this.queries.upcomingEventsAmong([...new Set(assignments.map((row) => row.eventId))], manilaDateKeyOf(now));
    return { generatedAt: now.toISOString(), items: nextBookingPerSupplier(assignments, events) };
  }

  /** When the event's client last signed in and how many notices about the event they have not opened, so PMCM knows when to chase. */
  async clientActivity(actor: ResolvedEventOpsActor, eventId: string): Promise<PrismPmcmClientActivity> {
    await this.policy.requireActorRole(actor, PMCM_ROLES, 'PMCM client activity', eventId);
    const client = await this.queries.clientOfEvent(eventId);
    if (!client) throw new NotFoundException('Event not found');
    const unreadNotices = client.email ? await this.queries.unreadEventNotices(eventId, client.email) : 0;
    return { eventId, lastActiveAt: client.lastLoginAt?.toISOString() ?? null, unreadNotices };
  }

  async fileSummaries(actor: ResolvedEventOpsActor): Promise<PrismPmcmFileSummaries> {
    await this.policy.requireActorRole(actor, PMCM_ROLES, 'PMCM file summaries');
    const events = await this.queries.activeEventIds(FILE_SUMMARY_EVENT_LIMIT);
    const items: PrismPmcmFileSummaries['items'] = [];
    for (let start = 0; start < events.length; start += FILE_SUMMARY_BATCH) {
      const batch = events.slice(start, start + FILE_SUMMARY_BATCH);
      const matrices = await Promise.all(batch.map((event) => this.fileRequirements.buildForEvent(event.id)));
      items.push(...matrices.map((matrix) => summarizeFileRequirements(matrix.eventId, matrix.items)));
    }
    return { generatedAt: new Date().toISOString(), items };
  }

  async calendar(actor: ResolvedEventOpsActor, query: PmcmCalendarQuery): Promise<PrismPmcmCalendar> {
    await this.policy.requireActorRole(actor, PMCM_ROLES, 'PMCM calendar');
    const { from, to } = query;
    const [events, quoteRequests, milestones, ocularVisits, schedules, scheduleDays] = await Promise.all([
      this.queries.events(from, to),
      this.queries.quoteDeadlines(from, to),
      this.queries.milestonesDue(from, to),
      this.queries.ocularVisits(from, to),
      this.queries.supplierSchedules(from, to),
      this.queries.scheduleDays(from, to),
    ]);
    const names = await this.queries.eventNames([...new Set([
      ...quoteRequests.map((row) => row.eventId),
      ...milestones.map((row) => row.eventId),
      ...ocularVisits.map((row) => row.eventId),
      ...schedules.map((row) => row.eventId),
      ...scheduleDays.map((row) => row.eventId),
    ])]);
    const eventNames = new Map([...events.map((event) => [event.id, event.eventName] as const), ...names.map((event) => [event.id, event.eventName] as const)]);
    return {
      generatedAt: new Date().toISOString(),
      from,
      to,
      items: buildPmcmCalendarItems({
        from,
        to,
        events,
        eventNames,
        quoteRequests: quoteRequests.flatMap((row) => (row.dueDate ? [{ ...row, dueDate: row.dueDate }] : [])),
        milestones,
        ocularVisits: ocularVisits.flatMap((row) => (row.scheduledAt ? [{ ...row, scheduledAt: row.scheduledAt }] : [])),
        scheduleDays,
        schedules: schedules.map((row) => ({ id: row.id, eventId: row.eventId, ingressAt: row.ingressAt, egressAt: row.egressAt, location: row.location, supplierName: row.request.supplierName })),
      }),
    };
  }

  private async unreadFor(actor: ResolvedEventOpsActor) {
    if (!actor.id) return new Map<string, number>();
    const participations = await this.queries.participations(actor.id);
    const messages = await this.queries.messagesFromOthers(actor.id, participations.map((row) => row.threadId));
    return unreadMessagesByEvent(
      participations.map((row) => ({ threadId: row.threadId, eventId: row.thread.eventId, lastReadAt: row.lastReadAt })),
      messages,
    );
  }
}
