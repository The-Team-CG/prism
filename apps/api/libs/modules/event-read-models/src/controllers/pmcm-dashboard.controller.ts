import { Controller, Get, Param, Query } from '@nestjs/common';
import { EventAccessPolicyService } from '@prism/modules/access-control';
import { BillingOperationsService } from '@prism/modules/finance-ops';
import { FloorPlanWorkflowService } from '@prism/modules/floorplan';
import { GuestWorkflowService } from '@prism/modules/guest-ops';
import { CoordinatorsService } from '@prism/modules/staffing-ops';
import { AuditService } from '@prism/modules/trust-ops';
import { SampleActorDto } from '../dto/read-model.dto';
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
  dashboard(@Query() actorInput: SampleActorDto) {
    const actor = this.eventAccessPolicyService.resolveActor(actorInput);
    return this.eventReadModelsService.pmcmDashboard(actor, this.mappers());
  }

  @Get('events/:eventId/workspace')
  eventWorkspace(@Param('eventId') eventId: string, @Query() actorInput: SampleActorDto) {
    const actor = this.eventAccessPolicyService.resolveActor(actorInput);
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
