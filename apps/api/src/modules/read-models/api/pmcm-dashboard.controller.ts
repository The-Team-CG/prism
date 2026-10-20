import { Controller, Get, Inject, Param, UseGuards } from '@nestjs/common';
import { EventAccessPolicyService } from '@prism/kernel/access-control';
import { FLOORPLAN_READER, type FloorplanReader } from '@prism/contexts/floorplan';
import { EventSessionGuard, VerifiedEventActor } from '@prism/kernel/event-session';
import type { PrismVerifiedEventActor } from '@prism/types';
import {
  GUEST_READER,
  REGISTRATION_PLATFORM_READER,
  type GuestReader,
  type RegistrationPlatformReader,
  STAFFING_READER,
  type StaffingReader,
} from '@prism/contexts/operations';
import { createPmcmReadModelMappers } from '../application/mappers/pmcm-read-model.mappers';
import { EventReadModelsService } from '../application/services/event-read-models.service';

@Controller('pmcm')
export class OpsPmcmDashboardController {
  constructor(
    private readonly eventReadModelsService: EventReadModelsService,
    private readonly eventAccessPolicyService: EventAccessPolicyService,
    @Inject(STAFFING_READER) private readonly staffingReader: StaffingReader,
    @Inject(FLOORPLAN_READER) private readonly floorplanReader: FloorplanReader,
    @Inject(GUEST_READER) private readonly guestReader: GuestReader,
    @Inject(REGISTRATION_PLATFORM_READER) private readonly registrationPlatformReader: RegistrationPlatformReader,
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

  /** FL-022: PMCM-only supplier readiness for one event; suppliers, clients, and coordinators are forbidden. */
  @Get('events/:eventId/supplier-readiness')
  @UseGuards(EventSessionGuard)
  supplierReadiness(@Param('eventId') eventId: string, @VerifiedEventActor() verifiedActor: PrismVerifiedEventActor) {
    const actor = this.eventAccessPolicyService.resolveActor({}, verifiedActor);
    return this.eventReadModelsService.pmcmSupplierReadinessBoard(actor, eventId);
  }

  @Get('coordinators/:coordinatorId/reliability-history')
  @UseGuards(EventSessionGuard)
  coordinatorReliabilityHistory(
    @Param('coordinatorId') coordinatorId: string,
    @VerifiedEventActor() verifiedActor: PrismVerifiedEventActor,
  ) {
    const actor = this.eventAccessPolicyService.resolveActor({}, verifiedActor);
    return this.eventReadModelsService.coordinatorReliabilityHistory(actor, coordinatorId);
  }

  private mappers() {
    return createPmcmReadModelMappers({
      staffingReader: this.staffingReader,
      floorplanReader: this.floorplanReader,
      guestReader: this.guestReader,
      registrationPlatformReader: this.registrationPlatformReader,
    });
  }
}
