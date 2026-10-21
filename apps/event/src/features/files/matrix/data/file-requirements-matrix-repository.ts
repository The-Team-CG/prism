import type { CreateFileRequirementInput, PrismFileRequirementItem, PrismFileRequirementsMatrix, UpdateFileRequirementInput } from "@prism/types";
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
};
