import type { Prisma } from '@prisma/client';
import type { PrismPrivacyExportSection, PrivacyCorrectionPatch } from '@prism/types';

export const OPERATIONS_PRIVACY_REDACTOR = Symbol('OPERATIONS_PRIVACY_REDACTOR');

export type OperationsRedactionResult = { surfaces: string[]; touchedRecords: number };

export interface OperationsPrivacyRedactor {
  redactGuest(
    input: { eventId: string; name: string },
    transaction: Prisma.TransactionClient,
  ): Promise<OperationsRedactionResult>;
  redactGuestRecord(
    input: { eventId: string; recordType: 'guest_check_in' | 'guest_feedback'; recordId: string },
    transaction: Prisma.TransactionClient,
  ): Promise<OperationsRedactionResult>;
  /** Applies an approved name/email correction to one guest's rows inside one event; email exists only on roster rows. */
  correctGuest(
    input: { eventId: string; name: string; patch: PrivacyCorrectionPatch },
    transaction: Prisma.TransactionClient,
  ): Promise<OperationsRedactionResult>;
  exportGuest(
    input: { eventId: string; name: string },
    transaction: Prisma.TransactionClient,
  ): Promise<PrismPrivacyExportSection[]>;
}
