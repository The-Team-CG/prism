import type {
  PrismEventPlanItem,
  PrismPlanApplyResult,
  PrismPlanPreview,
  PrismPlanningTemplate,
  PrismPlanningTemplateSummary,
} from "@prism/types";
import { prismRequest } from "../http";
import type { EventOpsClient, EventOpsClientOptions } from "./contracts";
import { withBase } from "./shared";

export function createPlanningClient(options: EventOpsClientOptions): Pick<EventOpsClient, "planning"> {
  const template = (templateId: string, rest = "") => `/planning-templates/${encodeURIComponent(templateId)}${rest}`;
  const plan = (eventId: string, rest = "") => `/events/${encodeURIComponent(eventId)}/plan${rest}`;
  const post = <T>(path: string, body?: unknown) => prismRequest<T>(path, withBase(options, { method: "POST", body }));
  return {
    planning: {
      listTemplates: (init = {}) => prismRequest<PrismPlanningTemplateSummary[]>("/planning-templates", withBase(options, { signal: init.signal })),
      template: (templateId, init = {}) => prismRequest<PrismPlanningTemplate>(template(templateId), withBase(options, { signal: init.signal })),
      createTemplate: (input) => post<PrismPlanningTemplate>("/planning-templates", input),
      publishTemplateVersion: (templateId, input) => post<PrismPlanningTemplate>(template(templateId, "/versions"), input),
      archiveTemplate: (templateId) => post<PrismPlanningTemplate>(template(templateId, "/archive")),
      restoreTemplate: (templateId) => post<PrismPlanningTemplate>(template(templateId, "/restore")),
      eventPlan: (eventId, init = {}) => prismRequest<PrismEventPlanItem[]>(plan(eventId), withBase(options, { signal: init.signal })),
      previewPlan: (eventId, input) => post<PrismPlanPreview>(plan(eventId, "/preview"), input),
      applyPlan: (eventId, input) => post<PrismPlanApplyResult>(plan(eventId, "/apply"), input),
      updatePlanItem: (eventId, itemId, input) =>
        prismRequest<PrismEventPlanItem>(plan(eventId, `/items/${encodeURIComponent(itemId)}`), withBase(options, { method: "PATCH", body: input })),
    },
  };
}
