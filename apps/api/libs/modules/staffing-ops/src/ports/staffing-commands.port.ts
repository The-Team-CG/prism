import type { CreateCoordinatorAssignmentInput } from '../services/coordinators.service';

export interface StaffingCommands {
  assignCoordinator(eventId: string, input: CreateCoordinatorAssignmentInput): Promise<unknown>;
  acknowledgeCoordinator(eventId: string, assignmentId: string): Promise<unknown>;
}
