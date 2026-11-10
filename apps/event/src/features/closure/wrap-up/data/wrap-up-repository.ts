import type { PrismEventWrapUp, StartEventWrapUpInput, UpdateEventWrapUpInput } from "@prism/types";
import { eventApi } from "@/lib/prism-api";

export const wrapUpRepository = {
  get(eventId: string): Promise<PrismEventWrapUp | null> {
    return eventApi.closure.wrapUp(eventId);
  },
  start(eventId: string, input: StartEventWrapUpInput): Promise<PrismEventWrapUp> {
    return eventApi.closure.startWrapUp(eventId, input);
  },
  update(eventId: string, input: UpdateEventWrapUpInput): Promise<PrismEventWrapUp> {
    return eventApi.closure.updateWrapUp(eventId, input);
  },
};
