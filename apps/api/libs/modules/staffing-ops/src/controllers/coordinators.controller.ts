import { Controller, Get, UseGuards } from '@nestjs/common';
import { EventAccessPolicyService } from '@prism/modules/access-control';
import { EventSessionGuard, VerifiedEventActor } from '@prism/modules/identity-ops';
import type { PrismVerifiedEventActor } from '@prism/types';
import { OpsUserRole } from '@prism/modules/event-core';
import { CoordinatorsService } from '../services/coordinators.service';

@Controller('coordinators')
export class OpsCoordinatorsController {
  constructor(
    private readonly coordinatorsService: CoordinatorsService,
    private readonly eventAccessPolicyService: EventAccessPolicyService,
  ) {}

  @Get()
  @UseGuards(EventSessionGuard)
  async list(@VerifiedEventActor() verifiedActor: PrismVerifiedEventActor) {
    const actor = this.eventAccessPolicyService.resolveActor({}, verifiedActor);
    // FLAGGED SCOPING DECISION (PA-279 / EP-02-S05 AC8): coordinator directory is
    // PmcmAdmin-only, matching AC8's literal text. System and Coordinator were dropped
    // from the allow-list during the PA-279 fix: exhaustive search found zero real
    // callers of GET /api/coordinators anywhere in apps/event/src (CoordinatorView uses
    // the actor-scoped coordinatorWorkspace() endpoint; the pmcm-admin dashboard sources
    // its roster from pmcmState()). Widen this only alongside a real caller that needs it.
    await this.eventAccessPolicyService.requireActorRole(
      actor,
      [OpsUserRole.PmcmAdmin],
      'coordinator directory',
    );
    return this.coordinatorsService.listCoordinators();
  }
}
