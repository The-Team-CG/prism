import { Controller, Get, Inject, UseGuards } from '@nestjs/common';
import { EventAccessPolicyService } from '@prism/kernel/access-control';
import { FINANCE_COMMANDS, type FinanceCommands } from '@prism/contexts/commercial';
import { EventSessionGuard, VerifiedEventActor } from '@prism/kernel/event-session';
import type { PrismVerifiedEventActor } from '@prism/types';
import { mapAuditLog } from '@prism/contexts/platform-ops';
import { mapBillingEvent, mapReadModelFloorPlanDraft } from '../application/mappers/billing-read-model.mappers';
import { mapClientBriefing, mapClientDocument } from '../application/mappers/client-read-model.mappers';
import { createClientWorkspaceMappers } from '../application/mappers/event-read-model.mappers';
import { EventReadModelsService } from '../application/services/event-read-models.service';

@Controller('client')
export class OpsClientController {
  constructor(
    private readonly eventReadModelsService: EventReadModelsService,
    private readonly eventAccessPolicyService: EventAccessPolicyService,
    @Inject(FINANCE_COMMANDS) private readonly financeCommands: FinanceCommands,
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
        mapBillingStatement: this.financeCommands.mapBillingStatement.bind(this.financeCommands),
        mapPaymentMilestone: this.financeCommands.mapPaymentMilestone.bind(this.financeCommands),
        mapFloorPlanDraft: mapReadModelFloorPlanDraft,
        mapAuditLog,
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
