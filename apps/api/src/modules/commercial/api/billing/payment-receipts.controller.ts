import { Controller, ForbiddenException, UseGuards } from '@nestjs/common';
import { EventAccessPolicyService } from '@prism/kernel/access-control';
import { OpsUserRole } from '@prism/kernel/event-core';
import { EventSessionGuard, VerifiedEventActor } from '@prism/kernel/event-session';
import { Endpoint, RouteBody, RouteParam, RouteQuery } from '@prism/kernel/shared';
import {
  paymentReceiptRoutes as routes,
  type AllocatePaymentReceiptInput,
  type AttachPaymentReceiptEvidenceInput,
  type EarmarkPaymentReceiptInput,
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
 * milestones afterwards, so every route here is PMCM finance only and takes no event scope. Paths, methods, statuses
 * and response shapes come from `paymentReceiptRoutes` in `@prism/types` (ADR-0011).
 */
@Controller()
@UseGuards(EventSessionGuard)
export class PaymentReceiptsController {
  constructor(
    private readonly receipts: PaymentReceiptService,
    private readonly eventAccessPolicyService: EventAccessPolicyService,
  ) {}

  @Endpoint(routes.list)
  async list(@RouteQuery(routes.list) query: ListPaymentReceiptsQuery, @VerifiedEventActor() verifiedActor: PrismVerifiedEventActor) {
    await this.requireFinanceActor(verifiedActor, 'payment receipts');
    return this.receipts.listReceipts(query);
  }

  // Declared before the ':receiptId' routes so the static path is not read as a receipt id.
  @Endpoint(routes.allocationTargets)
  async allocationTargets(
    @RouteQuery(routes.allocationTargets) query: ListPaymentAllocationTargetsQuery,
    @VerifiedEventActor() verifiedActor: PrismVerifiedEventActor,
  ) {
    await this.requireFinanceActor(verifiedActor, 'payment allocation targets');
    return this.receipts.listAllocationTargets(query.eventId);
  }

  @Endpoint(routes.record)
  async record(@RouteBody(routes.record) dto: RecordPaymentReceiptInput, @VerifiedEventActor() verifiedActor: PrismVerifiedEventActor) {
    return this.receipts.recordReceipt(dto, await this.requireFinanceActor(verifiedActor, 'payment receipt recording'));
  }

  @Endpoint(routes.allocate)
  async allocate(
    @RouteParam(routes.allocate, 'receiptId') receiptId: string,
    @RouteBody(routes.allocate) dto: AllocatePaymentReceiptInput,
    @VerifiedEventActor() verifiedActor: PrismVerifiedEventActor,
  ) {
    return this.receipts.allocate(receiptId, dto, await this.requireFinanceActor(verifiedActor, 'payment receipt allocation'));
  }

  @Endpoint(routes.reverseAllocation)
  async reverseAllocation(
    @RouteParam(routes.reverseAllocation, 'receiptId') receiptId: string,
    @RouteParam(routes.reverseAllocation, 'recordId') recordId: string,
    @RouteBody(routes.reverseAllocation) dto: ReversePaymentAllocationInput,
    @VerifiedEventActor() verifiedActor: PrismVerifiedEventActor,
  ) {
    return this.receipts.reverseAllocation(receiptId, recordId, dto, await this.requireFinanceActor(verifiedActor, 'payment allocation reversal'));
  }

  @Endpoint(routes.attachEvidence)
  async attachEvidence(
    @RouteParam(routes.attachEvidence, 'receiptId') receiptId: string,
    @RouteBody(routes.attachEvidence) dto: AttachPaymentReceiptEvidenceInput,
    @VerifiedEventActor() verifiedActor: PrismVerifiedEventActor,
  ) {
    return this.receipts.attachEvidence(receiptId, dto, await this.requireFinanceActor(verifiedActor, 'payment receipt evidence'));
  }

  @Endpoint(routes.earmark)
  async earmark(
    @RouteParam(routes.earmark, 'receiptId') receiptId: string,
    @RouteBody(routes.earmark) dto: EarmarkPaymentReceiptInput,
    @VerifiedEventActor() verifiedActor: PrismVerifiedEventActor,
  ) {
    return this.receipts.earmark(receiptId, dto, await this.requireFinanceActor(verifiedActor, 'payment receipt event assignment'));
  }

  @Endpoint(routes.verify)
  async verify(
    @RouteParam(routes.verify, 'receiptId') receiptId: string,
    @RouteBody(routes.verify) dto: VerifyPaymentReceiptInput,
    @VerifiedEventActor() verifiedActor: PrismVerifiedEventActor,
  ) {
    return this.receipts.verify(receiptId, dto, await this.requireFinanceActor(verifiedActor, 'payment receipt verification'));
  }

  @Endpoint(routes.reject)
  async reject(
    @RouteParam(routes.reject, 'receiptId') receiptId: string,
    @RouteBody(routes.reject) dto: RejectPaymentReceiptInput,
    @VerifiedEventActor() verifiedActor: PrismVerifiedEventActor,
  ) {
    return this.receipts.reject(receiptId, dto, await this.requireFinanceActor(verifiedActor, 'payment receipt rejection'));
  }

  @Endpoint(routes.reverse)
  async reverse(
    @RouteParam(routes.reverse, 'receiptId') receiptId: string,
    @RouteBody(routes.reverse) dto: ReversePaymentReceiptInput,
    @VerifiedEventActor() verifiedActor: PrismVerifiedEventActor,
  ) {
    return this.receipts.reverseReceipt(receiptId, dto, await this.requireFinanceActor(verifiedActor, 'payment receipt reversal'));
  }

  @Endpoint(routes.refund)
  async refund(
    @RouteParam(routes.refund, 'receiptId') receiptId: string,
    @RouteBody(routes.refund) dto: RecordPaymentRefundInput,
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
