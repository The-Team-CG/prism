import type { CreateAccreditationRequirementInput, UpdateAccreditationRequirementInput } from "@prism/types";
import { eventApi } from "@/lib/prism-api";

export const accreditationRepository = {
  list: (eventId: string) => eventApi.compliance.accreditationRequirements(eventId),
  create: (eventId: string, input: CreateAccreditationRequirementInput) => eventApi.compliance.createAccreditationRequirement(eventId, input),
  update: (eventId: string, id: string, input: UpdateAccreditationRequirementInput) => eventApi.compliance.updateAccreditationRequirement(eventId, id, input),
};
