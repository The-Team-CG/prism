import {
  createPlanningTemplateSchema,
  parseContract,
  publishPlanningTemplateVersionSchema,
  type PrismPlanningTemplate,
} from "@prism/types";
import type { TemplateCommands } from "../data/templates-repository";
import { toTemplateItems, type TemplateDraft } from "../model/template-draft";

function requireItems(draft: TemplateDraft) {
  const result = toTemplateItems(draft.items);
  if (result.problem !== null) throw new Error(result.problem);
  return result.items;
}

/** A new template starts at version 1. Each command refuses a draft that cannot be published before any request is sent. */
export async function submitNewTemplate(writer: Pick<TemplateCommands, "create">, draft: TemplateDraft): Promise<PrismPlanningTemplate> {
  if (draft.name.trim() === "") throw new Error("Name the template.");
  const input = parseContract(createPlanningTemplateSchema, { name: draft.name, description: draft.description, items: requireItems(draft) }, "Planning template");
  return writer.create(input);
}

/** Publishes the next version of a template. Earlier versions, and events already following them, stay as they were. */
export async function submitNewVersion(writer: Pick<TemplateCommands, "publish">, templateId: string, draft: TemplateDraft): Promise<PrismPlanningTemplate> {
  const input = parseContract(publishPlanningTemplateVersionSchema, { changeNote: draft.changeNote, items: requireItems(draft) }, "Template version");
  return writer.publish(templateId, input);
}

export function submitArchive(writer: Pick<TemplateCommands, "archive" | "restore">, templateId: string, archive: boolean): Promise<PrismPlanningTemplate> {
  return archive ? writer.archive(templateId) : writer.restore(templateId);
}
