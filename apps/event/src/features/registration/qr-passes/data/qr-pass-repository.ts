import type { GuestQrCheckInInput, PrismGuestCheckIn, PrismGuestQrPass } from "@prism/types";
import { eventApiRequest } from "@/lib/prism-api";

const base = (eventId: string) => `/api/guest/events/${eventId}`;

export const qrPassRepository = {
  list: (eventId: string) => eventApiRequest<PrismGuestQrPass[]>(`${base(eventId)}/qr-passes`),
  issue: (eventId: string) => eventApiRequest<PrismGuestQrPass[]>(`${base(eventId)}/qr-passes`, { method: "POST" }),
  checkIn: (eventId: string, input: GuestQrCheckInInput) =>
    eventApiRequest<PrismGuestCheckIn>(`${base(eventId)}/qr-check-in`, { method: "POST", body: input }),
};
