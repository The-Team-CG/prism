import { parseContract, proposePresentationMeetingSchema, recordPresentationOutcomeSchema, type PrismPresentationMeeting, type PrismPresentationMeetings, type ProposePresentationMeetingInput, type RecordPresentationOutcomeInput } from "@prism/types";
import { eventApiRequest } from "@/lib/prism-api";

const base = (eventId: string) => `/api/events/${encodeURIComponent(eventId)}/presentation-meetings`;

export const presentationMeetingsRepository = {
  list: (eventId: string) => eventApiRequest<PrismPresentationMeetings>(base(eventId)),
  propose: (eventId: string, input: ProposePresentationMeetingInput) =>
    eventApiRequest<PrismPresentationMeeting>(base(eventId), { method: "POST", body: parseContract(proposePresentationMeetingSchema, input, "Presentation times") }),
  outcome: (eventId: string, meetingId: string, input: RecordPresentationOutcomeInput) =>
    eventApiRequest<PrismPresentationMeeting>(`${base(eventId)}/${encodeURIComponent(meetingId)}/outcome`, { method: "POST", body: parseContract(recordPresentationOutcomeSchema, input, "Attendance") }),
};
