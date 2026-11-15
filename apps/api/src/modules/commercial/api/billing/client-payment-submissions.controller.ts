import { Body, Controller, Param, Post, UseGuards } from '@nestjs/common';
import { EventSessionGuard, VerifiedEventActor } from '@prism/kernel/event-session';
import { zodBody } from '@prism/kernel/shared';
import {
  attachPaymentReceiptEvidenceSchema,
  submitClientPaymentSchema,
  type AttachPaymentReceiptEvidenceInput,
  type PrismVerifiedEventActor,
  type SubmitClientPaymentInput,
} from '@prism/types';
import { ClientPaymentSubmissionService } from '../../application/billing/client-payment-submission.service';

/** A client reporting a payment they made, and the proof for it. Only the event's client may use these routes. */
@Controller('events/:eventId/payment-submissions')
@UseGuards(EventSessionGuard)
export class ClientPaymentSubmissionsController {
  constructor(private readonly submissions: ClientPaymentSubmissionService) {}

  @Post()
  submit(
    @Param('eventId') eventId: string,
    @Body(zodBody(submitClientPaymentSchema)) input: SubmitClientPaymentInput,
    @VerifiedEventActor() verifiedActor: PrismVerifiedEventActor,
  ) {
    return this.submissions.submit(eventId, input, verifiedActor);
  }

  @Post(':receiptId/proof')
  attachProof(
    @Param('eventId') eventId: string,
    @Param('receiptId') receiptId: string,
    @Body(zodBody(attachPaymentReceiptEvidenceSchema)) input: AttachPaymentReceiptEvidenceInput,
    @VerifiedEventActor() verifiedActor: PrismVerifiedEventActor,
  ) {
    return this.submissions.attachProof(eventId, receiptId, input, verifiedActor);
  }
}
