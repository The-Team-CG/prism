import type { GuestQrCheckInInput } from "@prism/types";
import { eventApi } from "@/lib/prism-api";

export const qrPassRepository = {
  list: (eventId: string) => eventApi.guest.qrPasses(eventId),
  issue: (eventId: string) => eventApi.guest.issueQrPasses(eventId),
  checkIn: (eventId: string, input: GuestQrCheckInInput) => eventApi.guest.qrCheckIn(eventId, input),
};
