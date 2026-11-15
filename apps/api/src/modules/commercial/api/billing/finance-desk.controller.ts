import { Controller, Get, UseGuards } from '@nestjs/common';
import { EventSessionGuard, VerifiedEventActor } from '@prism/kernel/event-session';
import type { PrismVerifiedEventActor } from '@prism/types';
import { FinanceDeskService } from '../../application/billing/finance-desk.service';

/** PMCM finance across every active event. The service refuses everyone but PMCM and the system. */
@Controller('finance')
@UseGuards(EventSessionGuard)
export class FinanceDeskController {
  constructor(private readonly desk: FinanceDeskService) {}

  @Get('desk')
  financeDesk(@VerifiedEventActor() verifiedActor: PrismVerifiedEventActor) {
    return this.desk.desk(verifiedActor);
  }
}
