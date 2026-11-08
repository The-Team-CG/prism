import { z } from "zod";

/* FR-76 Supplier Unresponsive Escalation. */
export const SUPPLIER_RESPONSE_WINDOW_HOURS = 48;

export interface PrismUnresponsiveSupplier {
  requestId: string;
  supplierId: string | null;
  supplierName: string;
  supplierPhone: string;
  category: string;
  hoursWaiting: number;
  /** "first" after one response window; "second" after two, when Tier 2 is suggested. */
  window: "first" | "second";
  tier2Suggestions: Array<{ supplierId: string; supplierName: string }>;
  draftMessage: string;
}

/* FR-65 Client-Owned Supplier Sub-Ticket. */
export const createClientOwnedSupplierSchema = z.object({
  category: z.string().trim().min(1).max(120),
  supplierName: z.string().trim().min(1).max(200),
  contact: z.string().trim().max(200).default(""),
  operationalNotes: z.string().trim().max(2000).default(""),
}).strict();
export type CreateClientOwnedSupplierInput = z.input<typeof createClientOwnedSupplierSchema>;

export const raiseClientSupplierRiskSchema = z.object({
  warning: z.string().trim().min(1).max(1000),
}).strict();
export type RaiseClientSupplierRiskInput = z.infer<typeof raiseClientSupplierRiskSchema>;

export interface PrismClientOwnedSupplier {
  id: string;
  eventId: string;
  category: string;
  supplierName: string;
  contact: string;
  operationalNotes: string;
  status: "pending" | "confirmed";
  confirmedAt: string | null;
  riskWarning: string | null;
  riskRaisedBy: string | null;
  createdAt: string;
}

/* FR-AI-06 Probabilistic supplier reliability score: 0 to 100 with a 95% band. */
export interface PrismSupplierReliabilityScore {
  score: number;
  low: number;
  high: number;
  observations: number;
  factors: Array<{ factor: "onTime" | "noComplaints" | "responsive" | "contractAccuracy"; rate: number; observations: number }>;
}
