import { eventApi } from "@/lib/prism-api";

/** FR-59 and New-P3: PMCM's Canva connection and the designs it fills. */
export const canvaRepository = {
  status: () => eventApi.canva.status(),
  authorize: () => eventApi.canva.authorize(),
  disconnect: () => eventApi.canva.disconnect(),
  proposal: (eventId: string) => eventApi.canva.proposalDesign(eventId),
  testimonial: (eventId: string) => eventApi.canva.testimonialDesign(eventId),
};
