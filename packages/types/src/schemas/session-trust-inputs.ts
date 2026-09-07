import { z } from "zod";
import { optionalTrimmedStringSchema } from "./common.js";

export const executePrivacyRequestSchema = z.object({
  executionNotes: optionalTrimmedStringSchema,
});
export type ExecutePrivacyRequestInput = z.infer<typeof executePrivacyRequestSchema>;

export const aiGovernanceDryRunSchema = z.object({
  eventId: optionalTrimmedStringSchema,
  featureName: z.string().trim().min(1),
  modelVersion: z.string().trim().min(1),
  zdrConfirmed: z.boolean(),
  payload: z.record(z.string(), z.unknown()),
});
export type AiGovernanceDryRunInput = z.infer<typeof aiGovernanceDryRunSchema>;
