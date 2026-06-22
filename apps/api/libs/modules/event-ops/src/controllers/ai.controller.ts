import { Controller, Get, HttpCode, HttpStatus, Param, Patch, Post, Query } from '@nestjs/common';
import { EventOpsService } from '../event-ops.service';

@Controller('ai')
export class OpsAiController {
  constructor(private readonly eventOpsService: EventOpsService) {}

  @Post('pare/trigger/:requestId')
  @HttpCode(HttpStatus.CREATED)
  pareManualTrigger(@Param('requestId') requestId: string) {
    return this.eventOpsService.withdrawSupplier(requestId, 'Manual PARE trigger via API', {
      actorRole: 'pmcm_admin',
      actorName: 'PMCM Admin',
    });
  }

  @Get('pare/pending')
  pareGetPending(@Query('eventId') eventId?: string) {
    return this.eventOpsService.pareGetPendingApprovals(eventId);
  }

  @Patch('pare/:approvalRecordId/approve')
  pareApprove(
    @Param('approvalRecordId') approvalRecordId: string,
    @Query('approvedBy') approvedBy = 'PMCM Admin',
  ) {
    return this.eventOpsService.pareApprove(approvalRecordId, approvedBy);
  }

  @Patch('pare/:approvalRecordId/reject')
  pareReject(
    @Param('approvalRecordId') approvalRecordId: string,
    @Query('rejectedBy') rejectedBy = 'PMCM Admin',
  ) {
    return this.eventOpsService.pareReject(approvalRecordId, rejectedBy);
  }
}
