import type { Prisma } from '@prisma/client';

export const COMMERCIAL_PRIVACY_REDACTOR = Symbol('COMMERCIAL_PRIVACY_REDACTOR');

export type CommercialRedactionResult = { surfaces: string[]; touchedRecords: number };

export interface CommercialPrivacyRedactor {
  redactClientBilling(
    input: { eventIds: string[]; redactedEmail: string },
    transaction: Prisma.TransactionClient,
  ): Promise<CommercialRedactionResult>;
  redactSupplier(
    input: { email: string; redactedEmail: string },
    transaction: Prisma.TransactionClient,
  ): Promise<CommercialRedactionResult>;
}
