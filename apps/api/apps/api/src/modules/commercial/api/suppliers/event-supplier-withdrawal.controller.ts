import { Body, Controller, Param, Patch, Query } from '@nestjs/common';
import { EventAccessPolicyService } from '@prism/kernel/access-control';
import { SupplierActorDto } from './supplier.dto';
import { SupplierNetworkWorkflowService } from '../../application/suppliers/supplier-network-workflow.service';

@Controller('events')
export class OpsEventSupplierWithdrawalController {
  constructor(
    private readonly supplierNetworkWorkflowService: SupplierNetworkWorkflowService,
    private readonly eventAccessPolicyService: EventAccessPolicyService,
  ) {}

  @Patch(':eventId/quote-requests/:requestId/withdraw')
  withdrawSupplier(
    @Param('eventId') _eventId: string,
    @Param('requestId') requestId: string,
    @Body() dto: { reason?: string } = {},
    @Query() actorInput: SupplierActorDto,
  ) {
    const actor = this.eventAccessPolicyService.resolveActor(actorInput);
    return this.supplierNetworkWorkflowService.withdrawSupplier(
      requestId,
      dto.reason ?? 'Withdrawn by PMCM Admin',
      actor,
    );
  }
}
