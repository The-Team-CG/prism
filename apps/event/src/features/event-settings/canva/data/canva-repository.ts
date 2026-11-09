import type { PrismCanvaConnection, PrismCanvaDesign } from "@prism/types";
import { eventApiRequest } from "@/lib/prism-api";

/** FR-59 and New-P3: PMCM's Canva connection and the designs it fills. */
export const canvaRepository = {
  status: () => eventApiRequest<PrismCanvaConnection>("/api/integrations/canva"),
  authorize: () => eventApiRequest<{ url: string }>("/api/integrations/canva/authorize", { method: "POST" }),
  disconnect: () => eventApiRequest<PrismCanvaConnection>("/api/integrations/canva", { method: "DELETE" }),
  proposal: (eventId: string) => eventApiRequest<PrismCanvaDesign>(`/api/events/${encodeURIComponent(eventId)}/proposal/canva`, { method: "POST" }),
  testimonial: (eventId: string) => eventApiRequest<PrismCanvaDesign>(`/api/events/${encodeURIComponent(eventId)}/client-closeout/testimonial/canva`, { method: "POST" }),
};
