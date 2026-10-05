import type { ResolvedEventOpsActor } from '@prism/kernel/access-control';
import type { PrismTransactionContext } from '@prism/kernel/shared-kernel';
import type {
  CreateCoordinatorAssignmentInput,
  EventDecisionInput,
  PrismCoordinatorAssignment,
  PrismCoordinatorAttendanceUpdateResult,
  PrismEventDecisionAssignmentImpact,
  ReplaceCoordinatorAssignmentInput,
  UpdateCoordinatorAttendanceInput,
  WithdrawCoordinatorAssignmentInput,
} from '@prism/types';

export interface StaffingCommands {
  assignCoordinator(eventId: string, input: CreateCoordinatorAssignmentInput, actor: ResolvedEventOpsActor): Promise<PrismCoordinatorAssignment>;
  acknowledgeCoordinator(eventId: string, assignmentId: string, actor: ResolvedEventOpsActor): Promise<PrismCoordinatorAssignment>;
  withdrawCoordinator(
    eventId: string,
    assignmentId: string,
    input: WithdrawCoordinatorAssignmentInput,
    actor: ResolvedEventOpsActor,
  ): Promise<PrismCoordinatorAssignment>;
  replaceCoordinator(
    eventId: string,
    assignmentId: string,
    input: ReplaceCoordinatorAssignmentInput,
    actor: ResolvedEventOpsActor,
  ): Promise<{
    outgoing: PrismCoordinatorAssignment;
    incoming: PrismCoordinatorAssignment;
  }>;
  updateCoordinatorAttendance(
    eventId: string,
    assignmentId: string,
    input: UpdateCoordinatorAttendanceInput,
    actor: ResolvedEventOpsActor,
    options?: { allowAnotherAssignment?: boolean },
  ): Promise<PrismCoordinatorAttendanceUpdateResult>;
  applyEventDecisionAssignments(
    eventId: string,
    input: Pick<EventDecisionInput, 'decision' | 'supplierImpact' | 'reason' | 'newEventDate'>,
    currentEventDate: string,
    nextEventDate: string,
    actor: ResolvedEventOpsActor,
    context: PrismTransactionContext,
  ): Promise<PrismEventDecisionAssignmentImpact>;
}
