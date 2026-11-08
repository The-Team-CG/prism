import type { CreateLogisticsBookingInput, PrismLogisticsBooking } from "@prism/types";
import { eventApiRequest } from "@/lib/prism-api";

const base = (eventId: string) => `/api/events/${eventId}/logistics-bookings`;

export const logisticsBookingsRepository = {
  list: (eventId: string) => eventApiRequest<PrismLogisticsBooking[]>(base(eventId)),
  create: (eventId: string, input: CreateLogisticsBookingInput) => eventApiRequest<PrismLogisticsBooking>(base(eventId), { method: "POST", body: input }),
};
