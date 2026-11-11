import { Body, Controller, ForbiddenException, Get, HttpCode, HttpStatus, Param, Post, Query, UseGuards } from '@nestjs/common';
import { EventAccessPolicyService } from '@prism/kernel/access-control';
import { OpsUserRole } from '@prism/kernel/event-core';
import { EventSessionGuard, VerifiedEventActor } from '@prism/kernel/event-session';
import { zodBody, zodQuery } from '@prism/kernel/shared';
import {
  allocatePaymentReceiptSchema,
  listPaymentAllocationTargetsQuerySchema,
  listPaymentReceiptsQuerySchema,
  recordPaymentReceiptSchema,
  recordPaymentRefundSchema,
  rejectPaymentReceiptSchema,
  reversePaymentAllocationSchema,
  reversePaymentReceiptSchema,
  verifyPaymentReceiptSchema,
  type AllocatePaymentReceiptInput,
  type ListPaymentAllocationTargetsQuery,
  type ListPaymentReceiptsQuery,
  type PrismVerifiedEventActor,
  type RecordPaymentReceiptInput,
  type RecordPaymentRefundInput,
  type RejectPaymentReceiptInput,
  type ReversePaymentAllocationInput,
  type ReversePaymentReceiptInput,
  type VerifyPaymentReceiptInput,
} from '@prism/types';
import { PaymentReceiptService } from '../../application/billing/payment-receipt.service';

/**
 * Money that arrived outside P.R.I.S.M. A receipt is not tied to one event: it is recorded first and applied to
 * milestones afterwards, so every route here is PMCM finance only and takes no event scope.
 */
@Controller('payment-receipts')
@UseGuards(EventSessionGuard)
export class PaymentReceiptsController {
  constructor(
    private readonly receipts: PaymentReceiptService,
    private readonly eventAccessPolicyService: EventAccessPolicyService,
  ) {}

  @Get()
  async list(@Query(zodQuery(listPaymentReceiptsQuerySchema)) query: ListPaymentReceiptsQuery, @VerifiedEventActor() verifiedActor: PrismVerifiedEventActor) {
    await this.requireFinanceActor(verifiedActor, 'payment receipts');
    return this.receipts.listReceipts(query);
  }

  // Declared before ':receiptId' so the static path is not read as a receipt id.
  @Get('allocation-targets')
  async allocationTargets(
    @Query(zodQuery(listPaymentAllocationTargetsQuerySchema)) query: ListPaymentAllocationTargetsQuery,
    @VerifiedEventActor() verifiedActor: PrismVerifiedEventActor,
  ) {
    await this.requireFinanceActor(verifiedActor, 'payment allocation targets');
    return this.receipts.listAllocationTargets(query.eventId);
  }

  @Get(':receiptId')
  async get(@Param('receiptId') receiptId: string, @VerifiedEventActor() verifiedActor: PrismVerifiedEventActor) {
    await this.requireFinanceActor(verifiedActor, 'payment receipt');
    return this.receipts.getReceipt(receiptId);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async record(@Body(zodBody(recordPaymentReceiptSchema)) dto: RecordPaymentReceiptInput, @VerifiedEventActor() verifiedActor: PrismVerifiedEventActor) {
    return this.receipts.recordReceipt(dto, await this.requireFinanceActor(verifiedActor, 'payment receipt recording'));
  }

  @Post(':receiptId/allocations')
  @HttpCode(HttpStatus.CREATED)
  async allocate(
    @Param('receiptId') receiptId: string,
    @Body(zodBody(allocatePaymentReceiptSchema)) dto: AllocatePaymentReceiptInput,
    @VerifiedEventActor() verifiedActor: PrismVerifiedEventActor,
  ) {
    return this.receipts.allocate(receiptId, dto, await this.requireFinanceActor(verifiedActor, 'payment receipt allocation'));
  }

  @Post(':receiptId/allocations/:recordId/reverse')
  @HttpCode(HttpStatus.OK)
  async reverseAllocation(
    @Param('receiptId') receiptId: string,
    @Param('recordId') recordId: string,
    @Body(zodBody(reversePaymentAllocationSchema)) dto: ReversePaymentAllocationInput,
    @VerifiedEventActor() verifiedActor: PrismVerifiedEventActor,
  ) {
    return this.receipts.reverseAllocation(receiptId, recordId, dto, await this.requireFinanceActor(verifiedActor, 'payment allocation reversal'));
  }

  @Post(':receiptId/verify')
  @HttpCode(HttpStatus.OK)
  async verify(
    @Param('receiptId') receiptId: string,
    @Body(zodBody(verifyPaymentReceiptSchema)) dto: VerifyPaymentReceiptInput,
    @VerifiedEventActor() verifiedActor: PrismVerifiedEventActor,
  ) {
    return this.receipts.verify(receiptId, dto, await this.requireFinanceActor(verifiedActor, 'payment receipt verification'));
  }

  @Post(':receiptId/reject')
  @HttpCode(HttpStatus.OK)
  async reject(
    @Param('receiptId') receiptId: string,
    @Body(zodBody(rejectPaymentReceiptSchema)) dto: RejectPaymentReceiptInput,
    @VerifiedEventActor() verifiedActor: PrismVerifiedEventActor,
  ) {
    return this.receipts.reject(receiptId, dto, await this.requireFinanceActor(verifiedActor, 'payment receipt rejection'));
  }

  @Post(':receiptId/reverse')
  @HttpCode(HttpStatus.OK)
  async reverse(
    @Param('receiptId') receiptId: string,
    @Body(zodBody(reversePaymentReceiptSchema)) dto: ReversePaymentReceiptInput,
    @VerifiedEventActor() verifiedActor: PrismVerifiedEventActor,
  ) {
    return this.receipts.reverseReceipt(receiptId, dto, await this.requireFinanceActor(verifiedActor, 'payment receipt reversal'));
  }

  @Post(':receiptId/refunds')
  @HttpCode(HttpStatus.CREATED)
  async refund(
    @Param('receiptId') receiptId: string,
    @Body(zodBody(recordPaymentRefundSchema)) dto: RecordPaymentRefundInput,
    @VerifiedEventActor() verifiedActor: PrismVerifiedEventActor,
  ) {
    return this.receipts.recordRefund(receiptId, dto, await this.requireFinanceActor(verifiedActor, 'payment refund recording'));
  }

  private async requireFinanceActor(verifiedActor: PrismVerifiedEventActor, resource: string) {
    const actor = this.eventAccessPolicyService.resolveActor({}, verifiedActor);
    await this.eventAccessPolicyService.requireActorRole(actor, [OpsUserRole.PmcmAdmin, OpsUserRole.System], resource);
    if (!actor.id?.trim()) throw new ForbiddenException('Verified billing actor ID is required');
    return { id: actor.id, name: actor.name, role: actor.role, email: actor.email };
  }
}
