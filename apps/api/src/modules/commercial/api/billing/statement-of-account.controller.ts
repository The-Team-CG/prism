import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { EventSessionGuard, VerifiedEventActor } from '@prism/kernel/event-session';
import type { PrismVerifiedEventActor } from '@prism/types';
import { StatementOfAccountService } from '../../application/billing/statement-of-account.service';

/** What a client sees of an event's money. The service scopes the client to their own event and to a sent statement. */
@Controller('events')
@UseGuards(EventSessionGuard)
export class StatementOfAccountController {
  constructor(private readonly statements: StatementOfAccountService) {}

  @Get(':eventId/statement-of-account')
  statementOfAccount(@Param('eventId') eventId: string, @VerifiedEventActor() verifiedActor: PrismVerifiedEventActor) {
    return this.statements.statementFor(eventId, verifiedActor);
  }
}
