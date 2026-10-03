import type {
  CreateFloorPlanDraftInput,
  CreateFloorPlanPreferenceInput,
  PrismFloorPlanActor,
  PrismFloorPlanCreator,
  PrismFloorPlanDraft,
} from '@prism/types';

export type FloorPlanActor = PrismFloorPlanActor;
export type FloorPlanCreator = PrismFloorPlanCreator;

export interface FloorplanCommands {
  createFloorPlanDraft(eventId: string, input: CreateFloorPlanDraftInput, actor: FloorPlanCreator): Promise<PrismFloorPlanDraft>;
  createFloorPlanPreference(eventId: string, input: CreateFloorPlanPreferenceInput, actor: FloorPlanCreator): Promise<PrismFloorPlanDraft>;
  submitFloorPlanDraft(eventId: string, draftId: string, actor: FloorPlanActor): Promise<PrismFloorPlanDraft>;
  approveFloorPlanDraft(eventId: string, draftId: string, actor: FloorPlanActor): Promise<PrismFloorPlanDraft>;
}
