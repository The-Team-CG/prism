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
import type { EventOpsReadInit } from "./primitives";

export interface EventOpsLiveOpsContract {
  coordinator: {
    workspace(): Promise<PrismCoordinatorWorkspace>;
    eventSchedule(
      eventId: string,
    ): Promise<PrismCoordinatorEventSchedule>;
    /** The signed-in coordinator's focus role view; the API picks the focus event. */
    focusRoleView(init?: EventOpsReadInit): Promise<PrismCoordinatorRoleView | null>;
    roleView(eventId: string): Promise<PrismCoordinatorRoleView>;
    acknowledgeAssignment(eventId: string, assignmentId: string, input: CoordinatorAssignmentAcknowledgementInput): Promise<PrismCoordinatorAssignment>;
    withdrawAssignment(eventId: string, assignmentId: string, input: WithdrawCoordinatorAssignmentInput): Promise<PrismCoordinatorAssignment>;
    reportSupplierStatus(eventId: string, requestId: string, input: ReportSupplierSiteStatusInput): Promise<PrismSupplierQuoteRequest>;
    roleBriefs(eventId: string): Promise<PrismCoordinatorRoleBrief[]>;
    saveRoleBrief(eventId: string, role: CoordinatorRole, input: UpsertCoordinatorRoleBriefInput): Promise<PrismCoordinatorRoleBrief>;
  };

  liveOps: {
    eventDayWorkspace(
      eventId: string,
    ): Promise<PrismLiveOps>;
    schedule(
      eventId: string,
    ): Promise<PrismEventSchedule>;
    createScheduleDay(
      eventId: string,
      input: CreateEventScheduleDayInput,
    ): Promise<unknown>;
    createScheduleSegment(
      eventId: string,
      dayId: string,
      input: CreateEventScheduleSegmentInput,
    ): Promise<PrismEventScheduleSegment>;
    updateScheduleSegmentStatus(
      eventId: string,
      segmentId: string,
      input: UpdateEventScheduleSegmentStatusInput,
    ): Promise<PrismEventScheduleSegment>;
    runSheet(
      eventId: string,
      dayId?: string,
    ): Promise<PrismEventRunSheetResult>;
    designateOperator(
      eventId: string,
      input: CreateEventOperatorDesignationInput,
    ): Promise<unknown>;
    operatorDesignation(
      eventId: string,
    ): Promise<PrismEventOperatorDesignation>;
    revokeOperator(
      eventId: string,
    ): Promise<PrismEventOperatorDesignation>;
    createHandoff(
      eventId: string,
      input: CreateEventHandoffInput,
    ): Promise<PrismEventHandoff>;
    listHandoffs(
      eventId: string,
    ): Promise<PrismEventHandoff[]>;
    handoffBrief(
      eventId: string,
    ): Promise<PrismHandoffBrief>;
    listEodReports(
      eventId: string,
    ): Promise<PrismEventEodReport[]>;
    submitEodReport(
      eventId: string,
      input: CreateEventEodReportInput,
    ): Promise<PrismEventEodReport>;
    replyEodReport(
      eventId: string,
      reportId: string,
      input: CreateEventEodReplyInput,
    ): Promise<PrismEventEodReport["replies"][number]>;
    setEodIncompleteTasks(
      eventId: string,
      reportId: string,
      input: SetEventEodIncompleteTasksInput,
    ): Promise<PrismEventEodReport>;
    createTask(
      eventId: string,
      input: CreateEventDayTaskInput,
    ): Promise<PrismEventDayTask>;
    updateTask(
      eventId: string,
      taskId: string,
      input: UpdateEventDayTaskInput,
    ): Promise<PrismEventDayTask>;
    blockTask(
      eventId: string,
      taskId: string,
      input: BlockEventDayTaskInput,
    ): Promise<PrismEventDayTask>;
    unblockTask(
      eventId: string,
      taskId: string,
    ): Promise<PrismEventDayTask>;
    escalateTask(
      eventId: string,
      taskId: string,
      input: EscalateEventDayTaskInput,
    ): Promise<PrismEventDayTask>;
    updateUrgentIssue(
      eventId: string,
      issueId: string,
      input: UpdateUrgentIssueInput,
    ): Promise<PrismUrgentIssue>;
    escalateUrgentIssue(
      eventId: string,
      issueId: string,
      input: EscalateLiveOpsInput,
    ): Promise<PrismUrgentIssue>;
    requestTaskReassignment(
      eventId: string,
      taskId: string,
      input: CreateEventTaskReassignmentInput,
    ): Promise<PrismEventTaskReassignmentRequest>;
    decideTaskReassignment(
      eventId: string,
      requestId: string,
      input: DecideEventTaskReassignmentInput,
    ): Promise<PrismEventTaskReassignmentRequest>;
    updateCoordinatorAttendance(
      eventId: string,
      assignmentId: string,
      input: UpdateCoordinatorAttendanceInput,
    ): Promise<PrismCoordinatorAssignment>;
    createUrgentIssue(
      eventId: string,
      input: CreateUrgentIssueInput,
    ): Promise<PrismUrgentIssue>;
  };
}
