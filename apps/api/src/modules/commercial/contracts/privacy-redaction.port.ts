import type { Prisma } from '@prisma/client';
import type { PrismPrivacyExportSection } from '@prism/types';

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
  exportClientBilling(
    input: { eventIds: string[] },
    transaction: Prisma.TransactionClient,
  ): Promise<PrismPrivacyExportSection[]>;
  exportSupplier(input: { email: string }, transaction: Prisma.TransactionClient): Promise<PrismPrivacyExportSection[]>;
}
