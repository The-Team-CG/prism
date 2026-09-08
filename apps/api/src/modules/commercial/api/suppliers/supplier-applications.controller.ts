import { Body, Controller, Get, HttpCode, HttpStatus, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import {
  createSupplierApplicationSchema,
  reviewSupplierApplicationSchema,
  supplierApplicationStatusQuerySchema,
  type CreateSupplierApplicationInput,
  type PrismVerifiedEventActor,
  type ReviewSupplierApplicationInput,
  type SupplierApplicationStatusQuery,
} from '@prism/types';
import { zodBody, zodQuery } from '@prism/kernel/shared';
import { EventAccessPolicyService } from '@prism/kernel/access-control';
import { EventSessionGuard, VerifiedEventActor } from '@prism/kernel/event-session';
import { SupplierApplicationService } from '../../application/suppliers/supplier-application.service';

@Controller('supplier-applications')
export class OpsSupplierApplicationsController {
  constructor(
    private readonly supplierApplicationService: SupplierApplicationService,
    private readonly eventAccessPolicyService: EventAccessPolicyService,
  ) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  create(@Body(zodBody(createSupplierApplicationSchema)) input: CreateSupplierApplicationInput) {
    return this.supplierApplicationService.createSupplierApplication(input);
  }

  @Get('categories')
  listCategories() {
    return this.supplierApplicationService.listPublicCategories();
  }

  @Get('status')
  getStatus(@Query(zodQuery(supplierApplicationStatusQuerySchema)) input: SupplierApplicationStatusQuery) {
    return this.supplierApplicationService.getPublicStatus(input);
  }

  @Get('inbox')
  @UseGuards(EventSessionGuard)
  listInbox(@VerifiedEventActor() verifiedActor: PrismVerifiedEventActor) {
    const actor = this.eventAccessPolicyService.resolveActor({}, verifiedActor);
    return this.supplierApplicationService.listInbox(actor);
  }

  @Patch(':applicationId/review')
  @UseGuards(EventSessionGuard)
  review(
    @Param('applicationId') applicationId: string,
    @Body(zodBody(reviewSupplierApplicationSchema)) input: ReviewSupplierApplicationInput,
    @VerifiedEventActor() verifiedActor: PrismVerifiedEventActor,
  ) {
    const actor = this.eventAccessPolicyService.resolveActor({}, verifiedActor);
    return this.supplierApplicationService.reviewApplication(applicationId, input, actor);
  }
}
