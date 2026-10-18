import type { Prisma } from '@prisma/client';
import type { PrismPrivacyExportSection, PrivacyCorrectionPatch } from '@prism/types';

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
  exportClient(
    input: { email: string; eventId?: string | null },
    transaction: Prisma.TransactionClient,
  ): Promise<{ eventIds: string[]; sections: PrismPrivacyExportSection[] }>;
  correctClient(
    input: { email: string; eventId?: string | null; patch: PrivacyCorrectionPatch },
    transaction: Prisma.TransactionClient,
  ): Promise<{ eventIds: string[]; surfaces: string[]; touchedRecords: number }>;
}
