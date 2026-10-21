import { Inject, Injectable } from '@nestjs/common';
import { PrismaService } from '@prism/kernel/database';
import type {
  PrismCoordinatorAssignment,
  ReplaceCoordinatorAssignmentInput,
  UpdateCoordinatorAttendanceInput,
} from '@prism/types';
import type { ResolvedEventOpsActor } from '@prism/kernel/access-control';
import { STAFFING_COMMANDS, type StaffingCommands } from '@prism/contexts/operations';
import { recordEventDayLog } from './event-day-log.writer';

@Injectable()
export class CoordinatorLiveOpsCommandService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(STAFFING_COMMANDS) private readonly staffingCommands: StaffingCommands,
  ) {}

  async replaceCoordinatorAssignment(
    eventId: string,
    assignmentId: string,
    input: ReplaceCoordinatorAssignmentInput,
    actor: ResolvedEventOpsActor,
  ): Promise<{ replacedAssignment: PrismCoordinatorAssignment; replacementAssignment: PrismCoordinatorAssignment }> {
    const { outgoing, incoming } = await this.staffingCommands.replaceCoordinator(eventId, assignmentId, input, actor);
    await recordEventDayLog(
      this.prisma,
      eventId,
      'coordinator_replaced',
      actor,
      `Replaced ${outgoing.coordinatorName} with ${incoming.coordinatorName}`,
      'coordinator_assignment',
      outgoing.id,
      {
        replacementAssignmentId: incoming.id,
        replacementCoordinatorId: incoming.coordinatorId,
        role: incoming.role,
        reason: input.reason,
      },
      `coordinator-replaced:${eventId}:${outgoing.id}:${incoming.id}`,
    );
    return { replacedAssignment: outgoing, replacementAssignment: incoming };
  }

  async updateCoordinatorAttendance(
    eventId: string,
    assignmentId: string,
    input: UpdateCoordinatorAttendanceInput,
    actor: ResolvedEventOpsActor,
    options: { allowAnotherAssignment?: boolean } = {},
  ): Promise<PrismCoordinatorAssignment> {
    const result = await this.staffingCommands.updateCoordinatorAttendance(
      eventId,
      assignmentId,
      input,
      actor,
      options,
    );
    await recordEventDayLog(
      this.prisma,
      eventId,
      'coordinator_status_updated',
      actor,
      `Marked ${result.assignment.coordinatorName} ${result.assignment.attendanceStatus ?? input.status}`,
      'coordinator_assignment',
      result.assignment.id,
      { status: input.status, notes: input.notes ?? '', markedBy: actor.name },
      `coordinator-attendance:${eventId}:${result.assignment.id}:${result.assignment.attendanceMarkedAt ?? `${input.status}:${input.notes ?? ''}`}`,
    );
    return result.assignment;
  }
}
