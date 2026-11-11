import { defineResource } from "@prism/portal-query";
import type { CreatePlanningTemplateInput, PublishPlanningTemplateVersionInput } from "@prism/types";
import { eventApi } from "@/lib/prism-api";

/** The catalogue: every template with its current version. Short freshness, since PMCM publishes and archives here. */
export const planningTemplates = defineResource({
  name: "planning.templates",
  staleMs: 10_000,
  fetch: (_key: "all", signal) => eventApi.planning.listTemplates({ signal }),
});

/** One template with every version it was published as. */
export const planningTemplate = defineResource({
  name: "planning.template",
  staleMs: 10_000,
  fetch: (templateId: string, signal) => eventApi.planning.template(templateId, { signal }),
});

export const templatesRepository = {
  create: (input: CreatePlanningTemplateInput) => eventApi.planning.createTemplate(input),
  publish: (templateId: string, input: PublishPlanningTemplateVersionInput) => eventApi.planning.publishTemplateVersion(templateId, input),
  archive: (templateId: string) => eventApi.planning.archiveTemplate(templateId),
  restore: (templateId: string) => eventApi.planning.restoreTemplate(templateId),
};

export type TemplateCommands = typeof templatesRepository;
