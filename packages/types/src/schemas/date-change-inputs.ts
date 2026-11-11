import { z } from "zod";

/**
 * What moving an event's date touches. The impact is read-only: it never changes a supplier booking, a payment
 * milestone or anything the client approved. Only the event's own plan can follow the date, and only through an explicit
 * apply that presents the preview it was shown.
 */

const dateKeySchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use a date like 2026-12-20").refine((value) => {
  const parsed = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}, "Must be a real date");

/** Without a date, the impact is of the date the event has now (after a postponement was recorded). */
export const dateChangeImpactQuerySchema = z.object({
  newDate: dateKeySchema.optional(),
}).strict();
export type DateChangeImpactQuery = z.infer<typeof dateChangeImpactQuerySchema>;

/** One previewed template of the plan to bring in step with the event date: its pinned version and the token it was shown with. */
export const syncEventPlanTemplateSchema = z.object({
  templateId: z.string().trim().min(1).max(200),
  version: z.number().int().min(1),
  previewToken: z.string().trim().min(8).max(128),
}).strict();

/** Move the plan's open tasks to follow the event date. Every template is checked and applied together, or none is. */
export const syncEventPlanSchema = z.object({
  templates: z.array(syncEventPlanTemplateSchema).min(1).max(20),
}).strict();
export type SyncEventPlanInput = z.infer<typeof syncEventPlanSchema>;
