import { z } from "zod";

export const startEventDaySchema = z.object({}).strict().default({});
export const startEventDayResultSchema = z.object({ eventId: z.string().min(1), status: z.literal("event_day") });
export type StartEventDayResult = z.infer<typeof startEventDayResultSchema>;
