import { Controller, Get, HttpCode, HttpStatus, Param, Patch, Post, Query } from '@nestjs/common';
import { OpsUserRole } from '@prism/modules/event-core';
import { SupplierNetworkWorkflowService } from '../../application/suppliers/supplier-network-workflow.service';

@Controller('ai')
export class OpsSupplierPareController {
  constructor(private readonly supplierNetworkWorkflowService: SupplierNetworkWorkflowService) {}

  @Post('pare/trigger/:requestId')
  @HttpCode(HttpStatus.CREATED)
  pareManualTrigger(@Param('requestId') requestId: string) {
    return this.supplierNetworkWorkflowService.withdrawSupplier(requestId, 'Manual PARE trigger via API', {
      role: OpsUserRole.PmcmAdmin,
      name: 'PMCM Admin',
      explicit: true,
    });
  }

  @Get('pare/pending')
  pareGetPending(@Query('eventId') eventId?: string) {
    return this.supplierNetworkWorkflowService.pareGetPendingApprovals(eventId);
  }

  @Patch('pare/:approvalRecordId/approve')
  pareApprove(@Param('approvalRecordId') approvalRecordId: string, @Query('approvedBy') approvedBy = 'PMCM Admin') {
    return this.supplierNetworkWorkflowService.pareApprove(approvalRecordId, approvedBy);
  }

  @Patch('pare/:approvalRecordId/reject')
  pareReject(@Param('approvalRecordId') approvalRecordId: string, @Query('rejectedBy') rejectedBy = 'PMCM Admin') {
    return this.supplierNetworkWorkflowService.pareReject(approvalRecordId, rejectedBy);
  }
}

