import { Controller, Get, Header, Param, Query, UseGuards } from '@nestjs/common';
import { EventAccessPolicyService } from '@prism/kernel/access-control';
import { EventSessionGuard, VerifiedEventActor } from '@prism/kernel/event-session';
import { zodQuery } from '@prism/kernel/shared';
import {
  pmcmSupplierHistoryQuerySchema,
  type PmcmSupplierHistoryQuery,
  type PrismVerifiedEventActor,
} from '@prism/types';
import { PmcmSupplierEngagementsService } from '../application/services/pmcm-supplier-engagements.service';

@Controller('pmcm')
export class OpsPmcmSupplierEngagementsController {
  constructor(
    private readonly engagements: PmcmSupplierEngagementsService,
    private readonly eventAccessPolicyService: EventAccessPolicyService,
  ) {}

  @Get('suppliers/:supplierId/engagements')
  @Header('Cache-Control', 'private, no-store')
  @UseGuards(EventSessionGuard)
  listEngagements(
    @Param('supplierId') supplierId: string,
    @Query(zodQuery(pmcmSupplierHistoryQuerySchema)) query: PmcmSupplierHistoryQuery,
    @VerifiedEventActor() verifiedActor: PrismVerifiedEventActor,
  ) {
    const actor = this.eventAccessPolicyService.resolveActor({}, verifiedActor);
    return this.engagements.listEngagements(supplierId, query, actor);
  }
}
