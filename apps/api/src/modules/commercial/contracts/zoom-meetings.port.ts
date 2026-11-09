export const ZOOM_MEETINGS = Symbol('ZOOM_MEETINGS');

/** FR-61: the deployment's Zoom account (Server-to-Server OAuth). Null when Zoom is not configured. */
export interface ZoomMeetings {
  create(input: { topic: string; startsAt: Date; durationMinutes: number }): Promise<{ meetingId: string; joinUrl: string }>;
  remove(meetingId: string): Promise<void>;
}
