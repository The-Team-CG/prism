import { Body, Controller, HttpCode, HttpStatus, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { EventAccessPolicyService } from '@prism/modules/access-control';
import { EventSessionGuard, VerifiedEventActor } from '@prism/modules/event-session';
import type { PrismVerifiedEventActor } from '@prism/types';
import {
  CreateCoordinatorAssignmentDto,
  ReplaceCoordinatorAssignmentDto,
  WithdrawCoordinatorAssignmentDto,
} from './staffing-ops.dto';
import { CoordinatorsService } from '../../application/staffing/coordinators.service';

@Controller('events')
export class OpsEventCoordinatorAssignmentsController {
  constructor(
    private readonly coordinatorsService: CoordinatorsService,
    private readonly eventAccessPolicyService: EventAccessPolicyService,
  ) {}

  @Post(':eventId/coordinators')
  @UseGuards(EventSessionGuard)
  @HttpCode(HttpStatus.CREATED)
  assignCoordinator(
    @Param('eventId') eventId: string,
    @Body() dto: CreateCoordinatorAssignmentDto,
    @VerifiedEventActor() verifiedActor: PrismVerifiedEventActor,
  ) {
    const actor = this.eventAccessPolicyService.resolveActor({}, verifiedActor);
    return this.coordinatorsService.assignCoordinator(eventId, dto, actor);
  }

  @Patch(':eventId/coordinators/:assignmentId/acknowledge')
  @UseGuards(EventSessionGuard)
  acknowledgeCoordinator(
    @Param('eventId') eventId: string,
    @Param('assignmentId') assignmentId: string,
    @VerifiedEventActor() verifiedActor: PrismVerifiedEventActor,
  ) {
    const actor = this.eventAccessPolicyService.resolveActor({}, verifiedActor);
    return this.coordinatorsService.acknowledgeCoordinator(eventId, assignmentId, actor);
  }

  @Patch(':eventId/coordinators/:assignmentId/withdraw')
  @UseGuards(EventSessionGuard)
  withdrawCoordinator(
    @Param('eventId') eventId: string,
    @Param('assignmentId') assignmentId: string,
    @Body() dto: WithdrawCoordinatorAssignmentDto,
    @VerifiedEventActor() verifiedActor: PrismVerifiedEventActor,
  ) {
    const actor = this.eventAccessPolicyService.resolveActor({}, verifiedActor);
    return this.coordinatorsService.withdrawCoordinator(eventId, assignmentId, dto, actor);
  }

  @Patch(':eventId/coordinators/:assignmentId/replace')
  @UseGuards(EventSessionGuard)
  replaceCoordinator(
    @Param('eventId') eventId: string,
    @Param('assignmentId') assignmentId: string,
    @Body() dto: ReplaceCoordinatorAssignmentDto,
    @VerifiedEventActor() verifiedActor: PrismVerifiedEventActor,
  ) {
    const actor = this.eventAccessPolicyService.resolveActor({}, verifiedActor);
    return this.coordinatorsService.replaceCoordinator(eventId, assignmentId, dto, actor);
  }
}
