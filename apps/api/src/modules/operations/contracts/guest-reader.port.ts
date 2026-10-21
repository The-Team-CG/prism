import type { PrismEvent, PrismGuestCheckIn, PrismGuestFeedback } from '@prism/types';

export interface GuestReader {
  countCheckInsForEvent(eventId: string): Promise<number>;
  listCheckInsForEvent(eventId: string): Promise<PrismGuestCheckIn[]>;
  listCheckInsForEvents(eventIds: string[]): Promise<PrismGuestCheckIn[]>;
  listFeedbackForEvent(eventId: string): Promise<PrismGuestFeedback[]>;
  listFeedbackForEvents(eventIds: string[]): Promise<PrismGuestFeedback[]>;
  countPendingFeedbackForEvent(eventId: string): Promise<number>;
  guestAccessCode(event: Pick<PrismEvent, 'id' | 'eventName'>): string;
}
