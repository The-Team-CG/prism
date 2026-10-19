import { z } from "zod";
import { floorPlanCanvasObjectSchema, floorPlanGuestSchema, floorPlanSupplierSchema } from "./floorplan-canvas-inputs.js";

export const supplierWithdrawalSchema = z.object({
  reason: z.string().trim().min(1).max(500).optional(),
});
export type SupplierWithdrawalInput = z.infer<typeof supplierWithdrawalSchema>;
const canvasObject = z.object({ id: z.string(), kind: z.enum(['table','chair','stage','led-wall','podium','lights-sounds','reg-desk','entrance-arch','photo-wall','photo-booth','signage','emergency-exit','wall','door','window','bar','booth','decor','label','custom-image']), label: z.string().optional(), position: z.object({ x: z.number(), y: z.number() }), size: z.object({ width: z.number(), height: z.number() }), rotation: z.number(), zIndex: z.number(), locked: z.boolean().optional(), svgMarkup: z.string().optional(), metadata: z.record(z.string(), z.union([z.string(), z.number(), z.boolean()])).optional() });
const canvasObjects = z.array(canvasObject).optional();
export const createEventFromTemplateSchema = z.object({ templateId: z.string().trim().min(1), name: z.string().trim().min(2).max(120), startsAt: z.string().datetime() });
export type CreateEventFromTemplateInput = z.infer<typeof createEventFromTemplateSchema>;
const templateFields = { name: z.string().trim().min(2).max(120), description: z.string().trim().max(400).optional(), venue: z.string().trim().max(160).optional(), venueRules: z.string().trim().max(2000).optional(), permanentFeatures: canvasObjects, objects: canvasObjects, width: z.number().int().positive().optional(), height: z.number().int().positive().optional(), gridSize: z.number().int().positive().optional(), pax: z.number().int().nonnegative().optional(), includeGuests: z.boolean().optional(), includeSuppliers: z.boolean().optional(), guests: canvasObjects, suppliers: canvasObjects, sourceType: z.string().trim().max(40).optional() };
export const createTemplateSchema = z.object(templateFields);
export type CreateTemplateInput = z.infer<typeof createTemplateSchema>;
export const updateTemplateSchema = z.object(templateFields).partial();
export type UpdateTemplateInput = z.infer<typeof updateTemplateSchema>;
const seat = z.object({ id: z.string(), label: z.string(), position: z.object({ x: z.number(), y: z.number() }), categoryId: z.string().nullable() });
const seatCategory = z.object({ id: z.string(), name: z.string(), colorHex: z.string() });
// Plan saves accept the floorplan editor shape; the legacy kernel shape stays accepted so plans saved before that alignment still save.
const planObjects = z.array(z.union([floorPlanCanvasObjectSchema, canvasObject])).optional();
const planGuests = z.array(z.union([floorPlanGuestSchema, canvasObject])).optional();
const planSuppliers = z.array(z.union([floorPlanSupplierSchema, canvasObject])).optional();
export const updatePlanSchema = z.object({ expectedUpdatedAt: z.string().datetime(), venue: z.string().optional(), width: z.number().positive().optional(), height: z.number().positive().optional(), gridSize: z.number().positive().optional(), pax: z.number().int().nonnegative().optional(), objects: planObjects, guests: planGuests, suppliers: planSuppliers, seats: z.array(seat).optional(), seatCategories: z.array(seatCategory).optional() });
export type UpdatePlanInput = z.infer<typeof updatePlanSchema>;
