import { Controller, Get, HttpCode, HttpStatus, Post, UseGuards } from '@nestjs/common';
import { OpsUserRole } from '@prism/modules/event-core';
import { EventSessionGuard, VerifiedEventActor } from '@prism/modules/event-session';
import type { PrismVerifiedEventActor } from '@prism/types';
import { EventAccessPolicyService } from '@prism/modules/access-control';
import { SampleCompatibilityService } from '../services/sample-compatibility.service';

@Controller('sample')
export class SampleController {
  constructor(
    private readonly sampleCompatibilityService: SampleCompatibilityService,
    private readonly eventAccessPolicyService: EventAccessPolicyService,
  ) {}

  /**
   * Compatibility aggregate for local demos and sample reset flows.
   * New role surfaces should use scoped controllers such as /client/workspace,
   * /pmcm/dashboard, /supplier/workspace, /events/:id, and /billing.
   */
  @Get('state')
  state() {
    return this.sampleCompatibilityService.state();
  }

  @Post('reset')
  @UseGuards(EventSessionGuard)
  @HttpCode(HttpStatus.OK)
  async reset(@VerifiedEventActor() verifiedActor: PrismVerifiedEventActor) {
    const actor = this.eventAccessPolicyService.resolveActor({}, verifiedActor);
    await this.eventAccessPolicyService.requireActorRole(
      actor,
      [OpsUserRole.PmcmAdmin, OpsUserRole.System],
      'sample reset',
    );
    return this.sampleCompatibilityService.resetSample();
  }
}
