import { Inject, Injectable } from '@nestjs/common';
import { EventAccessPolicyService, type ResolvedEventOpsActor } from '@prism/kernel/access-control';
import { OpsUserRole } from '@prism/kernel/event-core';
import { SUPPLIER_WORKSPACE_READER, type SupplierWorkspaceReader } from '@prism/contexts/commercial';
import type {
  PrismPmcmSupplierEngagement,
  PrismPmcmSupplierPage,
  PmcmSupplierHistoryQuery,
} from '@prism/types';
import { PmcmSupplierEventHeadersQueries } from '../queries/pmcm-supplier-event-headers.queries';

const reviewableEventStatuses = new Set(['completed', 'closed', 'archived']);

@Injectable()
export class PmcmSupplierEngagementsService {
  constructor(
    @Inject(SUPPLIER_WORKSPACE_READER) private readonly supplierReader: SupplierWorkspaceReader,
    private readonly queries: PmcmSupplierEventHeadersQueries,
    private readonly policy: EventAccessPolicyService,
  ) {}

  async listEngagements(
    supplierId: string,
    query: PmcmSupplierHistoryQuery,
    actor: ResolvedEventOpsActor,
  ): Promise<PrismPmcmSupplierPage<PrismPmcmSupplierEngagement>> {
    await this.policy.requireActorRole(actor, [OpsUserRole.PmcmAdmin, OpsUserRole.System], 'PMCM supplier engagements');
    const factsPage = await this.supplierReader.listEngagementFacts(supplierId, query);
    const eventIds = [...new Set(factsPage.items.map((item) => item.eventId))];
    const headers = await this.queries.forEvents(eventIds);
    const headerById = new Map(headers.map((event) => [event.id, event]));
    const items = factsPage.items.flatMap((facts) => {
      const event = headerById.get(facts.eventId);
      if (!event) return [];
      const canReview = facts.hasConfirmedAssignment &&
        event.actualEndedAt !== null && reviewableEventStatuses.has(event.status);
      return [{
        ...facts,
        event: {
          id: event.id,
          name: event.eventName,
          date: event.eventDate.toISOString().slice(0, 10),
          status: event.status,
        },
        canReview,
        canPromote: canReview && factsPage.supplierTier === 'pending_first_event' && facts.hasAssessment,
      }];
    });

    return {
      items,
      totalCount: factsPage.totalCount,
      page: factsPage.page,
      pageSize: factsPage.pageSize,
      hasNextPage: factsPage.hasNextPage,
    };
  }
}
