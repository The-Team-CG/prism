import type { Prisma } from '@prisma/client';

export const OPERATIONS_PRIVACY_REDACTOR = Symbol('OPERATIONS_PRIVACY_REDACTOR');

export type OperationsRedactionResult = { surfaces: string[]; touchedRecords: number };

export interface OperationsPrivacyRedactor {
  redactGuest(
    input: { eventId: string; name: string },
    transaction: Prisma.TransactionClient,
  ): Promise<OperationsRedactionResult>;
}
