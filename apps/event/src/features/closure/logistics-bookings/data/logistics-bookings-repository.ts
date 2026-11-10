import type { CreateLogisticsBookingInput } from "@prism/types";
import { eventApi } from "@/lib/prism-api";

export const logisticsBookingsRepository = {
  list: (eventId: string) => eventApi.closure.logisticsBookings(eventId),
  create: (eventId: string, input: CreateLogisticsBookingInput) => eventApi.closure.createLogisticsBooking(eventId, input),
};
