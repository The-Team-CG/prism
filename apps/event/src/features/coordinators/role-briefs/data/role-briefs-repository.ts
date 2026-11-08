import type { CoordinatorRole, PrismCoordinatorRoleBrief, UpsertCoordinatorRoleBriefInput } from "@prism/types";
import { eventApiRequest } from "@/lib/prism-api";

export const roleBriefsRepository = {
  list: (eventId: string) => eventApiRequest<PrismCoordinatorRoleBrief[]>(`/api/events/${eventId}/coordinator-role-briefs`),
  save: (eventId: string, role: CoordinatorRole, input: UpsertCoordinatorRoleBriefInput) =>
    eventApiRequest<PrismCoordinatorRoleBrief>(`/api/events/${eventId}/coordinator-role-briefs/${encodeURIComponent(role)}`, { method: "PUT", body: input }),
};
