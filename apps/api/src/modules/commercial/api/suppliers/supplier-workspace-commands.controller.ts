import { Body, Controller, HttpCode, HttpStatus, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { EventAccessPolicyService } from '@prism/kernel/access-control';
import { EventSessionGuard, VerifiedEventActor } from '@prism/kernel/event-session';
import { zodBody } from '@prism/kernel/shared';
import {
  confirmSupplierReadinessSchema,
  uploadContractSchema,
  type ConfirmSupplierReadinessInput,
  type PrismVerifiedEventActor,
  type UploadContractInput,
} from '@prism/types';
import { SupplierNetworkWorkflowService } from '../../application/suppliers/supplier-network-workflow.service';

@Controller('supplier')
export class OpsSupplierWorkspaceCommandsController {
  constructor(
    private readonly supplierNetworkWorkflowService: SupplierNetworkWorkflowService,
    private readonly eventAccessPolicyService: EventAccessPolicyService,
  ) {}

  @Patch('quote-requests/:requestId/assignment/confirm')
  @UseGuards(EventSessionGuard)
  async confirmAssignment(
    @Param('requestId') requestId: string,
    @VerifiedEventActor() verifiedActor: PrismVerifiedEventActor,
  ) {
    const actor = this.eventAccessPolicyService.resolveActor({}, verifiedActor);
    return this.supplierNetworkWorkflowService.confirmSupplierAssignment(requestId, actor);
  }

  @Patch('quote-requests/:requestId/readiness/confirm')
  @UseGuards(EventSessionGuard)
  async confirmReadiness(
    @Param('requestId') requestId: string,
    @Body(zodBody(confirmSupplierReadinessSchema)) dto: ConfirmSupplierReadinessInput,
    @VerifiedEventActor() verifiedActor: PrismVerifiedEventActor,
  ) {
    const actor = this.eventAccessPolicyService.resolveActor({}, verifiedActor);
    return this.supplierNetworkWorkflowService.confirmSupplierReadiness(requestId, dto, actor);
  }

  @Post('quote-requests/:requestId/contract')
  @HttpCode(HttpStatus.CREATED)
  @UseGuards(EventSessionGuard)
  async uploadContract(
    @Param('requestId') requestId: string,
    @Body(zodBody(uploadContractSchema)) dto: UploadContractInput,
    @VerifiedEventActor() verifiedActor: PrismVerifiedEventActor,
  ) {
    const actor = this.eventAccessPolicyService.resolveActor({}, verifiedActor);
    return this.supplierNetworkWorkflowService.uploadSupplierContract(requestId, dto, actor, verifiedActor);
  }
}
