import type { OpsFloorPlanDraft } from '@prisma/client';
import type { CreateFloorPlanDraftInput, CreateFloorPlanPreferenceInput } from '@prism/types';
import type { FloorPlanActor } from '../application/live/floor-plan-workflow.service';

export interface FloorplanCommands {
  createFloorPlanDraft(eventId: string, input: CreateFloorPlanDraftInput, actor: FloorPlanActor): Promise<unknown>;
  createFloorPlanPreference(eventId: string, input: CreateFloorPlanPreferenceInput, actor: FloorPlanActor): Promise<unknown>;
  submitFloorPlanDraft(eventId: string, draftId: string, actor: FloorPlanActor): Promise<unknown>;
  approveFloorPlanDraft(eventId: string, draftId: string, actor: FloorPlanActor): Promise<unknown>;
  mapFloorPlanDraft(draft: OpsFloorPlanDraft): unknown;
}
