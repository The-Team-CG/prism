import type { PrismFloorPlanDraft, PrismFloorPlanSnapshot } from '@prism/types';

/**
 * ORM-agnostic in-process input for the owning context's read-model mapper.
 * Date values are converted to ISO strings before they cross the public API.
 */
export interface FloorPlanDraftProjection {
  id: string;
  eventId: string;
  floorPlanId: string;
  name: string;
  status: string;
  isActive: boolean;
  sourceType: string;
  createdByRole: string;
  clientPreference: unknown;
  submittedSnapshot: unknown;
  approvedSnapshot: unknown;
  submittedAt: Date | null;
  reviewedAt: Date | null;
  approvedAt: Date | null;
  submittedSnapshotAt: Date | null;
  approvedSnapshotAt: Date | null;
  revisionComment: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface FloorplanReader {
  getFloorPlanSnapshot(eventId: string, draftId: string, type?: 'submitted' | 'approved'): Promise<PrismFloorPlanSnapshot>;
  mapFloorPlanDraft(draft: FloorPlanDraftProjection): PrismFloorPlanDraft;
}
