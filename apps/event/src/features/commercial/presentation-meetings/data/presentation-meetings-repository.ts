import { parseContract, proposePresentationMeetingSchema, recordPresentationOutcomeSchema, type ProposePresentationMeetingInput, type RecordPresentationOutcomeInput } from "@prism/types";
import { eventApi } from "@/lib/prism-api";

export const presentationMeetingsRepository = {
  list: (eventId: string) => eventApi.commercial.presentationMeetings(eventId),
  propose: (eventId: string, input: ProposePresentationMeetingInput) =>
    eventApi.commercial.proposePresentationMeeting(eventId, parseContract(proposePresentationMeetingSchema, input, "Presentation times")),
  outcome: (eventId: string, meetingId: string, input: RecordPresentationOutcomeInput) =>
    eventApi.commercial.recordPresentationOutcome(eventId, meetingId, parseContract(recordPresentationOutcomeSchema, input, "Attendance")),
};
