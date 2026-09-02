"use client";

import { useEffect, useState } from "react";
import type { EventSession } from "@/app/lib/session";
import type { PrismCoordinatorRoleView, PrismCoordinatorWorkspace } from "@prism/types";
import {
  acknowledgeAndRefreshRoleView,
  createTaskAndRefreshRoleView,
  createUrgentIssueAndRefreshRoleView,
  loadCoordinatorRoleView,
} from "../use-cases/coordinator-desk-actions";
import {
  buildCoordinatorIssueInput,
  buildCoordinatorTaskInput,
  isRegistrationCoordinatorRole,
  isTaskOutsideOwnQueue,
  pickActiveAssignment,
  sameCoordinatorName,
  taskAssignedRoleOptions,
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

  async function acknowledge() {
    if (!event || !assignment) return;
    setBusy(true);
    try {
      setRoleViewStatus("loading");
      setRoleViewError(null);
      try {
        setRoleView(
          await acknowledgeAndRefreshRoleView({
            session,
            eventId: event.id,
            assignmentId: assignment.id,
          }),
        );
        setRoleViewStatus("success");
      } catch (err) {
        setRoleView(null);
        setRoleViewStatus("error");
        setRoleViewError(err instanceof Error ? err.message : "Unable to refresh role-safe event data.");
      }
      await onRefresh();
    } finally {
      setBusy(false);
    }
  }

  async function logTask() {
    if (!event || !roleView) return;
    setTaskBusy(true);
    setTaskError(null);
    try {
      const next = await createTaskAndRefreshRoleView({
        session,
        eventId: event.id,
        input: buildCoordinatorTaskInput({
          title: taskTitle,
          assignedRole: taskRole || roleView.role,
          priority: taskPriority,
          notes: taskNotes,
          dueAt: taskDueAt,
          assignToMe: taskAssignToMe,
          roleView,
        }),
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
      const next = await createUrgentIssueAndRefreshRoleView({
        session,
        eventId: event.id,
        input: buildCoordinatorIssueInput({
          title: issueTitle,
          severity: issueSeverity,
          affectedArea: issueAffectedArea,
          description: issueDescription,
          slaDueAt: issueSlaDueAt,
          assignToMe: issueAssignToMe,
          roleView,
        }),
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

  function selectSection(section: string) {
    setActiveSection(section);
  }

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
  };
}
