import type { OpsGuestCheckIn, OpsGuestFeedback } from '@prisma/client';
import type { GuestCheckInInput, GuestFeedbackInput } from '../application/guest/guest-workflow.service';

export interface GuestCommands {
  checkInByAccessCode(accessCode: string, input: GuestCheckInInput): Promise<OpsGuestCheckIn>;
  submitFeedbackByAccessCode(accessCode: string, input: GuestFeedbackInput): Promise<OpsGuestFeedback>;
}
