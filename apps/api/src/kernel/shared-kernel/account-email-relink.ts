import type { Prisma } from '@prisma/client';

/** An account's sign-in email that has just changed, for the contexts that keep their own copy of it. */
export type AccountEmailRelink = {
  userId: string;
  role: string;
  /** Canonical (trimmed, lower-case) emails. */
  previousEmail: string;
  newEmail: string;
};

/**
 * One context's part of an email change: it moves the records it uses to recognise this account (the client's
 * inquiries, the supplier record, where notifications go) to the new address, inside the change's transaction.
 * Records of what happened (signatures, audit entries, sign-in history) keep the address they were made with.
 */
export interface AccountEmailRelinker {
  relinkAccountEmail(input: AccountEmailRelink, transaction: Prisma.TransactionClient): Promise<{ surfaces: string[]; touchedRecords: number }>;
}
