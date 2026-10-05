import { Body, Controller, Get, HttpCode, HttpStatus, Param, Patch, Post } from '@nestjs/common';
import { zodBody } from '@prism/kernel/shared';
import { submitSupplierQuoteSchema, type SubmitSupplierQuoteInput } from '@prism/types';
import { mapQuoteRequestTokenDetail } from '../../application/quotes/supplier-quote.mappers';
import { CommercialWorkflowService } from '../../application/quotes/commercial-workflow.service';

@Controller('quote-requests')
export class OpsQuoteRequestsController {
  constructor(private readonly commercialWorkflowService: CommercialWorkflowService) {}

  @Get(':token')
  async getRequest(@Param('token') token: string) {
    return mapQuoteRequestTokenDetail(await this.commercialWorkflowService.getQuoteRequestByToken(token));
  }

  @Post(':token/quote')
  @HttpCode(HttpStatus.CREATED)
  async submitQuote(
    @Param('token') token: string,
    @Body(zodBody(submitSupplierQuoteSchema)) dto: SubmitSupplierQuoteInput,
  ) {
    return this.commercialWorkflowService.submitSupplierQuoteByToken(token, dto);
  }

  @Patch(':token/quote')
  async reviseQuote(
    @Param('token') token: string,
    @Body(zodBody(submitSupplierQuoteSchema)) dto: SubmitSupplierQuoteInput,
  ) {
    return this.commercialWorkflowService.reviseSupplierQuoteByToken(token, dto);
  }
}
