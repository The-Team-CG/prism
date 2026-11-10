import type {
  CoordinatorAssignmentAcknowledgementInput,
  CoordinatorRole,
  PrismCoordinatorRoleBrief,
  PrismCoordinatorRoleView,
  PrismSupplierQuoteRequest,
  ReportSupplierSiteStatusInput,
  UpsertCoordinatorRoleBriefInput,
  WithdrawCoordinatorAssignmentInput,
  BlockEventDayTaskInput,
  EscalateEventDayTaskInput,
  EscalateLiveOpsInput,
  PrismEventOperatorDesignation,
  UpdateUrgentIssueInput,
  CreateEventDayTaskInput,
  CreateEventTaskReassignmentInput,
  DecideEventTaskReassignmentInput,
  CreateUrgentIssueInput,
  PrismCoordinatorWorkspace,
  PrismCoordinatorEventSchedule,
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
  SetEventEodIncompleteTasksInput,
  PrismEventSchedule,
  PrismEventScheduleSegment,
  PrismEventRunSheetResult,
  PrismEventHandoff,
  PrismEventEodReport,
  PrismHandoffBrief,
} from "@prism/types";
import type { EventOpsActorQuery, EventOpsReadInit } from "./primitives";

export interface EventOpsLiveOpsContract {
  coordinator: {
    workspace(actor?: EventOpsActorQuery): Promise<PrismCoordinatorWorkspace>;
    eventSchedule(
      eventId: string,
      actor?: EventOpsActorQuery,
    ): Promise<PrismCoordinatorEventSchedule>;
    /** The signed-in coordinator's focus role view; the API picks the focus event. */
    focusRoleView(init?: EventOpsReadInit): Promise<PrismCoordinatorRoleView | null>;
    roleView(eventId: string, actor?: EventOpsActorQuery): Promise<PrismCoordinatorRoleView>;
    acknowledgeAssignment(eventId: string, assignmentId: string, input: CoordinatorAssignmentAcknowledgementInput, actor?: EventOpsActorQuery): Promise<PrismCoordinatorAssignment>;
    withdrawAssignment(eventId: string, assignmentId: string, input: WithdrawCoordinatorAssignmentInput, actor?: EventOpsActorQuery): Promise<PrismCoordinatorAssignment>;
    reportSupplierStatus(eventId: string, requestId: string, input: ReportSupplierSiteStatusInput, actor?: EventOpsActorQuery): Promise<PrismSupplierQuoteRequest>;
    roleBriefs(eventId: string, actor?: EventOpsActorQuery): Promise<PrismCoordinatorRoleBrief[]>;
    saveRoleBrief(eventId: string, role: CoordinatorRole, input: UpsertCoordinatorRoleBriefInput, actor?: EventOpsActorQuery): Promise<PrismCoordinatorRoleBrief>;
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
    operatorDesignation(
      eventId: string,
      actor?: EventOpsActorQuery,
    ): Promise<PrismEventOperatorDesignation>;
    revokeOperator(
      eventId: string,
      actor?: EventOpsActorQuery,
    ): Promise<PrismEventOperatorDesignation>;
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
    setEodIncompleteTasks(
      eventId: string,
      reportId: string,
      input: SetEventEodIncompleteTasksInput,
      actor?: EventOpsActorQuery,
    ): Promise<PrismEventEodReport>;
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
    blockTask(
      eventId: string,
      taskId: string,
      input: BlockEventDayTaskInput,
      actor?: EventOpsActorQuery,
    ): Promise<PrismEventDayTask>;
    unblockTask(
      eventId: string,
      taskId: string,
      actor?: EventOpsActorQuery,
    ): Promise<PrismEventDayTask>;
    escalateTask(
      eventId: string,
      taskId: string,
      input: EscalateEventDayTaskInput,
      actor?: EventOpsActorQuery,
    ): Promise<PrismEventDayTask>;
    updateUrgentIssue(
      eventId: string,
      issueId: string,
      input: UpdateUrgentIssueInput,
      actor?: EventOpsActorQuery,
    ): Promise<PrismUrgentIssue>;
    escalateUrgentIssue(
      eventId: string,
      issueId: string,
      input: EscalateLiveOpsInput,
      actor?: EventOpsActorQuery,
    ): Promise<PrismUrgentIssue>;
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
