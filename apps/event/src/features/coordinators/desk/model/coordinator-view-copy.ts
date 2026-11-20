import { formatPortalTime } from "@prism/ui/format-date";

export function optionalNavBadge(count?: number) {
  return count || undefined;
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

/**
 * Why a coordinator cannot log tasks: their assignment's role predates the role catalog, and the API refuses new
 * tasks from such an assignment until PMCM gives it a catalog role.
 */
export function coordinatorTaskLoggingBlockedCopy(role: string): string {
  const named = role.trim() ? `, "${role.trim()}",` : "";
  return `Your role on this event${named} isn't in the coordinator role catalog, so you can't log tasks yet. Ask PMCM to update your assignment.`;
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
