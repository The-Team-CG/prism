import { choosePresentationSlotSchema, parseContract } from "@prism/types";
import { clientApi } from "@/lib/prism-api";

export const presentationMeetingsRepository = {
  list: (eventId: string) => clientApi.commercial.presentationMeetings(eventId),
  choose: (eventId: string, meetingId: string, startsAt: string) =>
    clientApi.commercial.choosePresentationSlot(eventId, meetingId, parseContract(choosePresentationSlotSchema, { startsAt }, "Presentation time")),
};
