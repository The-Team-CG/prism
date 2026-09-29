import type { PrismTransactionContext } from '@prism/kernel/shared-kernel';

export const CONFORME_REMINDER_WINDOW_CLAIMER = Symbol('CONFORME_REMINDER_WINDOW_CLAIMER');

export type ConformeReminderInquirySnapshot = {
  inquiryId: string;
  status: string;
  conformeSentAt: string | null;
  conformeSignedAt: string | null;
  lastConformeReminderAt: string | null;
  reminderWindowBaseAt: string | null;
};

export type EligibleConformeReminderInquiry = ConformeReminderInquirySnapshot & {
  status: 'accepted';
  conformeSentAt: string;
  conformeSignedAt: null;
  reminderWindowBaseAt: string;
};

export type ConformeReminderWindowClaimInput = {
  inquiryId: string;
  expectedConformeSentAt: string;
  expectedLastConformeReminderAt: string | null;
  now?: Date;
};

export type ConformeReminderWindowClaimResult = {
  windowKey: string;
  recipient: string;
  lastConformeReminderAt: string;
};

export interface ConformeReminderWindowClaimer {
  getInquiry(inquiryId: string): Promise<ConformeReminderInquirySnapshot | null>;
  requireEligible(inquiryId: string, now?: Date): Promise<EligibleConformeReminderInquiry>;
  claim(
    input: ConformeReminderWindowClaimInput,
    context: PrismTransactionContext,
  ): Promise<ConformeReminderWindowClaimResult>;
}
