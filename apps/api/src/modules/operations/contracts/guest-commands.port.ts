import type {
  CreateGuestCheckInInput,
  CreateGuestFeedbackInput,
  PrismGuestCheckInReceipt,
  PrismGuestFeedbackReceipt,
} from '@prism/types';

export interface GuestCommands {
  checkInByAccessCode(accessCode: string, input: CreateGuestCheckInInput): Promise<PrismGuestCheckInReceipt>;
  submitFeedbackByAccessCode(accessCode: string, input: CreateGuestFeedbackInput): Promise<PrismGuestFeedbackReceipt>;
}
