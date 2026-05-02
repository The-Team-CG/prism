import { Body, Controller, Get, Param, Put, Query, Res } from '@nestjs/common';
import type { Response } from 'express';
import { UpdatePlanDto } from './dto/update-plan.dto';
import { PlansService } from './plans.service';

@Controller('plans')
export class PlansController {
  constructor(private readonly plansService: PlansService) {}

  @Get(':planId')
  getOne(@Param('planId') planId: string, @Query() actor: Record<string, string>) {
    return this.plansService.getPlan(planId, actor);
  }

  @Put(':planId')
  update(@Param('planId') planId: string, @Body() dto: UpdatePlanDto, @Query() actor: Record<string, string>) {
    return this.plansService.updatePlan(planId, dto, actor);
  }

  @Get(':planId/export')
  async exportPlan(@Param('planId') planId: string, @Res() res: Response) {
    const plan = await this.plansService.getPlan(planId);
    res.setHeader('Content-Disposition', `attachment; filename=plan-${plan.id}.json`);
    res.json(plan);
  }
}
