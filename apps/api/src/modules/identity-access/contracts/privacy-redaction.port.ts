import type { Prisma } from '@prisma/client';
import type { PrismPrivacyExportSection, PrivacyCorrectionPatch } from '@prism/types';

export const IDENTITY_PRIVACY_REDACTOR = Symbol('IDENTITY_PRIVACY_REDACTOR');

export interface IdentityPrivacyRedactor {
  findNativeAccount(email: string, transaction: Prisma.TransactionClient): Promise<{ id: string; role: string } | null>;
  redactApprovalIdentity(
    input: { email: string; redactedEmail: string; role: string },
    transaction: Prisma.TransactionClient,
  ): Promise<{ count: number }>;
  eraseAccount(
    input: { accountId: string; email: string; redactedEmail: string },
    transaction: Prisma.TransactionClient,
  ): Promise<{ count: number }>;
  exportAccount(email: string, transaction: Prisma.TransactionClient): Promise<PrismPrivacyExportSection[]>;
  correctApprovalIdentity(
    input: { email: string; role: string; patch: PrivacyCorrectionPatch },
    transaction: Prisma.TransactionClient,
  ): Promise<{ count: number }>;
  correctAccount(
    input: { accountId: string; email: string; patch: PrivacyCorrectionPatch },
    transaction: Prisma.TransactionClient,
  ): Promise<{ count: number }>;
}
