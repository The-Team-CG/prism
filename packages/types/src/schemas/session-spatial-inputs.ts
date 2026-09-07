import { z } from "zod";

export const supplierWithdrawalSchema = z.object({
  reason: z.string().trim().min(1).max(500).optional(),
});
export type SupplierWithdrawalInput = z.infer<typeof supplierWithdrawalSchema>;
