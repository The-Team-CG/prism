import type { Prisma } from '@prisma/client';

export const IDENTITY_PRIVACY_REDACTOR = Symbol('IDENTITY_PRIVACY_REDACTOR');

export interface IdentityPrivacyRedactor {
  hasAccount(email: string, transaction: Prisma.TransactionClient): Promise<boolean>;
  redactApprovalIdentity(
    input: { email: string; redactedEmail: string; role: string },
    transaction: Prisma.TransactionClient,
  ): Promise<{ count: number }>;
}
