import { Body, Controller, Param, Post, UseGuards } from '@nestjs/common';
import { EventAccessPolicyService } from '@prism/kernel/access-control';
import { EventSessionGuard, VerifiedEventActor } from '@prism/kernel/event-session';
import { zodBody } from '@prism/kernel/shared';
import { withdrawAddendumSchema, type PrismVerifiedEventActor, type WithdrawAddendumInput } from '@prism/types';
import { AddendumWithdrawalService } from '../../application/change/addendum-withdrawal.service';

@Controller('events')
export class AddendumWithdrawalController {
  constructor(private readonly service: AddendumWithdrawalService, private readonly access: EventAccessPolicyService) {}

  @Post(':eventId/addenda/:addendumId/withdraw')
  @UseGuards(EventSessionGuard)
  withdraw(
    @Param('eventId') eventId: string,
    @Param('addendumId') addendumId: string,
    @Body(zodBody(withdrawAddendumSchema)) input: WithdrawAddendumInput,
    @VerifiedEventActor() verified: PrismVerifiedEventActor,
  ) {
    return this.service.withdraw(eventId, addendumId, input, this.access.resolveActor({}, verified));
  }
}
