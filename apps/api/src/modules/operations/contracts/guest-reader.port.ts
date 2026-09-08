import type { OpsEvent, OpsGuestCheckIn, OpsGuestFeedback } from '@prisma/client';
import type { PrismGuestCheckIn, PrismGuestFeedback } from '@prism/types';
import type { EventWithDrafts } from '../application/guest/guest-workflow.service';

export interface GuestReader {
  getEventByAccessCode(accessCode: string): Promise<EventWithDrafts>;
  countCheckInsForEvent(eventId: string): Promise<number>;
  listCheckInsForEvent(eventId: string): Promise<OpsGuestCheckIn[]>;
  listCheckInsForEvents(eventIds: string[]): Promise<OpsGuestCheckIn[]>;
  listFeedbackForEvent(eventId: string): Promise<OpsGuestFeedback[]>;
  listFeedbackForEvents(eventIds: string[]): Promise<OpsGuestFeedback[]>;
  countPendingFeedbackForEvent(eventId: string): Promise<number>;
  guestAccessCode(event: Pick<OpsEvent, 'id' | 'eventName'>): string;
  mapGuestEvent(event: EventWithDrafts, attendanceCount?: number): unknown;
  mapGuestCheckIn(checkIn: OpsGuestCheckIn): PrismGuestCheckIn;
  mapGuestFeedback(feedback: OpsGuestFeedback): PrismGuestFeedback;
}
