import { Body, Controller, HttpCode, HttpStatus, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { EventAccessPolicyService } from '@prism/kernel/access-control';
import { EventSessionGuard, VerifiedEventActor } from '@prism/kernel/event-session';
import { zodBody } from '@prism/kernel/shared';
import {
  coordinatorAssignmentAcknowledgementSchema,
  createCoordinatorAssignmentSchema,
  replaceCoordinatorAssignmentSchema,
  withdrawCoordinatorAssignmentSchema,
  type CoordinatorAssignmentAcknowledgementInput,
  type CreateCoordinatorAssignmentInput,
  type WithdrawCoordinatorAssignmentInput,
  type PrismVerifiedEventActor,
  type ReplaceCoordinatorAssignmentInput,
} from '@prism/types';
import { CoordinatorAssignmentCommandService } from '../../application/staffing/coordinator-assignment-command.service';

@Controller('events')
export class OpsEventCoordinatorAssignmentsController {
  constructor(
    private readonly assignmentCommands: CoordinatorAssignmentCommandService,
    private readonly eventAccessPolicyService: EventAccessPolicyService,
  ) {}

  @Post(':eventId/coordinators')
  @UseGuards(EventSessionGuard)
  @HttpCode(HttpStatus.CREATED)
  assignCoordinator(
    @Param('eventId') eventId: string,
    @Body(zodBody(createCoordinatorAssignmentSchema)) dto: CreateCoordinatorAssignmentInput,
    @VerifiedEventActor() verifiedActor: PrismVerifiedEventActor,
  ) {
    const actor = this.eventAccessPolicyService.resolveActor({}, verifiedActor);
    return this.assignmentCommands.assignCoordinator(eventId, dto, actor);
  }

  @Patch(':eventId/coordinators/:assignmentId/acknowledge')
  @UseGuards(EventSessionGuard)
  acknowledgeCoordinator(
    @Param('eventId') eventId: string,
    @Param('assignmentId') assignmentId: string,
    @VerifiedEventActor() verifiedActor: PrismVerifiedEventActor,
    @Body(zodBody(coordinatorAssignmentAcknowledgementSchema)) dto?: CoordinatorAssignmentAcknowledgementInput,
  ) {
    const actor = this.eventAccessPolicyService.resolveActor({}, verifiedActor);
    return dto
      ? this.assignmentCommands.acknowledgeCoordinator(eventId, assignmentId, actor, dto)
      : this.assignmentCommands.acknowledgeCoordinator(eventId, assignmentId, actor);
  }

  @Patch(':eventId/coordinators/:assignmentId/withdraw')
  @UseGuards(EventSessionGuard)
  withdrawCoordinator(
    @Param('eventId') eventId: string,
    @Param('assignmentId') assignmentId: string,
    @Body(zodBody(withdrawCoordinatorAssignmentSchema)) dto: WithdrawCoordinatorAssignmentInput,
    @VerifiedEventActor() verifiedActor: PrismVerifiedEventActor,
  ) {
    const actor = this.eventAccessPolicyService.resolveActor({}, verifiedActor);
    return this.assignmentCommands.withdrawCoordinator(eventId, assignmentId, dto, actor);
  }

  @Patch(':eventId/coordinators/:assignmentId/replace')
  @UseGuards(EventSessionGuard)
  replaceCoordinator(
    @Param('eventId') eventId: string,
    @Param('assignmentId') assignmentId: string,
    @Body(zodBody(replaceCoordinatorAssignmentSchema)) dto: ReplaceCoordinatorAssignmentInput,
    @VerifiedEventActor() verifiedActor: PrismVerifiedEventActor,
  ) {
    const actor = this.eventAccessPolicyService.resolveActor({}, verifiedActor);
    return this.assignmentCommands.replaceCoordinator(eventId, assignmentId, dto, actor);
  }
}
