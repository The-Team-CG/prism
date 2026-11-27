import { z } from "zod";

/* FR-61 Presentation meeting scheduler. PMCM pastes a meeting link, or asks for a Zoom meeting created when the client books. */
/** UAT 7.6: the video platforms PMCM meets clients on. */
export const PRESENTATION_MEETING_PLATFORMS = ["zoom", "google_meet", "teams"] as const;
export type PresentationMeetingPlatform = (typeof PRESENTATION_MEETING_PLATFORMS)[number];
export const PRESENTATION_MEETING_PLATFORM_LABELS: Record<PresentationMeetingPlatform, string> = {
  zoom: "Zoom",
  google_meet: "Google Meet",
  teams: "Microsoft Teams",
};
const PLATFORM_HOSTS: Record<PresentationMeetingPlatform, RegExp> = {
  zoom: /(^|\.)zoom\.us$/,
  google_meet: /^meet\.google\.com$/,
  teams: /(^|\.)teams\.(microsoft|live)\.com$/,
};

/** The platform a meeting link belongs to, from its host; null for any other link. */
export function meetingLinkPlatform(link: string | null | undefined): PresentationMeetingPlatform | null {
  if (!link) return null;
  try {
    const host = new URL(link).hostname.toLowerCase();
    return PRESENTATION_MEETING_PLATFORMS.find((platform) => PLATFORM_HOSTS[platform].test(host)) ?? null;
  } catch {
    return null;
  }
}

/** The platform of a proposed or booked meeting: a Zoom meeting P.R.I.S.M creates, or the pasted link's platform. */
export function presentationMeetingPlatform(meeting: Pick<PrismPresentationMeeting, "zoomMeeting" | "meetingLink">): PresentationMeetingPlatform | null {
  return meeting.zoomMeeting ? "zoom" : meetingLinkPlatform(meeting.meetingLink);
}

const slotSchema = z.object({ startsAt: z.string().datetime(), endsAt: z.string().datetime() }).strict()
  .refine((slot) => Date.parse(slot.endsAt) > Date.parse(slot.startsAt), "A slot must end after it starts");

export const proposePresentationMeetingSchema = z.object({
  title: z.string().trim().min(1).max(160),
  slots: z.array(slotSchema).min(2).max(4),
  meetingLink: z.string().trim().url().max(500).optional(),
  /** Create the Zoom meeting for the booked time; needs the deployment's Zoom account. */
  createZoomMeeting: z.boolean().optional(),
  /** UAT 7.6: the platform PMCM chose; a pasted link must belong to it. */
  platform: z.enum(PRESENTATION_MEETING_PLATFORMS).optional(),
}).strict()
  .refine((input) => !(input.createZoomMeeting && input.meetingLink), { message: "Paste a meeting link or create a Zoom meeting, not both", path: ["meetingLink"] })
  .refine((input) => !(input.createZoomMeeting && input.platform && input.platform !== "zoom"), { message: "Only Zoom meetings can be created automatically", path: ["platform"] })
  .refine((input) => !(input.platform && input.meetingLink && meetingLinkPlatform(input.meetingLink) !== input.platform), { message: "The meeting link does not match the chosen platform", path: ["meetingLink"] });
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
  /** The Zoom meeting is created when the client books; meetingLink is its join link once booked. */
  zoomMeeting: boolean;
  status: PresentationMeetingStatus;
  createdAt: string;
}

export interface PrismPresentationMeetings {
  meetings: PrismPresentationMeeting[];
  /** Two no-shows in a row. */
  atRisk: boolean;
  /** Whether this deployment is connected to Zoom, so PMCM can have the meeting created on booking. Sent to PMCM only. */
  zoomAvailable?: boolean;
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
