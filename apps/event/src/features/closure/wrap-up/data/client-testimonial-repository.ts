import type { ClientTestimonialModerationInput, PrismClientCloseoutResponse } from "@prism/types";
import { eventApiRequest } from "@/lib/prism-api";

export const clientTestimonialRepository = {
  get: (eventId: string) => eventApiRequest<(PrismClientCloseoutResponse & { actorEmail?: string | null }) | null>(`/api/events/${eventId}/client-closeout/moderation`),
  moderate: (eventId: string, input: ClientTestimonialModerationInput) => eventApiRequest<PrismClientCloseoutResponse>(`/api/events/${eventId}/client-closeout/moderation`, { method: "PATCH", body: input }),
};
