import { eventApi as eventOpsClient } from "@/lib/prism-api";
import type { StartEventWrapUpInput, UpdateEventWrapUpInput } from "@prism/types";

export const closureCommands = {
closeGates: (eventId: string) => eventOpsClient.closure.closeGates(eventId),
eventInsights: (eventId: string) => eventOpsClient.closure.insights(eventId),
generateEventInsights: (eventId: string) => eventOpsClient.closure.generateInsights(eventId),
getEventWrapUp: (eventId: string) => eventOpsClient.closure.wrapUp(eventId),
startEventWrapUp: (eventId: string, input: StartEventWrapUpInput) => eventOpsClient.closure.startWrapUp(eventId, input),
updateEventWrapUp: (eventId: string, input: UpdateEventWrapUpInput) => eventOpsClient.closure.updateWrapUp(eventId, input),
};
