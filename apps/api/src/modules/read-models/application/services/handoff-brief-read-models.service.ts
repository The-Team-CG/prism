import { Inject, Injectable } from '@nestjs/common';
import type { PrismCoordinatorLiveOps, PrismHandoffBrief, PrismHandoffBriefScope, PrismLiveOps } from '@prism/types';
import type { ResolvedEventOpsActor } from '@prism/kernel/access-control';
import { OpsUserRole } from '@prism/kernel/event-core';
import { FILE_REQUIREMENT_READER, type FileRequirementReader } from '@prism/contexts/event-lifecycle';
import { EventReadModelQueries } from '../queries/event-read-models.queries';
import {
  isOpenHandoffIssue,
  mapEventHandoff,
  projectHandoffAssignment,
  projectHandoffFiles,
  projectHandoffIssue,
  projectHandoffKeyDetails,
  projectHandoffSupplier,
} from '../mappers/handoff-brief.mappers';
import { canSeeSupplierReadiness } from '../mappers/run-sheet.mappers';
import { buildSupplierReadinessItem, createSupplierReadinessClock, sortSupplierReadinessItems } from './event-read-models.supplier-readiness';
import { LiveOpsReadModelsService } from './live-ops-read-models.service';

/**
 * Read-only PMCM Handoff Brief (FL-021). Composes the live-ops read model (which already enforces
 * PMCM/coordinator event scope and unassigned-coordinator denial), the file requirement reader, and
 * the handoff log. Output is projected per field; coordinator scope never receives finance, private
 * supplier notes, audit categories, client identity, or guest access codes.
 */
@Injectable()
export class HandoffBriefReadModelsService {
  constructor(
    private readonly queries: EventReadModelQueries,
    private readonly liveOps: LiveOpsReadModelsService,
    @Inject(FILE_REQUIREMENT_READER) private readonly fileRequirements: FileRequirementReader,
  ) {}

  async getHandoffBrief(eventId: string, actor: ResolvedEventOpsActor): Promise<PrismHandoffBrief> {
    const scope: PrismHandoffBriefScope = actor.role === OpsUserRole.Coordinator ? 'coordinator' : 'pmcm';
    const [liveOps, matrix, handoffs] = await Promise.all([
      this.liveOps.getEventLiveOps(eventId, actor),
      this.fileRequirements.buildForEvent(eventId),
      this.queries.handoffsForEvent(eventId),
    ]);
    const supplierReadiness = await this.supplierReadiness(eventId, liveOps, scope);

    return {
      eventId,
      scope,
      generatedAt: new Date().toISOString(),
      keyDetails: projectHandoffKeyDetails(liveOps.event, liveOps.briefing ?? null, scope === 'pmcm'),
      schedule: liveOps.schedule ?? { eventId, authored: false, days: [], serverTime: new Date().toISOString() },
      supplierReadiness,
      staffing: liveOps.coordinatorAssignments.map(projectHandoffAssignment),
      openIssues: liveOps.urgentIssues.filter(isOpenHandoffIssue).map(projectHandoffIssue),
      files: projectHandoffFiles(matrix.items, actor.role),
      handoffs: handoffs.map(mapEventHandoff),
    };
  }

  /** Mirrors the live-ops rule: PMCM, designated operators, and ingress/egress roles see supplier readiness. */
  private async supplierReadiness(eventId: string, liveOps: PrismLiveOps | PrismCoordinatorLiveOps, scope: PrismHandoffBriefScope): Promise<PrismHandoffBrief['supplierReadiness']> {
    const visible = canSeeSupplierReadiness(liveOps, scope);
    const requests = visible ? await this.queries.supplierReadinessRequestsForEvent(eventId) : [];
    const clock = createSupplierReadinessClock();
    const items = sortSupplierReadinessItems(requests.map((request) => buildSupplierReadinessItem(request, liveOps.event, clock)));
    return {
      visible,
      items: items.map((item) => projectHandoffSupplier(item)),
    };
  }
}
