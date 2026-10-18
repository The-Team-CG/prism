import { z } from "zod";
import { optionalTrimmedStringSchema } from "./common.js";

/**
 * Explicit field patch for an approved correction request. Only the subject's own identity and contact fields
 * can be corrected; any other key is rejected by `.strict()`.
 */
export const privacyCorrectionPatchSchema = z
  .object({
    name: z.string().trim().min(1).max(200).optional(),
    email: z.string().trim().email().max(254).optional(),
  })
  .strict()
  .refine((patch) => patch.name !== undefined || patch.email !== undefined, {
    message: "Correction must change at least one identity or contact field",
  });
export type PrivacyCorrectionPatch = z.infer<typeof privacyCorrectionPatchSchema>;

export const executePrivacyRequestSchema = z.object({
  executionNotes: optionalTrimmedStringSchema,
  correction: privacyCorrectionPatchSchema.optional(),
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
