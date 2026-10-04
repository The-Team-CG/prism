import type { Prisma } from '@prisma/client';

export const LIFECYCLE_PRIVACY_REDACTOR = Symbol('LIFECYCLE_PRIVACY_REDACTOR');

export type LifecycleClientRedaction = {
  inquiryIds: string[];
  eventIds: string[];
  surfaces: string[];
  touchedRecords: number;
};

export interface LifecyclePrivacyRedactor {
  redactClient(
    input: { email: string; redactedEmail: string; eventId?: string | null },
    transaction: Prisma.TransactionClient,
  ): Promise<LifecycleClientRedaction>;
}
