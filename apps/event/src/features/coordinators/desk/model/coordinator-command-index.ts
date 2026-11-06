import type { PrismCommandGroup, PrismPageAction } from "@prism/ui";
import type { PrismEventDayTask, PrismUrgentIssue } from "@prism/types";
import { formatPortalDateTime } from "@prism/ui/format-date";
import type { CoordinatorViewId } from "./coordinator-portal-routes";

export type CoordinatorCommandNavigate = (view: CoordinatorViewId) => void;

export function coordinatorAttendanceActionDescription({
  canMark,
  hasAssignment,
  windowOpen,
}: {
  canMark: boolean;
  hasAssignment: boolean;
  windowOpen: boolean;
}): string {
  if (canMark) return "Present, late or absent";
  if (!hasAssignment) return "No assignment for this event";
  if (!windowOpen) return "Opens the day before the event";
  return "Not available right now";
}

/** The coordinator's always-visible actions: the two that the top bar and My shift also offer. */
export function buildCoordinatorCommandActions(
  attendance: { canMark: boolean; hasAssignment: boolean; windowOpen: boolean },
  onNavigate: CoordinatorCommandNavigate,
): PrismPageAction[] {
  return [
    {
      id: "action:report-issue",
      label: "Report an issue",
      description: "Log an urgent issue for this event",
      onSelect: () => onNavigate("issues"),
    },
    {
      id: "action:mark-attendance",
      label: "Mark attendance",
      description: coordinatorAttendanceActionDescription(attendance),
      disabled: !attendance.canMark,
      onSelect: () => onNavigate("shift"),
    },
  ];
}

/** The coordinator's own tasks and issues for the open event. They appear once the person types. */
export function buildCoordinatorRecordGroups(
  { tasks, issues }: { tasks: PrismEventDayTask[]; issues: PrismUrgentIssue[] },
  onNavigate: CoordinatorCommandNavigate,
): PrismCommandGroup[] {
  return [
    {
      heading: "Tasks",
      whenSearching: true,
      actions: tasks.map((task) => ({
        id: `task:${task.id}`,
        label: task.title,
        description: [task.status.replace(/_/g, " "), task.dueAt ? `Due ${formatPortalDateTime(task.dueAt)}` : null].filter(Boolean).join(" · "),
        onSelect: () => onNavigate("tasks"),
      })),
    },
    {
      heading: "Issues",
      whenSearching: true,
      actions: issues.map((issue) => ({
        id: `issue:${issue.id}`,
        label: issue.title,
        description: `${issue.severity} · ${issue.status}`,
        onSelect: () => onNavigate("issues"),
      })),
    },
  ];
}
