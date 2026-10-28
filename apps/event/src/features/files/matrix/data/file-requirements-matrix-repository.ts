import type { CreateFileRequirementInput, PrismFileRequirementItem, PrismFileRequirementsMatrix, UpdateFileRequirementInput, UpsertFileRequirementTemplateInput } from "@prism/types";
import { eventApi } from "@/lib/prism-api";

export const fileRequirementsMatrixRepository = {
  load(eventId: string): Promise<PrismFileRequirementsMatrix> {
    return eventApi.events.fileRequirements(eventId);
  },
  create(eventId: string, input: CreateFileRequirementInput): Promise<PrismFileRequirementItem> {
    return eventApi.events.createFileRequirement(eventId, input);
  },
  update(eventId: string, key: string, input: UpdateFileRequirementInput): Promise<PrismFileRequirementItem> {
    return eventApi.events.updateFileRequirement(eventId, key, input);
  },
  sendReminders(eventId: string) {
    return eventApi.events.sendFileRequirementReminders(eventId);
  },
  listTemplates() { return eventApi.events.listFileRequirementTemplates(); },
  saveTemplate(input: UpsertFileRequirementTemplateInput) { return eventApi.events.upsertFileRequirementTemplate(input); },
  applyTemplate(eventId: string) { return eventApi.events.applyFileRequirementTemplate(eventId); },
};
