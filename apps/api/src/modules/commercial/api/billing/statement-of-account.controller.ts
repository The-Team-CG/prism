import { Controller, Get, Param, StreamableFile, UseGuards } from '@nestjs/common';
import { EventSessionGuard, VerifiedEventActor } from '@prism/kernel/event-session';
import type { PrismVerifiedEventActor } from '@prism/types';
import { BillingDocumentsService } from '../../application/billing/billing-documents.service';
import { StatementOfAccountService } from '../../application/billing/statement-of-account.service';

const pdfFile = ({ fileName, pdf }: { fileName: string; pdf: Buffer }) => new StreamableFile(pdf, { type: 'application/pdf', disposition: `attachment; filename="${fileName}"` });

/** What a client sees of an event's money. The service scopes the client to their own event and to a sent statement. */
@Controller('events')
@UseGuards(EventSessionGuard)
export class StatementOfAccountController {
  constructor(
    private readonly statements: StatementOfAccountService,
    private readonly documents: BillingDocumentsService,
  ) {}

  @Get(':eventId/statement-of-account')
  statementOfAccount(@Param('eventId') eventId: string, @VerifiedEventActor() verifiedActor: PrismVerifiedEventActor) {
    return this.statements.statementFor(eventId, verifiedActor);
  }

  /** The statement of account as a printable PDF, under the same rules as the statement itself. */
  @Get(':eventId/statement-of-account/pdf')
  async statementOfAccountPdf(@Param('eventId') eventId: string, @VerifiedEventActor() verifiedActor: PrismVerifiedEventActor) {
    return pdfFile(await this.documents.statementOfAccountPdf(eventId, verifiedActor));
  }

  /** A payment QR the statement tells the client to scan, under the same rules as the statement itself. */
  @Get(':eventId/statement-of-account/payment-qr/:imageId')
  async paymentQr(@Param('eventId') eventId: string, @Param('imageId') imageId: string, @VerifiedEventActor() verifiedActor: PrismVerifiedEventActor) {
    const image = await this.statements.paymentQr(eventId, imageId, verifiedActor);
    return new StreamableFile(image.bytes, { type: image.contentType });
  }

  /** A receipt for one payment on the statement. */
  @Get(':eventId/payment-records/:recordId/receipt')
  async paymentReceiptPdf(@Param('eventId') eventId: string, @Param('recordId') recordId: string, @VerifiedEventActor() verifiedActor: PrismVerifiedEventActor) {
    return pdfFile(await this.documents.paymentReceiptPdf(eventId, recordId, verifiedActor));
  }
}
