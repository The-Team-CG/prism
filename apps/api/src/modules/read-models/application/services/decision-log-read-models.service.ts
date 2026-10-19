import { Injectable, NotFoundException } from '@nestjs/common';
import type { PrismDecisionLog, PrismDecisionLogQuery } from '@prism/types';
import { EventAccessPolicyService, type ResolvedEventOpsActor } from '@prism/kernel/access-control';
import { OpsUserRole } from '@prism/kernel/event-core';
import { EventReadModelQueries } from '../queries/event-read-models.queries';
import { compareDecisionLogEntries, countDecisionLogKinds, mapDecisionLogEntries } from '../mappers/decision-log.mappers';

const DECISION_LOG_RESOURCE = 'PMCM decision log';

/**
 * Read-only PMCM Decision Log (FL-019). Composes the dedicated decision, override, waiver, and
 * approval records of one event, newest first, with an optional kind filter and offset paging.
 * PMCM-only: coordinators, clients, suppliers, guests, and unverified actors are refused and the
 * refusal is audited by the access policy.
 */
@Injectable()
export class DecisionLogReadModelsService {
  constructor(
    private readonly queries: EventReadModelQueries,
    private readonly policy: EventAccessPolicyService,
  ) {}

  async getDecisionLog(eventId: string, actor: ResolvedEventOpsActor, query: PrismDecisionLogQuery): Promise<PrismDecisionLog> {
    await this.policy.requireActorRole(actor, [OpsUserRole.PmcmAdmin, OpsUserRole.System], DECISION_LOG_RESOURCE, eventId);
    const sources = await this.queries.decisionLogSourcesForEvent(eventId);
    if (!sources) throw new NotFoundException('Event not found');
    await this.policy.requireCanReadEvent(actor, sources.event, DECISION_LOG_RESOURCE);

    const all = mapDecisionLogEntries(sources).sort(compareDecisionLogEntries);
    const filtered = query.kind ? all.filter((item) => item.kind === query.kind) : all;
    const start = query.page * query.pageSize;
    const entries = filtered.slice(start, start + query.pageSize);

    return {
      eventId,
      generatedAt: new Date().toISOString(),
      kind: query.kind ?? null,
      page: { index: query.page, size: query.pageSize, total: filtered.length, hasMore: start + entries.length < filtered.length },
      kindCounts: countDecisionLogKinds(all),
      entries,
    };
  }
}
