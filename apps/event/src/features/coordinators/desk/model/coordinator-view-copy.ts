import { formatPortalDate, formatPortalTime } from "@prism/ui/format-date";

export function optionalNavBadge(count?: number) {
  return count || undefined;
}

export function coordinatorTaskActionCopy(loading: boolean, error: string | null, count: number) {
  if (loading) return { description: "Loading tasks assigned to you.", status: "loading" };
  if (error) return { description: "Task data is unavailable.", status: "unavailable" };
  return {
    description: count ? `${count} ${count === 1 ? "task" : "tasks"} assigned to you. Open it to see owners, deadlines and next steps.` : "No tasks assigned to you yet.",
    status: count > 0 ? "open" : "clear",
  };
}

export function coordinatorIssueActionCopy(loading: boolean, error: string | null, count: number) {
  if (loading) return { description: "Loading open issues.", status: "loading" };
  if (error) return { description: "Issue data is unavailable.", status: "unavailable" };
  return {
    description: count ? `${count} open ${count === 1 ? "issue" : "issues"}. PMCM receives escalations.` : "No open issues. You can still report a new problem.",
    status: count > 0 ? "open" : "clear",
  };
}

export function coordinatorAcknowledgeCopy(status?: string) {
  if (status === "acknowledged") {
    return {
      label: "Assignment confirmed",
      description: "Your acknowledgment has been recorded for PMCM.",
      active: true,
    };
  }
  return {
    label: "Confirm assignment",
    description: "Confirm this assignment before event day.",
    active: false,
  };
}

export function coordinatorShellDescription(event: { clientName: string; eventDate: string } | undefined, roleName: string) {
  if (!event) return "No assignment matched to this coordinator account.";
  return `${event.clientName} — ${event.eventDate}. Role: ${roleName}`;
}

export function coordinatorGreetingCopy(event: { eventName: string; clientName: string; eventDate: string } | undefined) {
  if (!event) {
    return {
      title: "No assigned event",
      description:
        "No assignment is matched to this coordinator account. Contact PMCM to confirm your event assignment.",
    };
  }
  return {
    title: event.eventName,
    description: `Client: ${event.clientName} · ${formatPortalDate(event.eventDate)}. Your view is limited to your tasks, issues, and attendance.`,
  };
}

/** Attendance as the coordinator reads it: "Not yet marked" until a mark is recorded, then the chosen status. */
export function coordinatorAttendanceSummary(attendanceStatus: string, statusLabel: string) {
  if (attendanceStatus === "pending") return "Attendance: Not yet marked";
  return `Attendance: ${statusLabel}`;
}

/** The line under the attendance buttons once a mark is recorded, e.g. "Marked Present at 8:42 AM". */
export function coordinatorAttendanceRecordLine(choiceLabel: string, markedAt: string | null) {
  const time = markedAt ? formatPortalTime(markedAt, "") : "";
  return time ? `Marked ${choiceLabel} at ${time}` : `Marked ${choiceLabel}`;
}

export function coordinatorTaskFormCopy(busy: boolean, routesAway: boolean) {
  return {
    submitLabel: busy ? "Logging task..." : "Log task",
    routesAwayNotice: routesAway
      ? "This task routes to another role queue and will not appear in your list below."
      : null,
  };
}

export function coordinatorIssueFormCopy(busy: boolean) {
  return {
    submitLabel: busy ? "Reporting issue..." : "Report issue",
  };
}

/* ── EP-11-S03: coordinator self-attendance marking ──────────────── */

export function coordinatorAttendanceControlCopy({
  hasAssignment,
  replaced,
  windowOpen,
  recordedLabel,
  pendingChoiceLabel,
}: {
  hasAssignment: boolean;
  replaced: boolean;
  windowOpen: boolean;
  /** The status PMCM or the coordinator already recorded, or null when nothing is recorded yet. */
  recordedLabel: string | null;
  pendingChoiceLabel: string | null;
}) {
  return {
    heading: "Mark your attendance",
    // Structural state only. Deliberately NOT keyed off canMark, which also
    // goes false while a mark is in flight — that would swap the buttons for a
    // "no assignment" message mid-request.
    blockedReason: replaced
      ? "This assignment was replaced. Attendance is now recorded against your replacement."
      : hasAssignment
        ? null
        : "No active assignment to mark attendance against.",
    // The API rejects coordinator marks outside the window, so the choices are
    // replaced by the recorded status, or by a PMCM pointer when nothing exists.
    closedReason: windowOpen
      ? null
      : recordedLabel
        ? `Marked ${recordedLabel}.`
        : "Attendance wasn't recorded. Contact PMCM to correct it.",
    // Absent writes a permanent critical reliability note with no retraction
    // path, so the coordinator confirms before the request fires.
    confirmPrompt: pendingChoiceLabel
      ? `Mark yourself ${pendingChoiceLabel}? This records a permanent reliability note that cannot be undone.`
      : null,
    confirmLabel: "Yes, mark me Absent",
    cancelLabel: "Cancel",
  };
}
