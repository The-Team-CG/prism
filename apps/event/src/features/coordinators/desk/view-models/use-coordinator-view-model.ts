"use client";

import { useEffect, useState } from "react";
import type { EventSession } from "@/app/lib/session";
import {
  createEventDayTaskSchema,
  createEventTaskReassignmentSchema,
  createUrgentIssueSchema,
  coordinatorAssignmentAcknowledgementSchema,
  withdrawCoordinatorAssignmentSchema,
  parseContract,
  updateCoordinatorAttendanceSchema,
  type PrismCoordinatorRoleView,
  type PrismCoordinatorWorkspace,
} from "@prism/types";
import {
  acknowledgeAndRefreshRoleView,
  withdrawAndRefreshWorkspace,
  createTaskAndRefreshRoleView,
  createUrgentIssueAndRefreshRoleView,
  requestTaskReassignmentAndRefreshRoleView,
  loadCoordinatorRoleView,
  markAttendanceAndRefreshRoleView,
} from "../use-cases/coordinator-desk-actions";
import {
  attendanceChoiceLabel,
  buildCoordinatorAttendanceInput,
  buildCoordinatorIssueInput,
  buildCoordinatorTaskInput,
  canMarkOwnAttendance,
  isAttendanceChoiceDisabled,
  isRegistrationCoordinatorRole,
  isReplacedAssignment,
  isTaskOutsideOwnQueue,
  pickActiveAssignment,
  requiresAttendanceConfirmation,
  resolveOwnAttendanceStatus,
  sameCoordinatorName,
  taskAssignedRoleOptions,
  shouldPreserveRoleViewOnAcknowledgeFailure,
  COORDINATOR_ATTENDANCE_CHOICES,
  type CoordinatorAttendanceChoice,
} from "../model/coordinators-desk-rules";

export type CoordinatorViewStatus = "idle" | "loading" | "success" | "error";

