import type { PrismCoordinatorRoleView } from "@prism/types";

type Task = PrismCoordinatorRoleView["tasks"][number];
type Issue = PrismCoordinatorRoleView["urgentIssues"][number];

/** How loudly a row asks for the coordinator: red for overdue or critical, amber for open, grey otherwise. */
export type ShiftTone = "urgent" | "attention" | "neutral" | "done";

const CLOSED_TASK = new Set(["done", "cancelled", "closed"]);
const CLOSED_ISSUE = new Set(["resolved", "cancelled", "closed"]);

export function isOpenTask(task: Pick<Task, "status">): boolean {
  return !CLOSED_TASK.has(task.status);
}

export function isOpenIssue(issue: Pick<Issue, "status">): boolean {
  return !CLOSED_ISSUE.has(issue.status);
}

/** When a task is due: its own deadline, else the one its SLA set. */
export function taskDue(task: Pick<Task, "dueAt" | "slaDueAt">): string | null {
  return task.dueAt ?? task.slaDueAt ?? null;
}

function byDue<T>(due: (item: T) => string | null) {
  return (left: T, right: T) => (due(left) ?? "9999").localeCompare(due(right) ?? "9999");
}

export function taskTone(task: Pick<Task, "status" | "slaStatus">): ShiftTone {
  if (task.status === "done") return "done";
  if (task.status === "blocked" || task.slaStatus === "overdue") return "urgent";
  if (task.slaStatus === "due_soon") return "attention";
  return "neutral";
}

export function issueTone(issue: Pick<Issue, "status" | "severity" | "slaStatus">): ShiftTone {
  if (!isOpenIssue(issue)) return "done";
  if (issue.slaStatus === "overdue" || issue.severity === "critical") return "urgent";
  return "attention";
}

export const TASK_GROUPS = [
  { id: "blocked", title: "Blocked" },
  { id: "in_progress", title: "In progress" },
  { id: "open", title: "To do" },
  { id: "done", title: "Done" },
] as const;
export type TaskGroupId = (typeof TASK_GROUPS)[number]["id"];

function taskGroup(task: Pick<Task, "status">): TaskGroupId {
  if (task.status === "blocked" || task.status === "in_progress" || task.status === "done") return task.status;
  return "open";
}

/** The coordinator's tasks by where they stand, each group soonest due first. Cancelled tasks are left out. */
export function groupTasks(tasks: Task[]): Record<TaskGroupId, Task[]> {
  const groups: Record<TaskGroupId, Task[]> = { blocked: [], in_progress: [], open: [], done: [] };
  for (const task of tasks) {
    if (task.status === "cancelled" || task.status === "closed") continue;
    groups[taskGroup(task)].push(task);
  }
  for (const id of Object.keys(groups) as TaskGroupId[]) groups[id].sort(byDue(taskDue));
  return groups;
}

const SEVERITY_RANK: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3 };

/** Open issues, most severe first and then soonest due. */
export function openIssues(issues: Issue[]): Issue[] {
  return issues
    .filter(isOpenIssue)
    .sort((left, right) => (SEVERITY_RANK[left.severity] ?? 4) - (SEVERITY_RANK[right.severity] ?? 4) || byDue<Issue>((issue) => issue.slaDueAt ?? null)(left, right));
}

export type ShiftItem = { kind: "task" | "issue"; id: string; title: string; detail: string; due: string | null; tone: ShiftTone };

/** What is waiting on the coordinator, for My shift: open issues first, then open tasks by deadline. */
export function shiftNextUp(roleView: Pick<PrismCoordinatorRoleView, "tasks" | "urgentIssues">, limit = 5): ShiftItem[] {
  const issues = openIssues(roleView.urgentIssues).map((issue): ShiftItem => ({
    kind: "issue",
    id: issue.id,
    title: issue.title,
    detail: ["Issue", issue.affectedArea, issue.ownerRole || "Unassigned"].filter(Boolean).join(" · "),
    due: issue.slaDueAt ?? null,
    tone: issueTone(issue),
  }));
  const tasks = roleView.tasks.filter(isOpenTask).sort(byDue(taskDue)).map((task): ShiftItem => ({
    kind: "task",
    id: task.id,
    title: task.title,
    detail: task.status === "blocked" ? `Blocked: ${task.blockedReason || "no reason given"}` : ["Task", task.ownerName || task.assignedRole].join(" · "),
    due: taskDue(task),
    tone: taskTone(task),
  }));
  return [...issues, ...tasks].slice(0, limit);
}

function dayNumber(dateKey: string): number {
  return Math.floor(Date.parse(`${dateKey.slice(0, 10)}T00:00:00Z`) / 86_400_000);
}

/** The lead figure for the event: "Today" on the day, days to go before it, nothing once it is over. */
export function eventCountdown(eventDate: string | undefined, todayKey: string): { value: string; label: string } | undefined {
  if (!eventDate) return undefined;
  const days = dayNumber(eventDate) - dayNumber(todayKey);
  if (!Number.isFinite(days) || days < 0) return undefined;
  if (days === 0) return { value: "Today", label: "Event day" };
  return { value: String(days), label: days === 1 ? "day to go" : "days to go" };
}
