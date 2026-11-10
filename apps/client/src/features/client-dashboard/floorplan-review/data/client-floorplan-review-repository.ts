import type { CreateClientFloorPlanAnnotationInput, DecideClientFloorPlanInput } from "@prism/types";
import { clientApi } from "@/lib/prism-api";

export const clientFloorplanReviewRepository = {
  get: (eventId: string, draftId: string) => clientApi.clientPortal.floorplanReview(eventId, draftId),
  decide: (eventId: string, draftId: string, input: DecideClientFloorPlanInput) => clientApi.clientPortal.decideFloorplan(eventId, draftId, input),
  annotate: (eventId: string, draftId: string, input: CreateClientFloorPlanAnnotationInput) => clientApi.clientPortal.annotateFloorplan(eventId, draftId, input),
};
