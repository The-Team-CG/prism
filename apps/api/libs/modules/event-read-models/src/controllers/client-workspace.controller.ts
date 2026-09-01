import { Controller, Get, UseGuards } from '@nestjs/common';
import { EventAccessPolicyService } from '@prism/modules/access-control';
import { BillingOperationsService } from '@prism/contexts/commercial';
import { EventSessionGuard, VerifiedEventActor } from '@prism/modules/event-session';
import type { PrismVerifiedEventActor } from '@prism/types';
import { AuditService } from '@prism/contexts/platform-ops';
import { mapBillingEvent, mapReadModelFloorPlanDraft } from '../mappers/billing-read-model.mappers';
import { mapClientBriefing, mapClientDocument } from '../mappers/client-read-model.mappers';
import { createClientWorkspaceMappers } from '../mappers/event-read-model.mappers';
import { EventReadModelsService } from '../services/event-read-models.service';

@Controller('client')
export class OpsClientController {
  constructor(
    private readonly eventReadModelsService: EventReadModelsService,
    private readonly eventAccessPolicyService: EventAccessPolicyService,
    private readonly billingOperationsService: BillingOperationsService,
    private readonly auditService: AuditService,
  ) {}

  @Get('workspace')
  @UseGuards(EventSessionGuard)
  getClientWorkspace(@VerifiedEventActor() verifiedActor: PrismVerifiedEventActor) {
    const actor = this.eventAccessPolicyService.resolveActor({}, verifiedActor);
    return this.eventReadModelsService.clientWorkspace(
      actor,
      createClientWorkspaceMappers({
        mapEvent: mapBillingEvent,
        mapDocument: mapClientDocument,
        mapBriefing: mapClientBriefing,
        mapBillingStatement: this.billingOperationsService.mapBillingStatement.bind(this.billingOperationsService),
        mapPaymentMilestone: this.billingOperationsService.mapPaymentMilestone.bind(this.billingOperationsService),
        mapFloorPlanDraft: mapReadModelFloorPlanDraft,
        mapAuditLog: this.auditService.mapAuditLog.bind(this.auditService),
      }),
    );
  }

  @Get('action-center')
  @UseGuards(EventSessionGuard)
  actionCenter(@VerifiedEventActor() verifiedActor: PrismVerifiedEventActor) {
    const actor = this.eventAccessPolicyService.resolveActor({}, verifiedActor);
    return this.eventReadModelsService.clientActionCenter(actor);
  }
}
