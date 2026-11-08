import type { CreateAccreditationRequirementInput, PrismAccreditationRequirement, UpdateAccreditationRequirementInput } from "@prism/types";
import { eventApiRequest } from "@/lib/prism-api";

const base = (eventId: string) => `/api/events/${eventId}/accreditation`;

export const accreditationRepository = {
  list: (eventId: string) => eventApiRequest<PrismAccreditationRequirement[]>(base(eventId)),
  create: (eventId: string, input: CreateAccreditationRequirementInput) => eventApiRequest<PrismAccreditationRequirement>(base(eventId), { method: "POST", body: input }),
  update: (eventId: string, id: string, input: UpdateAccreditationRequirementInput) => eventApiRequest<PrismAccreditationRequirement>(`${base(eventId)}/${id}`, { method: "PATCH", body: input }),
};
