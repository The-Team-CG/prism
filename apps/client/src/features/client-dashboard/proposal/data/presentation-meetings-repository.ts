import { choosePresentationSlotSchema, parseContract, type PrismPresentationMeeting, type PrismPresentationMeetings } from "@prism/types";
import { clientApiRequest } from "@/lib/prism-api";

const base = (eventId: string) => `/events/${encodeURIComponent(eventId)}/presentation-meetings`;

export const presentationMeetingsRepository = {
  list: (eventId: string) => clientApiRequest<PrismPresentationMeetings>(base(eventId)),
  choose: (eventId: string, meetingId: string, startsAt: string) =>
    clientApiRequest<PrismPresentationMeeting>(`${base(eventId)}/${encodeURIComponent(meetingId)}/choice`, { method: "POST", body: parseContract(choosePresentationSlotSchema, { startsAt }, "Presentation time") }),
};
