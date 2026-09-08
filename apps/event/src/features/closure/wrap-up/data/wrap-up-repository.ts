import type { PrismEventWrapUp, StartEventWrapUpInput, UpdateEventWrapUpInput } from "@prism/types";
import { prismApi } from "@/lib/prism-api";

export const wrapUpRepository = {
  get(eventId: string): Promise<PrismEventWrapUp | null> { return prismApi.getEventWrapUp(eventId); },
  start(eventId: string, input: StartEventWrapUpInput): Promise<PrismEventWrapUp> { return prismApi.startEventWrapUp(eventId, input); },
  update(eventId: string, input: UpdateEventWrapUpInput): Promise<PrismEventWrapUp> { return prismApi.updateEventWrapUp(eventId, input); },
};
