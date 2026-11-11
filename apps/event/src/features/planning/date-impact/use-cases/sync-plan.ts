import { parseContract, syncEventPlanSchema, type PrismDateChangeImpact, type PrismPlanApplyResult } from "@prism/types";
import type { DateImpactCommands } from "../data/date-impact-repository";
import { canSyncPlan, syncableTemplates } from "../model/impact-rules";

/**
 * Moves the plan's open tasks to follow the event date. It sends back the previews that were shown, so the server applies
 * exactly those, together or not at all. Nothing is sent for a date the event does not have yet, or when nothing needs moving.
 */
export async function submitSyncPlan(writer: Pick<DateImpactCommands, "syncPlan">, impact: PrismDateChangeImpact): Promise<PrismPlanApplyResult> {
  if (!impact.planApplicable) throw new Error("Record the new date on the event first. The plan can only follow a date the event has.");
  if (!canSyncPlan(impact)) throw new Error("The plan already follows the event date.");
  const templates = syncableTemplates(impact).map((template) => ({ templateId: template.templateId, version: template.version, previewToken: template.previewToken }));
  return writer.syncPlan(impact.eventId, parseContract(syncEventPlanSchema, { templates }, "Plan sync"));
}
