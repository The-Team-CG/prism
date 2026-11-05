import { Inject, Injectable } from '@nestjs/common';
import { EventAccessPolicyService, type ResolvedEventOpsActor } from '@prism/kernel/access-control';
import { OpsUserRole } from '@prism/kernel/event-core';
import { FILE_REQUIREMENT_READER, type FileRequirementReader } from '@prism/contexts/event-lifecycle';
import type { PmcmCalendarQuery, PrismPmcmCalendar, PrismPmcmEventSummaries, PrismPmcmFileSummaries } from '@prism/types';
import {
  buildEventSummaries,
  buildPmcmCalendarItems,
  manilaDateKeyOf,
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
