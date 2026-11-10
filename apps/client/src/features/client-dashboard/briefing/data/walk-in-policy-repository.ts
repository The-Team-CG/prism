import type { UpdateWalkInPolicyInput, WalkInPolicy } from "@prism/types";
import { clientApi } from "@/lib/prism-api";

export type WalkInPolicyRead = { eventId: string; policy: WalkInPolicy; threshold: number };

export const walkInPolicyRepository = {
  get: (eventId: string): Promise<WalkInPolicyRead> => clientApi.guest.walkInPolicy(eventId),
  update: (eventId: string, input: UpdateWalkInPolicyInput): Promise<WalkInPolicyRead> => clientApi.guest.updateWalkInPolicy(eventId, input),
};
