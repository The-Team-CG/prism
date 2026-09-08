import type { OpsCoordinator, OpsCoordinatorAssignment } from '@prisma/client';
import type { PrismCoordinator, PrismCoordinatorAssignment, PrismCoordinatorAvailability, PrismCoordinatorCoverage } from '@prism/types';

export type StaffingActorLookup = {
  coordinatorId?: string | null;
  email?: string | null;
  name?: string | null;
};
export type CoordinatorAssignmentListOptions = { includeHistorical?: boolean };

export interface StaffingReader {
  listCoordinators(): Promise<unknown[]>;
  listAssignmentsForCoordinator(
    coordinatorId?: string | null,
    options?: CoordinatorAssignmentListOptions,
  ): Promise<OpsCoordinatorAssignment[]>;
  listAssignmentsForEvent(eventId: string): Promise<OpsCoordinatorAssignment[]>;
  countAssignmentsForEvent(eventId: string): Promise<number>;
  countPendingAssignmentsForEvent(eventId: string): Promise<number>;
  resolveCoordinatorForActor(actor: StaffingActorLookup): Promise<OpsCoordinator>;
  findAssignmentForEventActor(eventId: string, actor: StaffingActorLookup): Promise<OpsCoordinatorAssignment | null>;
  listAvailability?(coordinatorId: string): Promise<PrismCoordinatorAvailability[]>;
  listCoverageForEvent?(eventId: string): Promise<PrismCoordinatorCoverage[]>;
  mapCoordinator(coordinator: OpsCoordinator): PrismCoordinator;
  mapCoordinatorAssignment(assignment: OpsCoordinatorAssignment): PrismCoordinatorAssignment;
}
