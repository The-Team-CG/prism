import type { UpdateWalkInPolicyInput, WalkInPolicy } from "@prism/types";
import { clientApiRequest } from "@/lib/prism-api";

export type WalkInPolicyRead = { eventId: string; policy: WalkInPolicy; threshold: number };

export const walkInPolicyRepository = {
  get: (eventId: string) => clientApiRequest<WalkInPolicyRead>(`/events/${eventId}/walk-in-policy`),
  update: (eventId: string, input: UpdateWalkInPolicyInput) => clientApiRequest<WalkInPolicyRead>(`/events/${eventId}/walk-in-policy`, { method: "PATCH", body: input }),
};
