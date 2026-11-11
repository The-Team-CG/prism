import {
  PLANNING_MAX_OFFSET_DAYS,
  PLANNING_MIN_OFFSET_DAYS,
  planningItemIssues,
  type PlanningTemplateItemInput,
  type PrismPlanningTemplateItem,
} from "@prism/types";

export type DraftWhen = "before" | "after";

/** A task as the editor holds it. `rowId` is local; `dependsOn` names another row by its `rowId`, since a new row has no key yet. */
export interface DraftItem {
  rowId: string;
  /** The stable key of a task that is already in a published version; empty for a task added in this edit. */
  key: string;
  title: string;
  ownerRole: string;
  days: string;
  when: DraftWhen;
  dependsOn: string;
  notes: string;
}

export interface TemplateDraft {
  name: string;
  description: string;
  changeNote: string;
  items: DraftItem[];
}

let rowCounter = 0;
export const newRowId = () => `row-${(rowCounter += 1)}`;

export const emptyItem = (): DraftItem => ({ rowId: newRowId(), key: "", title: "", ownerRole: "", days: "30", when: "before", dependsOn: "", notes: "" });
export const emptyDraft = (): TemplateDraft => ({ name: "", description: "", changeNote: "", items: [emptyItem()] });

/** The editor's rows for a published version, keeping every key so a reapply still matches the same tasks. */
export function draftFromItems(items: readonly PrismPlanningTemplateItem[]): DraftItem[] {
  const rowIdByKey = new Map(items.map((item) => [item.key, newRowId()]));
  return items.map((item) => ({
    rowId: rowIdByKey.get(item.key)!,
    key: item.key,
    title: item.title,
    ownerRole: item.ownerRole,
    days: String(Math.abs(item.offsetDays)),
    when: item.offsetDays > 0 ? "after" : "before",
    dependsOn: item.dependsOn ? rowIdByKey.get(item.dependsOn) ?? "" : "",
    notes: item.notes,
  }));
}

/** Days from the event date: negative before it, positive after. Whole days within the contract's range, or null. */
export function offsetOf(item: Pick<DraftItem, "days" | "when">): number | null {
  if (!/^\d+$/.test(item.days.trim())) return null;
  const days = Number(item.days.trim());
  // 0 - days, not -days: "0 days before" must be 0, never negative zero.
  const offset = item.when === "before" ? 0 - days : days;
  return offset >= PLANNING_MIN_OFFSET_DAYS && offset <= PLANNING_MAX_OFFSET_DAYS ? offset : null;
}

export function offsetLabel(offsetDays: number): string {
  if (offsetDays === 0) return "On the event day";
  const days = Math.abs(offsetDays);
  return `${days} ${days === 1 ? "day" : "days"} ${offsetDays < 0 ? "before" : "after"}`;
}

/** A stable key from a title: lowercase words joined by dashes, starting with a letter, unique among `taken`. */
export function slugKey(title: string, taken: ReadonlySet<string>): string {
  const words = title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
  const base = (/^[a-z]/.test(words) ? words : `task-${words}`).replace(/-+$/g, "").slice(0, 36) || "task";
  if (!taken.has(base)) return base;
  let suffix = 2;
  while (taken.has(`${base}-${suffix}`)) suffix += 1;
  return `${base}-${suffix}`;
}

function rowProblem(item: DraftItem, position: number): string | null {
  const where = `Task ${position + 1}`;
  if (item.title.trim() === "") return `${where}: give it a title.`;
  if (item.ownerRole.trim() === "") return `${where}: say who owns it.`;
  if (offsetOf(item) === null) return `${where}: days must be a whole number from 0 to ${PLANNING_MAX_OFFSET_DAYS} (730 before the event).`;
  return null;
}

/** Keys for rows that have none, taking care never to reuse a key a kept row already holds. */
function assignKeys(items: readonly DraftItem[]): Map<string, string> {
  const taken = new Set(items.map((item) => item.key).filter(Boolean));
  const keys = new Map<string, string>();
  for (const item of items) {
    if (item.key) keys.set(item.rowId, item.key);
    else {
      const key = slugKey(item.title, taken);
      taken.add(key);
      keys.set(item.rowId, key);
    }
  }
  return keys;
}

/**
 * The contract's tasks for a draft, or a sentence saying what to fix. Problems are named by the task's position so a long
 * list stays easy to correct; the shared rules for waiting on another task are the same ones the server applies.
 */
export function toTemplateItems(draft: readonly DraftItem[]): { items: PlanningTemplateItemInput[]; problem: null } | { items: null; problem: string } {
  for (const [position, item] of draft.entries()) {
    const problem = rowProblem(item, position);
    if (problem) return { items: null, problem };
  }
  const keys = assignKeys(draft);
  const items = draft.map((item) => ({
    key: keys.get(item.rowId)!,
    title: item.title.trim(),
    ownerRole: item.ownerRole.trim(),
    offsetDays: offsetOf(item)!,
    dependsOn: item.dependsOn ? keys.get(item.dependsOn) ?? null : null,
    notes: item.notes.trim(),
  }));
  const [issue] = planningItemIssues(items);
  return issue ? { items: null, problem: `Task ${issue.index + 1}: ${issue.message.toLowerCase()}.` } : { items, problem: null };
}
