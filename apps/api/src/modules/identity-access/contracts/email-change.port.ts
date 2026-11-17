import type { Prisma } from '@prisma/client';

export const EMAIL_CHANGE_DELIVERY = Symbol('EMAIL_CHANGE_DELIVERY');
export const ACCOUNT_EMAIL_CHANGE_CLAIM = Symbol('ACCOUNT_EMAIL_CHANGE_CLAIM');

/** How long the link sent to the new address works. */
export const EMAIL_CHANGE_TTL_MS = 24 * 60 * 60 * 1000;

/**
 * Sends the two emails of a change: the link to the new address (in memory only, never stored or logged), and a
 * notice to the current address so a change nobody asked for is noticed. Each rejects when the provider refuses it.
 */
export interface EmailChangeDeliveryPort {
  sendConfirmation(input: { recipient: string; name: string; confirmUrl: string }): Promise<void>;
  sendNotice(input: { recipient: string; name: string; newEmail: string }): Promise<void>;
}

/** What opening the link changed: the account and both addresses, for the contexts that keep their own copy. */
export type EmailChangeClaim =
  | { status: 'changed'; userId: string; role: string; previousEmail: string; newEmail: string }
  /** Another account signed up with the new address meanwhile; the request is cancelled and nothing changed. */
  | { status: 'taken' };

/**
 * Identity's part of opening the link, inside the caller's transaction: the account switches to the new address,
 * every session ends, and the request is used up. The caller relinks the other contexts in the same transaction.
 * Rejects with 400 for an unknown, expired, used or cancelled link.
 */
export interface AccountEmailChangeClaim {
  claim(token: string, transaction: Prisma.TransactionClient): Promise<EmailChangeClaim>;
}
