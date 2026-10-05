import { Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import type { CommercialPrivacyRedactor, CommercialRedactionResult } from '../../contracts/privacy-redaction.port';

@Injectable()
export class CommercialPrivacyRedactorService implements CommercialPrivacyRedactor {
  async redactClientBilling(
    input: { eventIds: string[]; redactedEmail: string },
    transaction: Prisma.TransactionClient,
  ): Promise<CommercialRedactionResult> {
    const billing = await transaction.opsBillingStatement.updateMany({
      where: { eventId: { in: input.eventIds } },
      data: { clientName: 'Redacted data subject', clientContact: input.redactedEmail },
    });
    return {
      surfaces: billing.count ? ['billing_client_copy'] : [],
      touchedRecords: billing.count,
    };
  }

  async redactSupplier(
    input: { email: string; redactedEmail: string },
    transaction: Prisma.TransactionClient,
  ): Promise<CommercialRedactionResult> {
    const suppliers = await transaction.opsSupplier.updateMany({
      where: { email: { equals: input.email, mode: 'insensitive' } },
      data: {
        contactName: 'Redacted supplier contact',
        email: input.redactedEmail,
        phone: '',
        performanceNotes: '[redacted by privacy request]',
      },
    });
    const applications = await transaction.opsSupplierApplication.updateMany({
      where: { OR: [{ email: { equals: input.email, mode: 'insensitive' } }, { normalizedEmail: input.email }] },
      data: {
        contactName: 'Redacted supplier contact',
        email: input.redactedEmail,
        normalizedEmail: input.redactedEmail,
        phone: '',
        portfolioUrl: '',
        additionalNotes: '[redacted by privacy request]',
      },
    });
    return {
      surfaces: [
        ...(suppliers.count ? ['supplier'] : []),
        ...(applications.count ? ['supplier_application'] : []),
      ],
      touchedRecords: suppliers.count + applications.count,
    };
  }
}
