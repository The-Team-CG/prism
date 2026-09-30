import { eventApi as eventOpsClient, eventApiRequest as request } from "@/lib/prism-api";

export const sampleCommands = {
reset: () => eventOpsClient.sample.reset(),
};
