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

/** What is waiting on the coordinator, for Now: open issues first, then open tasks by deadline. */
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

/** Where the coordinator is relative to the event: preparing, on the day, or after it. */
export type EventPhase = "before" | "day" | "after";

export function eventPhase(eventDate: string | undefined, todayKey: string): EventPhase {
  if (!eventDate) return "before";
  const days = dayNumber(eventDate) - dayNumber(todayKey);
  if (days > 0) return "before";
  return days === 0 ? "day" : "after";
}

type Schedule = NonNullable<PrismCoordinatorRoleView["schedule"]>;
type Segment = Schedule["days"][number]["segments"][number];
type Timer = PrismCoordinatorRoleView["timer"];

/**
 * What is on now and what comes next, from the published run sheet. The live timer names the running segment; without
 * one, the first segment still marked active counts as on now, and the next is the first one still planned after it.
 */
export function runSheetNowAndNext(schedule: Schedule | undefined, timer: Timer): { now?: Segment; next?: Segment; secondsRemaining?: number } {
  if (!schedule?.authored) return {};
  const segments = schedule.days.flatMap((day) => day.segments).sort((left, right) => left.plannedStartAt.localeCompare(right.plannedStartAt) || left.sequence - right.sequence);
  const now = segments.find((segment) => segment.id === timer?.segmentId) ?? segments.find((segment) => segment.status === "active");
  const after = now ? segments.slice(segments.indexOf(now) + 1) : segments;
  const next = after.find((segment) => segment.status === "planned");
  return { now, next, secondsRemaining: timer?.secondsRemaining };
}

/** Countdown text for the live panel: "8:42", or "1:05:00" past an hour. */
export function formatCountdown(seconds: number): string {
  const total = Math.max(0, Math.floor(seconds));
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const rest = String(total % 60).padStart(2, "0");
  return hours ? `${hours}:${String(minutes).padStart(2, "0")}:${rest}` : `${minutes}:${rest}`;
}

/** The kinds of problem a coordinator reports on site. The kind leads the issue's title, so PMCM sees it in every list. */
export const QUICK_ISSUE_TYPES = ["Supplier", "Guest", "Equipment", "Venue or safety", "Other"] as const;
export type QuickIssueType = (typeof QUICK_ISSUE_TYPES)[number];

/** "Supplier: Caterer is 30 minutes late", or "Supplier issue · Kitchen" when nothing was typed. */
export function quickIssueTitle(type: QuickIssueType, note: string, area: string): string {
  const firstLine = note.trim().split("\n")[0]?.trim() ?? "";
  if (firstLine) return `${type}: ${firstLine}`.slice(0, 120);
  return area.trim() ? `${type} issue · ${area.trim()}` : `${type} issue`;
}

/** Places to pick from when reporting: the run sheet's locations, then areas used in earlier reports, then the venue. */
export function issueAreaOptions(roleView: Pick<PrismCoordinatorRoleView, "schedule" | "urgentIssues">, venue: string | undefined, limit = 6): string[] {
  const fromSchedule = (roleView.schedule?.days ?? []).flatMap((day) => day.segments.map((segment) => segment.location));
  const fromIssues = roleView.urgentIssues.map((issue) => issue.affectedArea);
  const seen = new Set<string>();
  const options: string[] = [];
  for (const area of [...fromSchedule, ...fromIssues, venue ?? ""]) {
    const name = area?.trim();
    if (!name || seen.has(name.toLowerCase())) continue;
    seen.add(name.toLowerCase());
    options.push(name);
  }
  return options.slice(0, limit);
}

/** Ready-made reasons for blocking a task, so the most common ones take one tap. */
export const TASK_BLOCK_REASONS = ["Waiting on supplier", "Waiting on venue", "Need PMCM"] as const;

/** How Now shows attendance: nothing, the one-tap arrival, the recorded mark as a line, or all three choices. */
export type QuickAttendanceMode = "hidden" | "one-tap" | "recorded" | "choices";

export function quickAttendanceMode(form: { hasAssignment: boolean; windowOpen: boolean; canMark: boolean; replaced: boolean; status: string; pendingChoice: string | null }, recorded: boolean, expanded: boolean): QuickAttendanceMode {
  if (!form.hasAssignment || (!form.windowOpen && !recorded)) return "hidden";
  if (expanded || form.pendingChoice) return "choices";
  if (recorded) return "recorded";
  return form.windowOpen && form.canMark && !form.replaced ? "one-tap" : "choices";
}

/** The Tasks page's status: "3 open · 1 blocked", or that nothing is assigned. */
export function tasksSummary(tasks: Task[]): string {
  const open = tasks.filter(isOpenTask);
  if (!open.length) return "Nothing assigned to you right now";
  const blocked = open.filter((task) => task.status === "blocked").length;
  return [`${open.length} open`, blocked ? `${blocked} blocked` : null].filter(Boolean).join(" · ");
}

/** The Issues page's status: "1 open · 1 overdue · 3 guests checked in". */
export function issuesSummary(issues: Issue[], checkIns: number): string {
  const open = openIssues(issues);
  const overdue = open.filter((issue) => issue.slaStatus === "overdue").length;
  return [open.length ? `${open.length} open` : "No open issues", overdue ? `${overdue} overdue` : null, `${checkIns} ${checkIns === 1 ? "guest" : "guests"} checked in`].filter(Boolean).join(" · ");
}
