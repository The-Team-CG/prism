import { Body, Controller, HttpCode, HttpStatus, Param, Patch, Post, Query } from '@nestjs/common';
import { EventAccessPolicyService } from '@prism/modules/access-control';
import { OpsUserRole } from '@prism/modules/event-core';
import {
  AddSupplierQuoteDto,
  CommercialActorDto,
  RequestSupplierQuotesDto,
} from '../dto/supplier-quote.dto';
import { mapSupplierQuote, mapSupplierQuoteRequest } from '../mappers/supplier-quote.mappers';
import { CommercialWorkflowService } from '../services/commercial-workflow.service';

@Controller('events')
export class OpsEventCommercialController {
  constructor(
    private readonly commercialWorkflowService: CommercialWorkflowService,
    private readonly eventAccessPolicyService: EventAccessPolicyService,
  ) {}

  @Post(':eventId/supplier-quotes')
  @HttpCode(HttpStatus.CREATED)
  async addSupplierQuote(
    @Param('eventId') eventId: string,
    @Body() dto: AddSupplierQuoteDto,
    @Query() actorInput: CommercialActorDto,
  ) {
    await this.requireCommercialActor(actorInput, 'supplier quote details', eventId);
    return mapSupplierQuote(await this.commercialWorkflowService.addSupplierQuote(eventId, dto));
  }

  @Post(':eventId/quote-requests')
  @HttpCode(HttpStatus.CREATED)
  async requestSupplierQuotes(
    @Param('eventId') eventId: string,
    @Body() dto: RequestSupplierQuotesDto,
    @Query() actorInput: CommercialActorDto,
  ) {
    await this.requireCommercialActor(actorInput, 'supplier quote requests', eventId);
    const requests = await this.commercialWorkflowService.requestSupplierQuotes(eventId, dto);
    return requests.map((request) => mapSupplierQuoteRequest(request));
  }

  @Patch(':eventId/supplier-quotes/:quoteId/select')
  async selectSupplierQuote(
    @Param('eventId') eventId: string,
    @Param('quoteId') quoteId: string,
    @Query() actorInput: CommercialActorDto,
  ) {
    const actor = await this.requireCommercialActor(actorInput, 'supplier quote selection', eventId);
    return mapSupplierQuote(await this.commercialWorkflowService.selectSupplierQuote(eventId, quoteId, actor.name));
  }

  private async requireCommercialActor(actorInput: CommercialActorDto = {}, resource: string, eventId: string) {
    const actor = this.eventAccessPolicyService.resolveActor(actorInput);
    await this.eventAccessPolicyService.requireActorRole(
      actor,
      [OpsUserRole.PmcmAdmin, OpsUserRole.System],
      resource,
      eventId,
    );
    return actor;
  }
}
