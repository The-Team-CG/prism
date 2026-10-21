import { Controller, Get, HttpCode, HttpStatus, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { OpsUserRole } from '@prism/kernel/event-core';
import { EventAccessPolicyService } from '@prism/kernel/access-control';
import { EventSessionGuard, VerifiedEventActor } from '@prism/kernel/event-session';
import type { PrismVerifiedEventActor } from '@prism/types';
import { SupplierNetworkWorkflowService } from '../../application/suppliers/supplier-network-workflow.service';

@Controller('ai')
export class OpsSupplierPareController {
  constructor(
    private readonly supplierNetworkWorkflowService: SupplierNetworkWorkflowService,
    private readonly eventAccessPolicyService: EventAccessPolicyService,
  ) {}

  @Post('pare/trigger/:requestId')
  @UseGuards(EventSessionGuard)
  @HttpCode(HttpStatus.CREATED)
  pareManualTrigger(@Param('requestId') requestId: string, @VerifiedEventActor() verifiedActor: PrismVerifiedEventActor) {
    const actor = this.eventAccessPolicyService.resolveActor({}, verifiedActor);
    return this.eventAccessPolicyService.requireActorRole(actor, [OpsUserRole.PmcmAdmin], 'manual PARE trigger').then(() =>
      this.supplierNetworkWorkflowService.withdrawSupplier(requestId, 'Manual PARE trigger via API', { ...actor, explicit: true }));
  }

  @Get('pare/pending')
  @UseGuards(EventSessionGuard)
  pareGetPending(@Query('eventId') eventId: string | undefined, @VerifiedEventActor() verifiedActor: PrismVerifiedEventActor) {
    const actor = this.eventAccessPolicyService.resolveActor({}, verifiedActor);
    return this.eventAccessPolicyService.requireActorRole(actor, [OpsUserRole.PmcmAdmin], 'PARE approvals').then(() =>
      this.supplierNetworkWorkflowService.pareGetPendingApprovals(eventId));
  }

  @Patch('pare/:approvalRecordId/approve')
  @UseGuards(EventSessionGuard)
  pareApprove(@Param('approvalRecordId') approvalRecordId: string, @VerifiedEventActor() verifiedActor: PrismVerifiedEventActor) {
    const actor = this.eventAccessPolicyService.resolveActor({}, verifiedActor);
    return this.eventAccessPolicyService.requireActorRole(actor, [OpsUserRole.PmcmAdmin], 'PARE approval').then(() =>
      this.supplierNetworkWorkflowService.pareApprove(approvalRecordId, actor.name));
  }

  @Patch('pare/:approvalRecordId/reject')
  @UseGuards(EventSessionGuard)
  pareReject(@Param('approvalRecordId') approvalRecordId: string, @VerifiedEventActor() verifiedActor: PrismVerifiedEventActor) {
    const actor = this.eventAccessPolicyService.resolveActor({}, verifiedActor);
    return this.eventAccessPolicyService.requireActorRole(actor, [OpsUserRole.PmcmAdmin], 'PARE rejection').then(() =>
      this.supplierNetworkWorkflowService.pareReject(approvalRecordId, actor.name));
  }
}

