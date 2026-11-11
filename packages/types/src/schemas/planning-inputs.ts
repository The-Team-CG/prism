import { z } from "zod";
import { prismCalendarDateKey } from "../coordinator-focus.js";

/**
 * Planning templates: a reusable list of tasks with an owner and a due date counted from the event date. A template is
 * versioned (a published version never changes) and applying one to an event creates the dated, owned tasks. Tasks,
 * dates and owners only: a template never carries a payment milestone or an amount.
 */

export const PLANNING_MAX_ITEMS = 200;
/** Days from the event date. Negative is before the event; a few items (thank-yous, closure) fall after it. */
export const PLANNING_MIN_OFFSET_DAYS = -730;
export const PLANNING_MAX_OFFSET_DAYS = 365;

export const PLAN_ITEM_STATUSES = ["open", "done", "skipped"] as const;
export const planItemStatusSchema = z.enum(PLAN_ITEM_STATUSES);
export type PlanItemStatus = z.infer<typeof planItemStatusSchema>;

const idSchema = z.string().trim().min(1).max(200);

/** A calendar date that exists: JavaScript rolls 30 February over into March, so compare it back. */
function isRealDateKey(value: string): boolean {
  const parsed = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

const dateKeySchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use a date like 2026-11-30").refine(isRealDateKey, "Must be a real date");
/** Stable identity of an item across versions: reapplying matches on it, so renaming the title never duplicates a task. */
export const planningItemKeySchema = z.string().trim().regex(/^[a-z][a-z0-9-]{0,39}$/, "Use lowercase letters, numbers and dashes, starting with a letter");

export const planningTemplateItemSchema = z.object({
  key: planningItemKeySchema,
  title: z.string().trim().min(1, "Give the task a title").max(120),
  ownerRole: z.string().trim().min(1, "Say who owns it").max(60),
  offsetDays: z.number().int().min(PLANNING_MIN_OFFSET_DAYS).max(PLANNING_MAX_OFFSET_DAYS),
  /** The key of another item in the same template that this one waits for. */
  dependsOn: planningItemKeySchema.nullable(),
  notes: z.string().trim().max(500),
}).strict();
export type PlanningTemplateItemInput = z.infer<typeof planningTemplateItemSchema>;

export interface PlanningItemIssue {
  index: number;
  field: "key" | "dependsOn";
  message: string;
}

type PlanningItemShape = Pick<PlanningTemplateItemInput, "key" | "dependsOn" | "offsetDays">;

/** What is wrong with the way items refer to each other. Empty means the list can be published. */
export function planningItemIssues(items: readonly PlanningItemShape[]): PlanningItemIssue[] {
  const byKey = new Map<string, PlanningItemShape>();
  const issues: PlanningItemIssue[] = [];
  items.forEach((item, index) => {
    if (byKey.has(item.key)) issues.push({ index, field: "key", message: "Another task already uses this key" });
    else byKey.set(item.key, item);
  });
  items.forEach((item, index) => {
    const issue = dependencyIssue(item, byKey);
    if (issue) issues.push({ index, field: "dependsOn", message: issue });
  });
  return issues;
}

function dependencyIssue(item: PlanningItemShape, byKey: Map<string, PlanningItemShape>): string | null {
  if (item.dependsOn === null) return null;
  if (item.dependsOn === item.key) return "A task cannot wait for itself";
  const dependency = byKey.get(item.dependsOn);
  if (!dependency) return "Waits for a task that is not in this template";
  if (dependency.offsetDays > item.offsetDays) return "Is due before the task it waits for";
  return waitsInALoop(item, byKey) ? "Tasks waiting on each other form a loop" : null;
}

function waitsInALoop(start: PlanningItemShape, byKey: Map<string, PlanningItemShape>): boolean {
  const seen = new Set<string>([start.key]);
  for (let next = start.dependsOn; next !== null; next = byKey.get(next)?.dependsOn ?? null) {
    if (seen.has(next)) return true;
    seen.add(next);
  }
  return false;
}

const planningItemsSchema = z.array(planningTemplateItemSchema).min(1, "Add at least one task").max(PLANNING_MAX_ITEMS).superRefine((items, context) => {
  for (const issue of planningItemIssues(items)) context.addIssue({ code: "custom", path: [issue.index, issue.field], message: issue.message });
});

export const createPlanningTemplateSchema = z.object({
  name: z.string().trim().min(1, "Name the template").max(80),
  description: z.string().trim().max(300),
  items: planningItemsSchema,
}).strict();
export type CreatePlanningTemplateInput = z.infer<typeof createPlanningTemplateSchema>;

/** A new version replaces the list of tasks. Earlier versions stay exactly as they were published. */
export const publishPlanningTemplateVersionSchema = z.object({
  changeNote: z.string().trim().max(300),
  items: planningItemsSchema,
}).strict();
export type PublishPlanningTemplateVersionInput = z.infer<typeof publishPlanningTemplateVersionSchema>;

/** Preview what applying a template would do to an event. Without a version, the template's current one. */
export const previewEventPlanSchema = z.object({
  templateId: idSchema,
  version: z.number().int().min(1).optional(),
}).strict();
export type PreviewEventPlanInput = z.infer<typeof previewEventPlanSchema>;

/** Apply exactly the plan that was previewed. The token is refused when the plan changed since, so nothing unseen is applied. */
export const applyEventPlanSchema = z.object({
  templateId: idSchema,
  version: z.number().int().min(1),
  previewToken: z.string().trim().min(8).max(128),
}).strict();
export type ApplyEventPlanInput = z.infer<typeof applyEventPlanSchema>;

/** Edit one task of an event's plan. Changing its title, owner role, date or notes keeps it from being rewritten by a reapply. */
export const updateEventPlanItemSchema = z.object({
  status: planItemStatusSchema.optional(),
  title: z.string().trim().min(1).max(120).optional(),
  ownerRole: z.string().trim().min(1).max(60).optional(),
  ownerName: z.string().trim().max(80).optional(),
  dueDate: dateKeySchema.optional(),
  notes: z.string().trim().max(500).optional(),
}).strict().refine((value) => Object.keys(value).length > 0, "Change at least one thing");
export type UpdateEventPlanItemInput = z.infer<typeof updateEventPlanItemSchema>;

/** A date key (YYYY-MM-DD) moved by whole days. Philippine calendar days have no daylight saving, so this is plain date math. */
export function addDaysToDateKey(dateKey: string, days: number): string {
  const moved = new Date(`${dateKey}T00:00:00Z`);
  moved.setUTCDate(moved.getUTCDate() + days);
  return moved.toISOString().slice(0, 10);
}

/** The Philippine calendar day an event is held. */
export function planningEventDateKey(eventDate: string | Date): string {
  return prismCalendarDateKey(new Date(eventDate));
}

/** When a task of a template falls for one event. */
export function planningDueDate(eventDateKey: string, offsetDays: number): string {
  return addDaysToDateKey(eventDateKey, offsetDays);
}
