import type { OpsEvent, OpsGuestCheckIn, OpsGuestFeedback } from '@prisma/client';
import type { EventWithDrafts } from '../services/guest-workflow.service';

export interface GuestReader {
  getEventByAccessCode(accessCode: string): Promise<EventWithDrafts>;
  countCheckInsForEvent(eventId: string): Promise<number>;
  listCheckInsForEvent(eventId: string): Promise<OpsGuestCheckIn[]>;
  listCheckInsForEvents(eventIds: string[]): Promise<OpsGuestCheckIn[]>;
  listFeedbackForEvent(eventId: string): Promise<OpsGuestFeedback[]>;
  listFeedbackForEvents(eventIds: string[]): Promise<OpsGuestFeedback[]>;
  guestAccessCode(event: Pick<OpsEvent, 'id' | 'eventName'>): string;
  mapGuestEvent(event: EventWithDrafts, attendanceCount?: number): unknown;
  mapGuestCheckIn(checkIn: OpsGuestCheckIn): unknown;
  mapGuestFeedback(feedback: OpsGuestFeedback): unknown;
}
