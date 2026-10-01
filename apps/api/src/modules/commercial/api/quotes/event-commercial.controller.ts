import { Body, Controller, Get, HttpCode, HttpStatus, Param, Patch, Post, UseGuards, Optional } from '@nestjs/common';
import { EventAccessPolicyService } from '@prism/kernel/access-control';
import { OpsUserRole } from '@prism/kernel/event-core';
import { EventSessionGuard, VerifiedEventActor } from '@prism/kernel/event-session';
import { zodBody } from '@prism/kernel/shared';
import { addSupplierQuoteSchema, requestSupplierQuotesSchema, createSupplierScheduleSchema, type AddSupplierQuoteInput, type PrismVerifiedEventActor, type RequestSupplierQuotesInput, type CreateSupplierScheduleInput } from '@prism/types';
import { SupplierNetworkWorkflowService } from '../../application/suppliers/supplier-network-workflow.service';
import { mapSupplierQuote, mapSupplierQuoteRequest } from '../../application/quotes/supplier-quote.mappers';
import { CommercialWorkflowService } from '../../application/quotes/commercial-workflow.service';

@Controller('events')
export class OpsEventCommercialController {
  constructor(
    private readonly commercialWorkflowService: CommercialWorkflowService,
    private readonly eventAccessPolicyService: EventAccessPolicyService,
    @Optional() private readonly supplierNetworkWorkflowService?: SupplierNetworkWorkflowService,
  ) {}

  @Post(':eventId/supplier-quotes')
  @UseGuards(EventSessionGuard)
  @HttpCode(HttpStatus.CREATED)
  async addSupplierQuote(
    @Param('eventId') eventId: string,
    @Body(zodBody(addSupplierQuoteSchema)) dto: AddSupplierQuoteInput,
    @VerifiedEventActor() verifiedActor: PrismVerifiedEventActor,
  ) {
    const actor = await this.requireCommercialActor(verifiedActor, 'supplier quote details', eventId);
    return mapSupplierQuote(await this.commercialWorkflowService.addSupplierQuote(eventId, dto, actor));
  }

  @Post(':eventId/supplier-schedules')
  @UseGuards(EventSessionGuard)
  @HttpCode(HttpStatus.CREATED)
  async createSupplierSchedule(
    @Param('eventId') eventId: string,
    @Body(zodBody(createSupplierScheduleSchema)) dto: CreateSupplierScheduleInput,
    @VerifiedEventActor() verifiedActor: PrismVerifiedEventActor,
  ) {
    const actor = await this.requireCommercialActor(verifiedActor, 'supplier ingress schedule', eventId);
    return this.supplierNetworkWorkflowService!.createSupplierSchedule(eventId, dto, actor);
  }

  @Get(':eventId/supplier-schedules')
  @UseGuards(EventSessionGuard)
  async listSupplierSchedules(@Param('eventId') eventId: string, @VerifiedEventActor() verifiedActor: PrismVerifiedEventActor) {
    const actor = await this.requireCommercialActor(verifiedActor, 'supplier ingress schedule', eventId);
    return this.supplierNetworkWorkflowService!.listSupplierSchedules(eventId, actor);
  }

  @Get(':eventId/quote-rounds/:roundId/comparison')
  @UseGuards(EventSessionGuard)
  async compareQuoteRound(@Param('eventId') eventId: string, @Param('roundId') roundId: string, @VerifiedEventActor() verifiedActor: PrismVerifiedEventActor) {
    const actor = await this.requireCommercialActor(verifiedActor, 'supplier quote comparison', eventId);
    return this.commercialWorkflowService.getQuoteRoundComparison(eventId, roundId, actor.role);
  }

  @Post(':eventId/quote-requests')
  @UseGuards(EventSessionGuard)
  @HttpCode(HttpStatus.CREATED)
  async requestSupplierQuotes(
    @Param('eventId') eventId: string,
    @Body(zodBody(requestSupplierQuotesSchema)) dto: RequestSupplierQuotesInput,
    @VerifiedEventActor() verifiedActor: PrismVerifiedEventActor,
  ) {
    const actor = await this.requireCommercialActor(verifiedActor, 'supplier quote requests', eventId);
    const requests = await this.commercialWorkflowService.requestSupplierQuotes(eventId, dto, actor);
    return requests.map((request) => mapSupplierQuoteRequest(request));
  }

  @Patch(':eventId/supplier-quotes/:quoteId/select')
  @UseGuards(EventSessionGuard)
  async selectSupplierQuote(
    @Param('eventId') eventId: string,
    @Param('quoteId') quoteId: string,
    @VerifiedEventActor() verifiedActor: PrismVerifiedEventActor,
  ) {
    const actor = await this.requireCommercialActor(verifiedActor, 'supplier quote selection', eventId);
    return mapSupplierQuote(await this.commercialWorkflowService.selectSupplierQuote(eventId, quoteId, actor));
  }

  private async requireCommercialActor(verifiedActor: PrismVerifiedEventActor, resource: string, eventId: string) {
    const actor = this.eventAccessPolicyService.resolveActor({}, verifiedActor);
    await this.eventAccessPolicyService.requireActorRole(
      actor,
      [OpsUserRole.PmcmAdmin, OpsUserRole.System],
      resource,
      eventId,
    );
    return actor;
  }
}
