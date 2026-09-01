import type { ResolvedEventOpsActor } from '@prism/kernel/access-control';
import type {
  CreateCoordinatorAssignmentInput,
  ReplaceCoordinatorAssignmentInput,
  WithdrawCoordinatorAssignmentInput,
} from '../application/staffing/coordinators.service';

export interface StaffingCommands {
  assignCoordinator(eventId: string, input: CreateCoordinatorAssignmentInput, actor: ResolvedEventOpsActor): Promise<unknown>;
  acknowledgeCoordinator(eventId: string, assignmentId: string, actor: ResolvedEventOpsActor): Promise<unknown>;
  withdrawCoordinator(
    eventId: string,
    assignmentId: string,
    input: WithdrawCoordinatorAssignmentInput,
    actor: ResolvedEventOpsActor,
  ): Promise<unknown>;
  replaceCoordinator(
    eventId: string,
    assignmentId: string,
    input: ReplaceCoordinatorAssignmentInput,
    actor: ResolvedEventOpsActor,
  ): Promise<unknown>;
}
