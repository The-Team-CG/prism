import type { CreateClientFloorPlanAnnotationInput, DecideClientFloorPlanInput, PrismClientFloorPlanReview } from "@prism/types";
import { clientApiRequest } from "@/lib/prism-api";

export const clientFloorplanReviewRepository = {
  get: (eventId: string, draftId: string) => clientApiRequest<PrismClientFloorPlanReview>(`/events/${eventId}/floorplans/${draftId}/client-review`),
  decide: (eventId: string, draftId: string, input: DecideClientFloorPlanInput) => clientApiRequest(`/events/${eventId}/floorplans/${draftId}/client-review`, { method: "POST", body: input }),
  annotate: (eventId: string, draftId: string, input: CreateClientFloorPlanAnnotationInput) => clientApiRequest(`/events/${eventId}/floorplans/${draftId}/client-annotations`, { method: "POST", body: input }),
};
