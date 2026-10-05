import type {
  CreateGuestCheckInInput,
  CreateGuestFeedbackInput,
  PrismGuestCheckIn,
  PrismGuestFeedbackReceipt,
} from '@prism/types';

export interface GuestCommands {
  checkInByAccessCode(accessCode: string, input: CreateGuestCheckInInput): Promise<PrismGuestCheckIn>;
  submitFeedbackByAccessCode(accessCode: string, input: CreateGuestFeedbackInput): Promise<PrismGuestFeedbackReceipt>;
}
