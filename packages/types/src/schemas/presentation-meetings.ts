import { z } from "zod";

/* FR-61 Presentation meeting scheduler. Zoom meetings are not created here; PMCM pastes its own meeting link. */
const slotSchema = z.object({ startsAt: z.string().datetime(), endsAt: z.string().datetime() }).strict()
  .refine((slot) => Date.parse(slot.endsAt) > Date.parse(slot.startsAt), "A slot must end after it starts");

export const proposePresentationMeetingSchema = z.object({
  title: z.string().trim().min(1).max(160),
  slots: z.array(slotSchema).min(2).max(4),
  meetingLink: z.string().trim().url().max(500).optional(),
}).strict();
export type ProposePresentationMeetingInput = z.infer<typeof proposePresentationMeetingSchema>;

export const choosePresentationSlotSchema = z.object({ startsAt: z.string().datetime() }).strict();
export type ChoosePresentationSlotInput = z.infer<typeof choosePresentationSlotSchema>;

export const recordPresentationOutcomeSchema = z.object({ outcome: z.enum(["attended", "no_show"]) }).strict();
export type RecordPresentationOutcomeInput = z.infer<typeof recordPresentationOutcomeSchema>;

export type PresentationMeetingStatus = "proposed" | "scheduled" | "attended" | "no_show" | "superseded";

export interface PrismPresentationMeeting {
  id: string;
  eventId: string;
  title: string;
  slots: Array<{ startsAt: string; endsAt: string }>;
  chosen: { startsAt: string; endsAt: string } | null;
  meetingLink: string | null;
  status: PresentationMeetingStatus;
  createdAt: string;
}

export interface PrismPresentationMeetings {
  meetings: PrismPresentationMeeting[];
  /** Two no-shows in a row. */
  atRisk: boolean;
}

/** An iCalendar file for one scheduled meeting, so each party can add it to their own calendar. */
export function presentationMeetingIcs(meeting: PrismPresentationMeeting): string | null {
  if (!meeting.chosen) return null;
  const stamp = (iso: string) => iso.replace(/[-:]/g, "").replace(/\.\d{3}/, "");
  const escape = (value: string) => value.replace(/[\\;,]/g, (match) => `\\${match}`).replace(/\n/g, "\\n");
  return [
    "BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//PMCM//P.R.I.S.M//EN", "BEGIN:VEVENT",
    `UID:${meeting.id}@prism`, `DTSTAMP:${stamp(meeting.createdAt)}`, `DTSTART:${stamp(meeting.chosen.startsAt)}`, `DTEND:${stamp(meeting.chosen.endsAt)}`,
    `SUMMARY:${escape(meeting.title)}`, ...(meeting.meetingLink ? [`URL:${meeting.meetingLink}`, `LOCATION:${escape(meeting.meetingLink)}`] : []),
    "END:VEVENT", "END:VCALENDAR",
  ].join("\r\n");
}
