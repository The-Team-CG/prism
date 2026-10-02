"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { EventSession } from "@/app/lib/session";
import { useEventDayLiveUpdates } from "@/features/live-ops/workspace";
import {
  canonicalCoordinatorRole,
  createEventDayTaskSchema,
  createEventTaskReassignmentSchema,
  createUrgentIssueSchema,
  coordinatorAssignmentAcknowledgementSchema,
  withdrawCoordinatorAssignmentSchema,
  parseContract,
  updateCoordinatorAttendanceSchema,
  updateEventDayTaskSchema,
  verifySupplierStatusSchema,
  type CreateEventTaskReassignmentInput,
  type CoordinatorRole,
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
  updateOwnTaskAndRefreshRoleView,
  updateDelegatedAttendanceAndRefreshRoleView,
  verifySupplierStatusAndRefreshRoleView,
} from "../use-cases/coordinator-desk-actions";
import {
  coordinatorRoleDataStatus,
  resolveCoordinatorTaskRole,
  attendanceChoiceLabel,
  buildCoordinatorAttendanceInput,
  buildCoordinatorIssueInput,
  buildCoordinatorTaskInput,
  canConfirmPendingAttendance,
  canMarkOwnAttendance,
  isCoordinatorAssignmentActive,
  isAttendanceChoiceDisabled,
  isRegistrationCoordinatorRole,
  isIngressOrEgressRole,
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
  const defaultAssignment = pickActiveAssignment(assignments.filter(isCoordinatorAssignmentActive));
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);
  const event =
    state.events.find((item) => item.id === selectedEventId) ??
    state.events.find((item) => item.id === defaultAssignment?.eventId);
  const assignment = pickActiveAssignment(assignments.filter((item) => item.eventId === event?.id));
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
  const [taskRole, setTaskRole] = useState<CoordinatorRole | "">("");
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
  const [operatorBusy, setOperatorBusy] = useState(false);
  const [operatorError, setOperatorError] = useState<string | null>(null);
  const [supplierBusy, setSupplierBusy] = useState(false);
  const [supplierError, setSupplierError] = useState<string | null>(null);
  // EP-11-S03: per-flow state, same reasoning as the S02 task and issue flows.
  const [attendanceBusy, setAttendanceBusy] = useState(false);
  const [attendanceError, setAttendanceError] = useState<string | null>(null);
  const [pendingAttendanceChoice, setPendingAttendanceChoice] =
    useState<CoordinatorAttendanceChoice | null>(null);

  const activeEventIdRef = useRef<string | null>(event?.id ?? null);
  useEffect(() => {
    activeEventIdRef.current = event?.id ?? null;
  }, [event?.id]);

  useEffect(() => {
    if (!event?.id) {
      setRoleView(null);
      setRoleViewStatus("idle");
      setRoleViewError(null);
      return;
    }

    let alive = true;
    setRoleView(null);
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

  const refreshRoleView = useCallback(async () => {
    const eventId = event?.id;
    if (!eventId) return;
    try {
      const next = await loadCoordinatorRoleView(session, eventId);
      if (activeEventIdRef.current !== eventId) return;
      setRoleView(next);
      setRoleViewStatus("success");
      setRoleViewError(null);
    } catch {
      // Keep the last role-safe data visible during a temporary network failure.
    }
  }, [event?.id, session.email, session.name]);

  useEventDayLiveUpdates({
    enabled: Boolean(event?.id),
    refresh: refreshRoleView,
    refreshOnEnable: false,
  });

  const taskOwnerAssignmentRequired = Boolean(roleView && !canonicalCoordinatorRole(roleView.role));

  // HIDE half: once the assignment can no longer be marked — replaced by PMCM,
  // or gone from the workspace entirely — drop any open confirm prompt so it
  // cannot be tapped against stale state. Paired with the submit-time re-check
  // in confirmAttendance, which is the guarantee; this is the render concern.
  const attendanceAssignmentUsable = canMarkOwnAttendance({ assignment, busy: false });
  useEffect(() => {
    if (!attendanceAssignmentUsable) setPendingAttendanceChoice(null);
  }, [attendanceAssignmentUsable]);

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
          assignedRole: resolveCoordinatorTaskRole(taskRole, roleView.role),
          priority: taskPriority,
          notes: taskNotes,
          dueAt: taskDueAt,
          assignToMe: taskAssignToMe || taskOwnerAssignmentRequired,
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

  async function requestReassignment(taskId: string, values: CreateEventTaskReassignmentInput) {
    if (!event || !roleView?.isDesignatedOperator) return;
    setReassignmentBusy(true);
    setReassignmentError(null);
    try {
      const input = parseContract(
        createEventTaskReassignmentSchema,
        values,
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

  async function updateTaskStatus(taskId: string, status: string) {
    if (!event) return;
    setTaskBusy(true);
    setTaskError(null);
    try {
      const input = parseContract(updateEventDayTaskSchema, { status }, "Coordinator task update");
      setRoleView(await updateOwnTaskAndRefreshRoleView({ session, eventId: event.id, taskId, input }));
    } catch (error) {
      setTaskError(error instanceof Error ? error.message : "Unable to update this task.");
    } finally { setTaskBusy(false); }
  }

  async function updateDelegatedAttendance(assignmentId: string, status: string) {
    if (!event || !roleView?.isDesignatedOperator) return;
    setOperatorBusy(true);
    setOperatorError(null);
    try {
      const input = parseContract(updateCoordinatorAttendanceSchema, { status, notes: "Updated by the designated event operator." }, "Coordinator attendance update");
      setRoleView(await updateDelegatedAttendanceAndRefreshRoleView({ session, eventId: event.id, assignmentId, input }));
    } catch (error) { setOperatorError(error instanceof Error ? error.message : "Unable to update coordinator attendance."); }
    finally { setOperatorBusy(false); }
  }

  async function verifySupplier(requestId: string, verificationStatus: "verified" | "disputed", note = "") {
    if (!event || !(roleView?.isDesignatedOperator || isIngressOrEgressRole(roleView?.role))) return;
    setSupplierBusy(true);
    setSupplierError(null);
    try {
      const input = parseContract(verifySupplierStatusSchema, {
        verificationStatus,
        notes: note.trim() || (verificationStatus === "verified" ? "Supplier setup confirmed on site." : "Supplier setup disputed on site; PMCM follow-up required."),
      }, "Supplier setup verification");
      setRoleView(await verifySupplierStatusAndRefreshRoleView({ session, eventId: event.id, requestId, input }));
    } catch (error) { setSupplierError(error instanceof Error ? error.message : "Unable to update supplier setup status."); }
    finally { setSupplierBusy(false); }
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
    const choice = pendingAttendanceChoice;
    setPendingAttendanceChoice(null);
    if (!choice) return;
    // REJECT half: re-check assignment state at submit time. The prompt may have
    // outlived the assignment it was opened against (PMCM replacement, role-view
    // refresh), and hiding it is a render concern that can lose that race.
    if (!canConfirmPendingAttendance({ assignment, pendingChoice: choice, busy: attendanceBusy })) {
      return;
    }
    void submitAttendance(choice);
  }

  function cancelAttendance() {
    setPendingAttendanceChoice(null);
  }

  function selectSection(section: string) {
    setActiveSection(section);
  }

  function selectEvent(eventId: string) {
    if (!assignments.some((item) => item.eventId === eventId) || !state.events.some((item) => item.id === eventId)) return;
    if (eventId === event?.id) return;
    setRoleView(null);
    setRoleViewStatus("loading");
    setRoleViewError(null);
    setSelectedEventId(eventId);
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
    roleDataStatus: coordinatorRoleDataStatus(roleViewStatus, Boolean(roleView)),
    activeSection,
    registrationRole: isRegistrationCoordinatorRole(assignment?.role),
    acknowledge,
    decline: (reason?: string) => acknowledge("declined", reason),
    withdraw,
    selectSection,
    selectEvent,
    taskForm: {
      title: taskTitle,
      setTitle: setTaskTitle,
      role: resolveCoordinatorTaskRole(taskRole, roleView?.role),
      setRole: (value: string) => setTaskRole(canonicalCoordinatorRole(value) ?? ""),
      priority: taskPriority,
      setPriority: setTaskPriority,
      notes: taskNotes,
      setNotes: setTaskNotes,
      dueAt: taskDueAt,
      setDueAt: setTaskDueAt,
      assignToMe: taskAssignToMe || taskOwnerAssignmentRequired,
      assignToMeRequired: taskOwnerAssignmentRequired,
      setAssignToMe: (value: boolean) => {
        if (!taskOwnerAssignmentRequired) setTaskAssignToMe(value);
      },
      roleOptions: roleView ? taskAssignedRoleOptions(roleView) : [],
      routesAway: roleView
        ? isTaskOutsideOwnQueue({
            assignedRole: resolveCoordinatorTaskRole(taskRole, roleView.role),
            ownRole: roleView.role,
            assignToMe: taskAssignToMe || taskOwnerAssignmentRequired,
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
    taskActions: { busy: taskBusy, error: taskError, updateStatus: updateTaskStatus },
    operatorActions: {
      busy: operatorBusy,
      error: operatorError,
      supplierBusy,
      supplierError,
      updateAttendance: updateDelegatedAttendance,
      verifySupplier,
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
