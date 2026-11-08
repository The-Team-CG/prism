import { Body, Controller, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { EventAccessPolicyService } from '@prism/kernel/access-control';
import { OpsUserRole } from '@prism/kernel/event-core';
import { EventSessionGuard, VerifiedEventActor } from '@prism/kernel/event-session';
import { zodBody } from '@prism/kernel/shared';
import {
  completeExternalCreativeTicketSchema,
  createExternalCreativeTicketSchema,
  updateExternalCreativeTicketSchema,
  type CompleteExternalCreativeTicketInput,
  type CreateExternalCreativeTicketInput,
  type PrismVerifiedEventActor,
  type UpdateExternalCreativeTicketInput,
} from '@prism/types';
import { ExternalCreativeTicketService } from '../../application/suppliers/external-creative-ticket.service';

@Controller('events/:eventId/external-creative-tickets')
@UseGuards(EventSessionGuard)
export class ExternalCreativeTicketController {
  constructor(private readonly access: EventAccessPolicyService, private readonly tickets: ExternalCreativeTicketService) {}

  private async pmcm(eventId: string, verifiedActor: PrismVerifiedEventActor, action: string) {
    const actor = this.access.resolveActor({}, verifiedActor);
    await this.access.requireActorRole(actor, [OpsUserRole.PmcmAdmin], action, eventId);
    return actor;
  }

  @Get()
  async list(@Param('eventId') eventId: string, @VerifiedEventActor() verifiedActor: PrismVerifiedEventActor) {
    await this.pmcm(eventId, verifiedActor, 'outsourced creative tickets');
    return this.tickets.list(eventId);
  }

  @Post()
  async create(@Param('eventId') eventId: string, @Body(zodBody(createExternalCreativeTicketSchema)) input: CreateExternalCreativeTicketInput, @VerifiedEventActor() verifiedActor: PrismVerifiedEventActor) {
    return this.tickets.create(eventId, input, await this.pmcm(eventId, verifiedActor, 'open outsourced creative ticket'));
  }

  @Patch(':ticketId')
  async update(@Param('eventId') eventId: string, @Param('ticketId') ticketId: string, @Body(zodBody(updateExternalCreativeTicketSchema)) input: UpdateExternalCreativeTicketInput, @VerifiedEventActor() verifiedActor: PrismVerifiedEventActor) {
    return this.tickets.update(eventId, ticketId, input, await this.pmcm(eventId, verifiedActor, 'update outsourced creative ticket'));
  }

  @Post(':ticketId/complete')
  async complete(@Param('eventId') eventId: string, @Param('ticketId') ticketId: string, @Body(zodBody(completeExternalCreativeTicketSchema)) input: CompleteExternalCreativeTicketInput, @VerifiedEventActor() verifiedActor: PrismVerifiedEventActor) {
    return this.tickets.complete(eventId, ticketId, input, await this.pmcm(eventId, verifiedActor, 'complete outsourced creative ticket'));
  }
}