export function useCoordinatorViewModel({
  session,
  state,
  onRefresh,
}: {
  session: EventSession;
  state: PrismCoordinatorWorkspace;
  onRefresh: () => Promise<void>;
}) {
  const assignments = state.assignments.filter((item) =>
    sameCoordinatorName(item.coordinatorName, session.name),
  );
  const assignment = pickActiveAssignment(assignments);
  const event = assignment ? state.events.find((item) => item.id === assignment.eventId) : undefined;
  const activeDraft = event?.floorPlanDrafts?.find((draft) => draft.eventId === event.id && draft.isActive);
  const [busy, setBusy] = useState(false);
  const [roleView, setRoleView] = useState<PrismCoordinatorRoleView | null>(null);
  const [roleViewStatus, setRoleViewStatus] = useState<CoordinatorViewStatus>("idle");
  const [roleViewError, setRoleViewError] = useState<string | null>(null);
  const [activeSection, setActiveSection] = useState("coord-home");
  // EP-11-S02: per-flow state. Deliberately NOT reusing busy or roleViewError,
  // which carry PA-285 and PA-294.
  const [taskBusy, setTaskBusy] = useState(false);
  const [taskError, setTaskError] = useState<string | null>(null);
  const [issueBusy, setIssueBusy] = useState(false);
  const [issueError, setIssueError] = useState<string | null>(null);
  const [taskTitle, setTaskTitle] = useState("");
  const [taskRole, setTaskRole] = useState("");
  const [taskPriority, setTaskPriority] = useState("normal");
  const [taskNotes, setTaskNotes] = useState("");
  const [taskDueAt, setTaskDueAt] = useState("");
  const [taskAssignToMe, setTaskAssignToMe] = useState(false);
  const [issueTitle, setIssueTitle] = useState("");
  const [issueSeverity, setIssueSeverity] = useState("high");
  const [issueAffectedArea, setIssueAffectedArea] = useState("");
  const [issueDescription, setIssueDescription] = useState("");
  const [issueSlaDueAt, setIssueSlaDueAt] = useState("");
  const [issueAssignToMe, setIssueAssignToMe] = useState(false);
  const [reassignmentBusy, setReassignmentBusy] = useState(false);
  const [reassignmentError, setReassignmentError] = useState<string | null>(null);
  // EP-11-S03: per-flow state, same reasoning as the S02 task and issue flows.
  const [attendanceBusy, setAttendanceBusy] = useState(false);
  const [attendanceError, setAttendanceError] = useState<string | null>(null);
  const [pendingAttendanceChoice, setPendingAttendanceChoice] =
    useState<CoordinatorAttendanceChoice | null>(null);

  useEffect(() => {
    if (!event?.id) {
      setRoleView(null);
      setRoleViewStatus("idle");
      setRoleViewError(null);
      return;
    }

    let alive = true;
    setRoleViewStatus("loading");
    setRoleViewError(null);
    loadCoordinatorRoleView(session, event.id)
      .then((next) => {
        if (!alive) return;
        setRoleView(next);
        setRoleViewStatus("success");
      })
      .catch((err) => {
        if (!alive) return;
        setRoleView(null);
        setRoleViewStatus("error");
        setRoleViewError(err instanceof Error ? err.message : "Unable to load role-safe event data.");
      });

    return () => {
      alive = false;
    };
  }, [event?.id, session.email, session.name]);

  async function acknowledge(decision: "acknowledged" | "declined" = "acknowledged", reason?: string) {
    if (!event || !assignment) return;
    setBusy(true);
    try {
      setRoleViewStatus("loading");
      setRoleViewError(null);
      const input = parseContract(
        coordinatorAssignmentAcknowledgementSchema,
        { decision, reason },
        "Coordinator assignment acknowledgement",
      );
      try {
        setRoleView(
          await acknowledgeAndRefreshRoleView({
            session,
            eventId: event.id,
            assignmentId: assignment.id,
            input,
          }),
        );
        setRoleViewStatus("success");
      } catch (err) {
        if (!shouldPreserveRoleViewOnAcknowledgeFailure()) {
          setRoleView(null);
        }
        setRoleViewStatus("error");
        setRoleViewError(err instanceof Error ? err.message : "Unable to refresh role-safe event data.");
      }
      await onRefresh();
    } finally {
      setBusy(false);
    }
  }

  async function withdraw() {
    if (!event || !assignment) return;
    const reason = window.prompt("Why are you withdrawing this assignment?")?.trim() ?? "";
    try {
      const input = parseContract(withdrawCoordinatorAssignmentSchema, { reason }, "Coordinator assignment withdrawal");
      setBusy(true);
      await withdrawAndRefreshWorkspace({ session, eventId: event.id, assignmentId: assignment.id, input });
      await onRefresh();
    } catch (err) {
      setRoleViewError(err instanceof Error ? err.message : "Unable to withdraw this assignment.");
    } finally {
      setBusy(false);
    }
  }

  async function logTask() {
    if (!event || !roleView) return;
    setTaskBusy(true);
    setTaskError(null);
    try {
      const input = parseContract(
        createEventDayTaskSchema,
        buildCoordinatorTaskInput({
          title: taskTitle,
          assignedRole: taskRole || roleView.role,
          priority: taskPriority,
          notes: taskNotes,
          dueAt: taskDueAt,
          assignToMe: taskAssignToMe,
          roleView,
        }),
        "Create coordinator task",
      );
      const next = await createTaskAndRefreshRoleView({
        session,
        eventId: event.id,
        input,
      });
      setRoleView(next);
      setTaskTitle("");
      setTaskNotes("");
      setTaskDueAt("");
    } catch (err) {
      // PA-294: do NOT setRoleView(null) here. A failed submission must not
      // blank the coordinator screen mid-event.
      setTaskError(err instanceof Error ? err.message : "Unable to log the task.");
    } finally {
      setTaskBusy(false);
    }
  }

  async function logUrgentIssue() {
    if (!event || !roleView) return;
    setIssueBusy(true);
    setIssueError(null);
    try {
      const input = parseContract(
        createUrgentIssueSchema,
        buildCoordinatorIssueInput({
          title: issueTitle,
          severity: issueSeverity,
          affectedArea: issueAffectedArea,
          description: issueDescription,
          slaDueAt: issueSlaDueAt,
          assignToMe: issueAssignToMe,
          roleView,
        }),
        "Create coordinator urgent issue",
      );
      const next = await createUrgentIssueAndRefreshRoleView({
        session,
        eventId: event.id,
        input,
      });
      setRoleView(next);
      setIssueTitle("");
      setIssueAffectedArea("");
      setIssueDescription("");
      setIssueSlaDueAt("");
    } catch (err) {
      // PA-294: same constraint as logTask.
      setIssueError(err instanceof Error ? err.message : "Unable to log the urgent issue.");
    } finally {
      setIssueBusy(false);
    }
  }

  async function requestReassignment(taskId: string) {
    if (!event || !roleView?.isDesignatedOperator) return;
    const toOwnerRole = window.prompt("Role to take this task")?.trim() ?? "";
    const toOwnerName = window.prompt("Coordinator name (optional)")?.trim() ?? "";
    const reason = window.prompt("Why does this task need reassignment?")?.trim() ?? "";
    setReassignmentBusy(true);
    setReassignmentError(null);
    try {
      const input = parseContract(
        createEventTaskReassignmentSchema,
        { toOwnerRole, toOwnerName: toOwnerName || undefined, reason },
        "Task reassignment request",
      );
      setRoleView(
        await requestTaskReassignmentAndRefreshRoleView({ session, eventId: event.id, taskId, input }),
      );
    } catch (err) {
      setReassignmentError(err instanceof Error ? err.message : "Unable to request task reassignment.");
    } finally {
      setReassignmentBusy(false);
    }
  }

  async function submitAttendance(choice: CoordinatorAttendanceChoice) {
    if (!event || !assignment) return;
    setAttendanceBusy(true);
    setAttendanceError(null);
    try {
      const input = parseContract(
        updateCoordinatorAttendanceSchema,
        buildCoordinatorAttendanceInput(choice),
        "Update coordinator attendance",
      );
      const next = await markAttendanceAndRefreshRoleView({
        session,
        eventId: event.id,
        assignmentId: assignment.id,
        input,
      });
      setRoleView(next);
      // The badge and summary read attendanceStatus off the workspace prop, not
      // off roleView, so the workspace must refresh too or the visible status
      // stays stale. acknowledge() does the same.
      await onRefresh();
    } catch (err) {
      // PA-294: do NOT setRoleView(null) here. A failed mark must not blank the
      // coordinator screen mid-event.
      setAttendanceError(err instanceof Error ? err.message : "Unable to update your attendance.");
    } finally {
      setAttendanceBusy(false);
    }
  }

  function markAttendance(choice: CoordinatorAttendanceChoice) {
    setAttendanceError(null);
    // Picking any choice clears a pending confirm first, so an unconfirmed
    // Absent cannot survive into a later pick.
    setPendingAttendanceChoice(null);
    if (requiresAttendanceConfirmation(choice)) {
      setPendingAttendanceChoice(choice);
      return;
    }
    void submitAttendance(choice);
  }

  function confirmAttendance() {
    if (!pendingAttendanceChoice) return;
    const choice = pendingAttendanceChoice;
    setPendingAttendanceChoice(null);
    void submitAttendance(choice);
  }

  function cancelAttendance() {
    setPendingAttendanceChoice(null);
  }

  function selectSection(section: string) {
    setActiveSection(section);
  }

  // PA-299 lives in the model, with its own test, so the rule cannot drift back
  // into the acknowledgment vocabulary here.
  const attendanceStatus = resolveOwnAttendanceStatus(assignment);
  const attendanceCanMark = canMarkOwnAttendance({ assignment, busy, attendanceBusy });
  const pendingAttendanceLabel = attendanceChoiceLabel(pendingAttendanceChoice);

  return {
    status: roleViewStatus,
    assignments,
    assignment,
    event,
    activeDraft,
    busy,
    roleView,
    roleViewLoading: roleViewStatus === "loading",
    roleViewError,
    roleDataStatus:
      roleViewStatus === "loading"
        ? "loading"
        : roleViewStatus === "error"
          ? "unavailable"
          : roleView
            ? "ready"
            : "pending",
    activeSection,
    registrationRole: isRegistrationCoordinatorRole(assignment?.role),
    acknowledge,
    decline: (reason?: string) => acknowledge("declined", reason),
    withdraw,
    selectSection,
    taskForm: {
      title: taskTitle,
      setTitle: setTaskTitle,
      role: taskRole || roleView?.role || "",
      setRole: setTaskRole,
      priority: taskPriority,
      setPriority: setTaskPriority,
      notes: taskNotes,
      setNotes: setTaskNotes,
      dueAt: taskDueAt,
      setDueAt: setTaskDueAt,
      assignToMe: taskAssignToMe,
      setAssignToMe: setTaskAssignToMe,
      roleOptions: roleView ? taskAssignedRoleOptions(roleView) : [],
      routesAway: roleView
        ? isTaskOutsideOwnQueue({
            assignedRole: taskRole || roleView.role,
            ownRole: roleView.role,
            assignToMe: taskAssignToMe,
          })
        : false,
      busy: taskBusy,
      error: taskError,
      submit: logTask,
    },
    issueForm: {
      title: issueTitle,
      setTitle: setIssueTitle,
      severity: issueSeverity,
      setSeverity: setIssueSeverity,
      affectedArea: issueAffectedArea,
      setAffectedArea: setIssueAffectedArea,
      description: issueDescription,
      setDescription: setIssueDescription,
      slaDueAt: issueSlaDueAt,
      setSlaDueAt: setIssueSlaDueAt,
      assignToMe: issueAssignToMe,
      setAssignToMe: setIssueAssignToMe,
      busy: issueBusy,
      error: issueError,
      submit: logUrgentIssue,
    },
    reassignment: {
      busy: reassignmentBusy,
      error: reassignmentError,
      request: requestReassignment,
    },
    attendanceStatus,
    attendanceForm: {
      status: attendanceStatus,
      choices: COORDINATOR_ATTENDANCE_CHOICES,
      canMark: attendanceCanMark,
      hasAssignment: Boolean(assignment),
      replaced: isReplacedAssignment(assignment),
      isDisabled: (choice: CoordinatorAttendanceChoice) =>
        isAttendanceChoiceDisabled({
          choice,
          attendanceStatus,
          canMark: attendanceCanMark,
        }),
      pendingChoice: pendingAttendanceChoice,
      pendingChoiceLabel: pendingAttendanceLabel,
      busy: attendanceBusy,
      error: attendanceError,
      mark: markAttendance,
      confirm: confirmAttendance,
      cancel: cancelAttendance,
    },
  };
}
