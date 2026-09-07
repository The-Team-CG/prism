import { Body, Controller, Param, Patch, UseGuards } from '@nestjs/common';
import { EventAccessPolicyService } from '@prism/kernel/access-control';
import { EventSessionGuard, VerifiedEventActor } from '@prism/kernel/event-session';
import { zodBody } from '@prism/kernel/shared';
import { supplierWithdrawalSchema, type PrismVerifiedEventActor, type SupplierWithdrawalInput } from '@prism/types';
import { SupplierNetworkWorkflowService } from '../../application/suppliers/supplier-network-workflow.service';

@Controller('events')
export class OpsEventSupplierWithdrawalController {
  constructor(
    private readonly supplierNetworkWorkflowService: SupplierNetworkWorkflowService,
    private readonly eventAccessPolicyService: EventAccessPolicyService,
  ) {}

  @Patch(':eventId/quote-requests/:requestId/withdraw')
  @UseGuards(EventSessionGuard)
  withdrawSupplier(
    @Param('eventId') eventId: string,
    @Param('requestId') requestId: string,
    @Body(zodBody(supplierWithdrawalSchema)) dto: SupplierWithdrawalInput,
    @VerifiedEventActor() verifiedActor: PrismVerifiedEventActor,
  ) {
    const actor = this.eventAccessPolicyService.resolveActor({}, verifiedActor);
    return this.supplierNetworkWorkflowService.withdrawSupplier(
      requestId,
      dto.reason ?? 'Withdrawn by PMCM Admin',
      actor,
      eventId,
    );
  }
}
