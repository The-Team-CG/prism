import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { EventAccessPolicyService } from '@prism/modules/access-control';
import { BillingOperationsService } from '@prism/modules/finance-ops';
import { FloorPlanWorkflowService } from '@prism/contexts/floorplan';
import { EventSessionGuard, VerifiedEventActor } from '@prism/modules/identity-ops';
import type { PrismVerifiedEventActor } from '@prism/types';
import { CoordinatorsService, GuestWorkflowService } from '@prism/contexts/operations';
import { AuditService } from '@prism/modules/trust-ops';
import { createPmcmReadModelMappers } from '../mappers/pmcm-read-model.mappers';
import { EventReadModelsService } from '../services/event-read-models.service';

@Controller('pmcm')
export class OpsPmcmDashboardController {
  constructor(
    private readonly eventReadModelsService: EventReadModelsService,
    private readonly eventAccessPolicyService: EventAccessPolicyService,
    private readonly auditService: AuditService,
    private readonly billingOperationsService: BillingOperationsService,
    private readonly coordinatorsService: CoordinatorsService,
    private readonly floorPlanWorkflowService: FloorPlanWorkflowService,
    private readonly guestWorkflowService: GuestWorkflowService,
  ) {}

  @Get('dashboard')
  @UseGuards(EventSessionGuard)
  dashboard(@VerifiedEventActor() verifiedActor: PrismVerifiedEventActor) {
    const actor = this.eventAccessPolicyService.resolveActor({}, verifiedActor);
    return this.eventReadModelsService.pmcmDashboard(actor, this.mappers());
  }

  @Get('events/:eventId/workspace')
  @UseGuards(EventSessionGuard)
  eventWorkspace(@Param('eventId') eventId: string, @VerifiedEventActor() verifiedActor: PrismVerifiedEventActor) {
    const actor = this.eventAccessPolicyService.resolveActor({}, verifiedActor);
    return this.eventReadModelsService.pmcmEventWorkspace(actor, eventId, this.mappers());
  }

  private mappers() {
    return createPmcmReadModelMappers({
      auditService: this.auditService,
      billingOperationsService: this.billingOperationsService,
      coordinatorsService: this.coordinatorsService,
      floorPlanWorkflowService: this.floorPlanWorkflowService,
      guestWorkflowService: this.guestWorkflowService,
    });
  }
}
