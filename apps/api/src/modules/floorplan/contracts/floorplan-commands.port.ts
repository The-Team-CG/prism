import type { OpsFloorPlanDraft } from '@prisma/client';
import type { CreateFloorPlanDraftInput, CreateFloorPlanPreferenceInput } from '@prism/types';

export type FloorPlanActor = {
  name: string;
  role: string;
};

export type FloorPlanCreator = FloorPlanActor & {
  actorId: string;
};

export interface FloorplanCommands {
  createFloorPlanDraft(eventId: string, input: CreateFloorPlanDraftInput, actor: FloorPlanCreator): Promise<unknown>;
  createFloorPlanPreference(eventId: string, input: CreateFloorPlanPreferenceInput, actor: FloorPlanCreator): Promise<unknown>;
  submitFloorPlanDraft(eventId: string, draftId: string, actor: FloorPlanActor): Promise<unknown>;
  approveFloorPlanDraft(eventId: string, draftId: string, actor: FloorPlanActor): Promise<unknown>;
  mapFloorPlanDraft(draft: OpsFloorPlanDraft): unknown;
}
