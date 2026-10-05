import type { PrismTransactionContext } from '@prism/kernel/shared-kernel';

export type FloorplanEventProjection = {
  floorPlanStatus?: string;
  floorPlanId?: string | null;
  floorPlanSubmittedAt?: Date | null;
  floorPlanReviewedAt?: Date | null;
  readiness?: string;
};

export type FloorplanProjectionInput = {
  eventId: string;
  version: number;
  state: FloorplanEventProjection;
};

export type FloorplanProjectionResult = {
  applied: boolean;
  version: number;
};

/** Lifecycle-owned, version-checked projection writer for Floorplan state. */
export interface FloorplanProjectionWriter {
  project(input: FloorplanProjectionInput, transaction: PrismTransactionContext): Promise<FloorplanProjectionResult>;
}

export const FLOORPLAN_PROJECTION_WRITER = Symbol('FLOORPLAN_PROJECTION_WRITER');
