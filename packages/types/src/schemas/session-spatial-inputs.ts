import { z } from "zod";
import { floorplanSceneDocumentSchema } from "./floorplan-scene.js";

export const supplierWithdrawalSchema = z.object({
  reason: z.string().trim().min(1).max(500).optional(),
});
export type SupplierWithdrawalInput = z.infer<typeof supplierWithdrawalSchema>;
export const createEventFromTemplateSchema = z.object({ templateId: z.string().trim().min(1), name: z.string().trim().min(2).max(120), startsAt: z.string().datetime() });
export type CreateEventFromTemplateInput = z.infer<typeof createEventFromTemplateSchema>;
const templateFields = { name: z.string().trim().min(2).max(120), description: z.string().trim().max(400).optional(), venue: z.string().trim().max(160).optional(), venueRules: z.string().trim().max(2000).optional(), pax: z.number().int().nonnegative().optional(), scene: floorplanSceneDocumentSchema, sourceType: z.string().trim().max(40).optional() };
export const createTemplateSchema = z.object(templateFields);
export type CreateTemplateInput = z.infer<typeof createTemplateSchema>;
export const updateTemplateSchema = z.object(templateFields).partial();
export type UpdateTemplateInput = z.infer<typeof updateTemplateSchema>;
/** A plan save changes its scene; the Pascal editor is the only writer of a plan's layout. */
export const updatePlanSchema = z.object({ expectedUpdatedAt: z.string().datetime(), venue: z.string().optional(), width: z.number().positive().optional(), height: z.number().positive().optional(), gridSize: z.number().positive().optional(), pax: z.number().int().nonnegative().optional(), scene: floorplanSceneDocumentSchema.optional() });
export type UpdatePlanInput = z.infer<typeof updatePlanSchema>;
