import { Controller, Get, Query } from '@nestjs/common';
import { EventAccessPolicyService } from '@prism/modules/access-control';
import { BillingOperationsService } from '@prism/modules/finance-ops';
import { AuditService } from '@prism/modules/trust-ops';
import { SampleActorDto } from '../dto/read-model.dto';
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
  getClientWorkspace(@Query() actorInput: SampleActorDto) {
    const actor = this.eventAccessPolicyService.resolveActor(actorInput);
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
  actionCenter(@Query() actorInput: SampleActorDto) {
    const actor = this.eventAccessPolicyService.resolveActor(actorInput);
    return this.eventReadModelsService.clientActionCenter(actor);
  }
}
