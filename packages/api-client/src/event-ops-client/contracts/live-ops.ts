import type {
  CreateEventDayTaskInput,
  CreateEventTaskReassignmentInput,
  DecideEventTaskReassignmentInput,
  CreateUrgentIssueInput,
  PrismCoordinatorWorkspace,
  PrismLiveOps,
  PrismEventDayTask,
  PrismEventTaskReassignmentRequest,
  PrismUrgentIssue,
  PrismCoordinatorAssignment,
  UpdateCoordinatorAttendanceInput,
  UpdateEventDayTaskInput,
  CreateEventScheduleDayInput,
  CreateEventScheduleSegmentInput,
  UpdateEventScheduleSegmentStatusInput,
  CreateEventOperatorDesignationInput,
  CreateEventHandoffInput,
  CreateEventEodReportInput,
  CreateEventEodReplyInput,
  PrismEventSchedule,
  PrismEventScheduleSegment,
  PrismEventRunSheetResult,
  PrismEventHandoff,
  PrismEventEodReport,
  PrismHandoffBrief,
} from "@prism/types";
import type { EventOpsActorQuery } from "./primitives";

export interface EventOpsLiveOpsContract {
  coordinator: {
    workspace(actor?: EventOpsActorQuery): Promise<PrismCoordinatorWorkspace>;
  };

  liveOps: {
    eventDayWorkspace(
      eventId: string,
      actor?: EventOpsActorQuery,
    ): Promise<PrismLiveOps>;
    schedule(
      eventId: string,
      actor?: EventOpsActorQuery,
    ): Promise<PrismEventSchedule>;
    createScheduleDay(
      eventId: string,
      input: CreateEventScheduleDayInput,
      actor?: EventOpsActorQuery,
    ): Promise<unknown>;
    createScheduleSegment(
      eventId: string,
      dayId: string,
      input: CreateEventScheduleSegmentInput,
      actor?: EventOpsActorQuery,
    ): Promise<PrismEventScheduleSegment>;
    updateScheduleSegmentStatus(
      eventId: string,
      segmentId: string,
      input: UpdateEventScheduleSegmentStatusInput,
      actor?: EventOpsActorQuery,
    ): Promise<PrismEventScheduleSegment>;
    runSheet(
      eventId: string,
      dayId?: string,
      actor?: EventOpsActorQuery,
    ): Promise<PrismEventRunSheetResult>;
    designateOperator(
      eventId: string,
      input: CreateEventOperatorDesignationInput,
      actor?: EventOpsActorQuery,
    ): Promise<unknown>;
    createHandoff(
      eventId: string,
      input: CreateEventHandoffInput,
      actor?: EventOpsActorQuery,
    ): Promise<PrismEventHandoff>;
    listHandoffs(
      eventId: string,
      actor?: EventOpsActorQuery,
    ): Promise<PrismEventHandoff[]>;
    handoffBrief(
      eventId: string,
      actor?: EventOpsActorQuery,
    ): Promise<PrismHandoffBrief>;
    listEodReports(
      eventId: string,
      actor?: EventOpsActorQuery,
    ): Promise<PrismEventEodReport[]>;
    submitEodReport(
      eventId: string,
      input: CreateEventEodReportInput,
      actor?: EventOpsActorQuery,
    ): Promise<PrismEventEodReport>;
    replyEodReport(
      eventId: string,
      reportId: string,
      input: CreateEventEodReplyInput,
      actor?: EventOpsActorQuery,
    ): Promise<PrismEventEodReport["replies"][number]>;
    createTask(
      eventId: string,
      input: CreateEventDayTaskInput,
      actor?: EventOpsActorQuery,
    ): Promise<PrismEventDayTask>;
    updateTask(
      eventId: string,
      taskId: string,
      input: UpdateEventDayTaskInput,
      actor?: EventOpsActorQuery,
    ): Promise<PrismEventDayTask>;
    listTaskReassignmentRequests(
      eventId: string,
      actor?: EventOpsActorQuery,
    ): Promise<PrismEventTaskReassignmentRequest[]>;
    requestTaskReassignment(
      eventId: string,
      taskId: string,
      input: CreateEventTaskReassignmentInput,
      actor?: EventOpsActorQuery,
    ): Promise<PrismEventTaskReassignmentRequest>;
    decideTaskReassignment(
      eventId: string,
      requestId: string,
      input: DecideEventTaskReassignmentInput,
      actor?: EventOpsActorQuery,
    ): Promise<PrismEventTaskReassignmentRequest>;
    updateCoordinatorAttendance(
      eventId: string,
      assignmentId: string,
      input: UpdateCoordinatorAttendanceInput,
      actor?: EventOpsActorQuery,
    ): Promise<PrismCoordinatorAssignment>;
    createUrgentIssue(
      eventId: string,
      input: CreateUrgentIssueInput,
      actor?: EventOpsActorQuery,
    ): Promise<PrismUrgentIssue>;
  };
}
