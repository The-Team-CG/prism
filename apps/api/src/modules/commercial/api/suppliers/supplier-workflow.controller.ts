import { Body, Controller, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { EventAccessPolicyService } from '@prism/kernel/access-control';
import { EventSessionGuard, VerifiedEventActor } from '@prism/kernel/event-session';
import { zodBody } from '@prism/kernel/shared';
import type { PrismVerifiedEventActor } from '@prism/types';
import {
  acknowledgeSupplierScheduleSchema,
  bindSupplierContractSchema,
  createSupplierCreativeTaskSchema,
  createSupplierPayableMilestoneSchema,
  releaseSupplierPayoutSchema,
  requestSupplierScheduleChangeSchema,
  reviewSupplierContractSchema,
  reverseSupplierPayoutSchema,
  submitSupplierCreativeTaskSchema,
  updateSupplierCreativeProgressSchema,
  updateSupplierCreativeTaskSchema,
  type AcknowledgeSupplierScheduleInput,
  type BindSupplierContractInput,
  type CreateSupplierCreativeTaskInput,
  type CreateSupplierPayableMilestoneInput,
  type ReleaseSupplierPayoutInput,
  type RequestSupplierScheduleChangeInput,
  type ReviewSupplierContractInput,
  type ReverseSupplierPayoutInput,
  type SubmitSupplierCreativeTaskInput,
  type UpdateSupplierCreativeProgressInput,
  type UpdateSupplierCreativeTaskInput,
} from '@prism/types';
import { SupplierWorkflowService } from '../../application/suppliers/supplier-workflow.service';

@Controller()
export class OpsSupplierWorkflowController {
  constructor(
    private readonly workflows: SupplierWorkflowService,
    private readonly access: EventAccessPolicyService,
  ) {}

  @Get('supplier/workflows')
  @UseGuards(EventSessionGuard)
  supplierWorkspace(@VerifiedEventActor() verified: PrismVerifiedEventActor) {
    return this.workflows.supplierWorkspace(this.access.resolveActor({}, verified));
  }

  @Post('supplier/quote-requests/:requestId/contracts')
  @UseGuards(EventSessionGuard)
  bindContract(
    @Param('requestId') requestId: string,
    @Body(zodBody(bindSupplierContractSchema)) input: BindSupplierContractInput,
    @VerifiedEventActor() verified: PrismVerifiedEventActor,
  ) {
    return this.workflows.bindContract(requestId, input, this.access.resolveActor({}, verified));
  }

  @Post('supplier/quote-requests/:requestId/schedule/acknowledgement')
  @UseGuards(EventSessionGuard)
  acknowledgeSchedule(
    @Param('requestId') requestId: string,
    @Body(zodBody(acknowledgeSupplierScheduleSchema)) input: AcknowledgeSupplierScheduleInput,
    @VerifiedEventActor() verified: PrismVerifiedEventActor,
  ) {
    return this.workflows.acknowledgeSchedule(requestId, input, this.access.resolveActor({}, verified));
  }

  @Post('supplier/quote-requests/:requestId/schedule/change-request')
  @UseGuards(EventSessionGuard)
  requestScheduleChange(
    @Param('requestId') requestId: string,
    @Body(zodBody(requestSupplierScheduleChangeSchema)) input: RequestSupplierScheduleChangeInput,
    @VerifiedEventActor() verified: PrismVerifiedEventActor,
  ) {
    return this.workflows.requestScheduleChange(requestId, input, this.access.resolveActor({}, verified));
  }

  @Patch('supplier/creative-tasks/:taskId/progress')
  @UseGuards(EventSessionGuard)
  updateProgress(
    @Param('taskId') taskId: string,
    @Body(zodBody(updateSupplierCreativeProgressSchema)) input: UpdateSupplierCreativeProgressInput,
    @VerifiedEventActor() verified: PrismVerifiedEventActor,
  ) {
    return this.workflows.updateCreativeProgress(taskId, input, this.access.resolveActor({}, verified));
  }

  @Post('supplier/creative-tasks/:taskId/submissions')
  @UseGuards(EventSessionGuard)
  submitCreativeTask(
    @Param('taskId') taskId: string,
    @Body(zodBody(submitSupplierCreativeTaskSchema)) input: SubmitSupplierCreativeTaskInput,
    @VerifiedEventActor() verified: PrismVerifiedEventActor,
  ) {
    return this.workflows.submitCreativeTask(taskId, input, this.access.resolveActor({}, verified));
  }

  @Get('events/:eventId/supplier-workflows')
  @UseGuards(EventSessionGuard)
  pmcmWorkspace(@Param('eventId') eventId: string, @VerifiedEventActor() verified: PrismVerifiedEventActor) {
    return this.workflows.pmcmWorkspace(eventId, this.access.resolveActor({}, verified));
  }

  @Patch('supplier/contracts/:versionId/review')
  @UseGuards(EventSessionGuard)
  reviewContract(
    @Param('versionId') versionId: string,
    @Body(zodBody(reviewSupplierContractSchema)) input: ReviewSupplierContractInput,
    @VerifiedEventActor() verified: PrismVerifiedEventActor,
  ) {
    return this.workflows.reviewContract(versionId, input, this.access.resolveActor({}, verified));
  }

  @Post('events/:eventId/supplier-creative-tasks')
  @UseGuards(EventSessionGuard)
  createCreativeTask(
    @Param('eventId') eventId: string,
    @Body(zodBody(createSupplierCreativeTaskSchema)) input: CreateSupplierCreativeTaskInput,
    @VerifiedEventActor() verified: PrismVerifiedEventActor,
  ) {
    return this.workflows.createCreativeTask(eventId, input, this.access.resolveActor({}, verified));
  }

  @Patch('supplier/creative-tasks/:taskId/review')
  @UseGuards(EventSessionGuard)
  reviewCreativeTask(
    @Param('taskId') taskId: string,
    @Body(zodBody(updateSupplierCreativeTaskSchema)) input: UpdateSupplierCreativeTaskInput,
    @VerifiedEventActor() verified: PrismVerifiedEventActor,
  ) {
    return this.workflows.reviewCreativeTask(taskId, input, this.access.resolveActor({}, verified));
  }

  @Post('events/:eventId/supplier-payable-milestones')
  @UseGuards(EventSessionGuard)
  createPayable(
    @Param('eventId') eventId: string,
    @Body(zodBody(createSupplierPayableMilestoneSchema)) input: CreateSupplierPayableMilestoneInput,
    @VerifiedEventActor() verified: PrismVerifiedEventActor,
  ) {
    return this.workflows.createPayable(eventId, input, this.access.resolveActor({}, verified));
  }

  @Post('supplier-payable-milestones/:milestoneId/releases')
  @UseGuards(EventSessionGuard)
  releasePayout(
    @Param('milestoneId') milestoneId: string,
    @Body(zodBody(releaseSupplierPayoutSchema)) input: ReleaseSupplierPayoutInput,
    @VerifiedEventActor() verified: PrismVerifiedEventActor,
  ) {
    return this.workflows.releasePayout(milestoneId, input, this.access.resolveActor({}, verified));
  }

  @Post('supplier-payout-records/:recordId/reversal')
  @UseGuards(EventSessionGuard)
  reversePayout(
    @Param('recordId') recordId: string,
    @Body(zodBody(reverseSupplierPayoutSchema)) input: ReverseSupplierPayoutInput,
    @VerifiedEventActor() verified: PrismVerifiedEventActor,
  ) {
    return this.workflows.reversePayout(recordId, input, this.access.resolveActor({}, verified));
  }
}
