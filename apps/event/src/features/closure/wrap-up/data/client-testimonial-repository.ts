import type { ClientTestimonialModerationInput } from "@prism/types";
import { eventApi } from "@/lib/prism-api";

export const clientTestimonialRepository = {
  get: (eventId: string) => eventApi.closure.clientCloseoutModeration(eventId),
  moderate: (eventId: string, input: ClientTestimonialModerationInput) => eventApi.closure.moderateClientCloseout(eventId, input),
};
