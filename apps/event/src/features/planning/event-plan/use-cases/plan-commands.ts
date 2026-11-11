import {
  applyEventPlanSchema,
  parseContract,
  previewEventPlanSchema,
  updateEventPlanItemSchema,
  type PlanItemStatus,
  type PrismEventPlanItem,
  type PrismPlanApplyResult,
  type PrismPlanPreview,
} from "@prism/types";
import type { PlanCommands } from "../data/event-plan-repository";

export interface TaskDraft {
  title: string;
  ownerRole: string;
  ownerName: string;
  dueDate: string;
  notes: string;
  status: PlanItemStatus;
}

export function draftFromTask(item: PrismEventPlanItem): TaskDraft {
  return { title: item.title, ownerRole: item.ownerRole, ownerName: item.ownerName, dueDate: item.dueDate, notes: item.notes, status: item.status };
}

/** Preview changes nothing. A version is optional: without one, the template's current version is previewed. */
export async function submitPreview(writer: Pick<PlanCommands, "preview">, eventId: string, templateId: string, version?: number): Promise<PrismPlanPreview> {
  if (templateId.trim() === "") throw new Error("Choose a template to apply.");
  return writer.preview(eventId, parseContract(previewEventPlanSchema, { templateId, version }, "Plan preview"));
}

/** Applies exactly what was previewed: the token ties the apply to that preview, and the server refuses it if the plan moved. */
export async function submitApply(writer: Pick<PlanCommands, "apply">, eventId: string, preview: PrismPlanPreview): Promise<PrismPlanApplyResult> {
  const input = parseContract(applyEventPlanSchema, { templateId: preview.templateId, version: preview.version, previewToken: preview.previewToken }, "Plan apply");
  return writer.apply(eventId, input);
}

/** Sends only what the person changed, so an untouched field is never written and never pins the task. */
export async function submitTaskEdit(writer: Pick<PlanCommands, "updateItem">, eventId: string, item: PrismEventPlanItem, draft: TaskDraft): Promise<PrismEventPlanItem> {
  if (draft.title.trim() === "") throw new Error("A task needs a title.");
  if (draft.ownerRole.trim() === "") throw new Error("Say who owns the task.");
  const original = draftFromTask(item);
  const changes = Object.fromEntries(
    (Object.keys(draft) as Array<keyof TaskDraft>).flatMap((field) => (draft[field] === original[field] ? [] : [[field, draft[field]]])),
  );
  if (Object.keys(changes).length === 0) throw new Error("Nothing was changed.");
  return writer.updateItem(eventId, item.id, parseContract(updateEventPlanItemSchema, changes, "Plan task"));
}

export function submitStatus(writer: Pick<PlanCommands, "updateItem">, eventId: string, item: Pick<PrismEventPlanItem, "id">, status: PlanItemStatus): Promise<PrismEventPlanItem> {
  return writer.updateItem(eventId, item.id, parseContract(updateEventPlanItemSchema, { status }, "Plan task"));
}
