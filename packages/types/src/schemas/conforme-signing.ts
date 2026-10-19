import { z } from 'zod';

export const createConformeExecutionSchema = z.object({
  templateVersion: z.number().int().positive(),
  templateContent: z.string().trim().min(20).max(50_000),
});
export type CreateConformeExecutionInput = z.infer<typeof createConformeExecutionSchema>;

export const signConformeExecutionSchema = z.object({
  executionId: z.string().trim().min(1).max(128),
  templateVersion: z.number().int().positive(),
  documentSha256: z.string().regex(/^[a-f0-9]{64}$/i),
  consentAccepted: z.literal(true),
});
export type SignConformeExecutionInput = z.infer<typeof signConformeExecutionSchema>;

export const signAddendumConformeExecutionSchema = z.object({
  executionId: z.string().trim().min(1).max(128),
  versionNumber: z.number().int().positive(),
  documentSha256: z.string().regex(/^[a-f0-9]{64}$/i),
  consentAccepted: z.literal(true),
});
export type SignAddendumConformeExecutionInput = z.infer<typeof signAddendumConformeExecutionSchema>;
