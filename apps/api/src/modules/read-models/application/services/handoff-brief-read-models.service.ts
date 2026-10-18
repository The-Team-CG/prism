import { Inject, Injectable } from '@nestjs/common';
import type { PrismCoordinatorLiveOps, PrismHandoffBrief, PrismHandoffBriefScope, PrismLiveOps } from '@prism/types';
import type { ResolvedEventOpsActor } from '@prism/kernel/access-control';
import { OpsUserRole } from '@prism/kernel/event-core';
import { FILE_REQUIREMENT_READER, type FileRequirementReader } from '@prism/contexts/event-lifecycle';
import { EventReadModelQueries } from '../queries/event-read-models.queries';
import {
  type HandoffSupplierInput,
  isOpenHandoffIssue,
  mapEventHandoff,
  projectHandoffAssignment,
  projectHandoffFiles,
  projectHandoffIssue,
  projectHandoffKeyDetails,
  projectHandoffSupplier,
} from '../mappers/handoff-brief.mappers';
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

    return {
      eventId,
      scope,
      generatedAt: new Date().toISOString(),
      keyDetails: projectHandoffKeyDetails(liveOps.event, liveOps.briefing ?? null, scope === 'pmcm'),
      schedule: liveOps.schedule ?? { eventId, authored: false, days: [], serverTime: new Date().toISOString() },
      supplierReadiness: this.supplierReadiness(liveOps, scope),
      staffing: liveOps.coordinatorAssignments.map(projectHandoffAssignment),
      openIssues: liveOps.urgentIssues.filter(isOpenHandoffIssue).map(projectHandoffIssue),
      files: projectHandoffFiles(matrix.items, actor.role),
      handoffs: handoffs.map(mapEventHandoff),
    };
  }

  /** Mirrors the live-ops rule: PMCM, designated operators, and ingress/egress roles see supplier readiness. */
  private supplierReadiness(liveOps: PrismLiveOps | PrismCoordinatorLiveOps, scope: PrismHandoffBriefScope): PrismHandoffBrief['supplierReadiness'] {
    const role = 'role' in liveOps ? liveOps.role : undefined;
    const visible = scope === 'pmcm' || Boolean(liveOps.isDesignatedOperator) || isIngressRole(role);
    const statuses: HandoffSupplierInput[] = liveOps.supplierStatuses;
    return {
      visible,
      items: visible ? statuses.map(projectHandoffSupplier) : [],
    };
  }
}

function isIngressRole(role?: string | null) {
  const value = role?.toLowerCase() ?? '';
  return value.includes('ingress') || value.includes('egress');
}
