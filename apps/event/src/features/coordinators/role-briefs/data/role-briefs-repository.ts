import type { CoordinatorRole, UpsertCoordinatorRoleBriefInput } from "@prism/types";
import { eventApi } from "@/lib/prism-api";

export const roleBriefsRepository = {
  list: (eventId: string) => eventApi.coordinator.roleBriefs(eventId),
  save: (eventId: string, role: CoordinatorRole, input: UpsertCoordinatorRoleBriefInput) => eventApi.coordinator.saveRoleBrief(eventId, role, input),
};
