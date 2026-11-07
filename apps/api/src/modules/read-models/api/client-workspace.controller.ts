import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { EventAccessPolicyService } from '@prism/kernel/access-control';
import { mapBillingStatement, mapClientBillingDispute, mapPaymentMilestone } from '@prism/contexts/commercial';
import { EventSessionGuard, VerifiedEventActor } from '@prism/kernel/event-session';
import type { PrismVerifiedEventActor } from '@prism/types';
import { mapAuditLog } from '@prism/contexts/platform-ops';
import { mapBillingEvent } from '../application/mappers/billing-read-model.mappers';
import { mapNotificationLog } from '../application/mappers/pmcm-read-model.mappers';
import { mapBriefingSummary, mapDocument, mapOnboardingFloorPlanDraft } from '@prism/contexts/event-lifecycle';
import { createClientWorkspaceMappers } from '../application/mappers/event-read-model.mappers';
import { EventReadModelsService } from '../application/services/event-read-models.service';

@Controller('client')
export class OpsClientController {
  constructor(
    private readonly eventReadModelsService: EventReadModelsService,
    private readonly eventAccessPolicyService: EventAccessPolicyService,
  ) {}

  @Get('workspace')
  @UseGuards(EventSessionGuard)
  getClientWorkspace(@VerifiedEventActor() verifiedActor: PrismVerifiedEventActor, @Query('cursor') cursor?: string) {
    const actor = this.eventAccessPolicyService.resolveActor({}, verifiedActor);
    return this.eventReadModelsService.clientWorkspace(
      actor,
      createClientWorkspaceMappers({
        mapEvent: mapBillingEvent,
        mapDocument,
        mapBriefing: mapBriefingSummary,
        mapBillingStatement,
        mapClientBillingDispute,
        mapPaymentMilestone,
        mapFloorPlanDraft: mapOnboardingFloorPlanDraft,
        mapAuditLog,
        mapNotificationLog,
      }),
      cursor,
    );
  }

  @Get('shared-floorplans')
  @UseGuards(EventSessionGuard)
  sharedFloorplans(@VerifiedEventActor() verifiedActor: PrismVerifiedEventActor) {
    const actor = this.eventAccessPolicyService.resolveActor({}, verifiedActor);
    return this.eventReadModelsService.clientSharedFloorplans(actor);
  }

  @Get('action-center')
  @UseGuards(EventSessionGuard)
  actionCenter(@VerifiedEventActor() verifiedActor: PrismVerifiedEventActor) {
    const actor = this.eventAccessPolicyService.resolveActor({}, verifiedActor);
    return this.eventReadModelsService.clientActionCenter(actor);
  }
}
