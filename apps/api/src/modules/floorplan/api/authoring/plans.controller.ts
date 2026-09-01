import { Body, Controller, Get, Param, Put, Res, UseGuards } from '@nestjs/common';
import { EventAccessPolicyService } from '@prism/kernel/access-control';
import { EventSessionGuard, VerifiedEventActor } from '@prism/kernel/event-session';
import type { PrismVerifiedEventActor } from '@prism/types';
import type { Response } from 'express';
import { UpdatePlanDto } from './update-plan.dto';
import { PlansService } from '../../application/authoring/plans.service';

@Controller('plans')
export class PlansController {
  constructor(
    private readonly plansService: PlansService,
    private readonly eventAccessPolicyService: EventAccessPolicyService,
  ) {}

  @Get(':planId')
  @UseGuards(EventSessionGuard)
  getOne(@Param('planId') planId: string, @VerifiedEventActor() verifiedActor: PrismVerifiedEventActor) {
    return this.plansService.getPlan(planId, this.eventAccessPolicyService.resolveActor({}, verifiedActor));
  }

  @Put(':planId')
  @UseGuards(EventSessionGuard)
  update(
    @Param('planId') planId: string,
    @Body() dto: UpdatePlanDto,
    @VerifiedEventActor() verifiedActor: PrismVerifiedEventActor,
  ) {
    return this.plansService.updatePlan(planId, dto, this.eventAccessPolicyService.resolveActor({}, verifiedActor));
  }

  @Get(':planId/export')
  @UseGuards(EventSessionGuard)
  async exportPlan(@Param('planId') planId: string, @VerifiedEventActor() verifiedActor: PrismVerifiedEventActor, @Res() res: Response) {
    const plan = await this.plansService.getPlan(planId, this.eventAccessPolicyService.resolveActor({}, verifiedActor));
    res.setHeader('Content-Disposition', `attachment; filename=plan-${plan.id}.json`);
    res.json(plan);
  }
}
