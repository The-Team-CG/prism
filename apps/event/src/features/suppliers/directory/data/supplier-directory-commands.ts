import {
  type ChangeSupplierTierInput,
  type CreateSupplierCertificationInput,
  type CreateSupplierInput,
  type CreateSupplierReliabilityNoteInput,
  type CreateSupplierReviewInput,
  type PromoteSupplierInput,
  type PrismSupplier,
  type UpdateSupplierInput,
} from "@prism/types";
import { eventApiRequest } from "@/lib/prism-api";

function supplierPath(supplierId: string, suffix = "") {
  return `/api/suppliers/${encodeURIComponent(supplierId)}${suffix}`;
}

export const supplierDirectoryCommands = {
  create(input: CreateSupplierInput) {
    return eventApiRequest<PrismSupplier>("/api/suppliers", { method: "POST", body: input });
  },
  update(supplierId: string, input: UpdateSupplierInput) {
    return eventApiRequest<PrismSupplier>(supplierPath(supplierId), { method: "PATCH", body: input });
  },
  changeTier(supplierId: string, input: ChangeSupplierTierInput) {
    return eventApiRequest<PrismSupplier>(supplierPath(supplierId, "/tier"), { method: "PATCH", body: input });
  },
  review(supplierId: string, input: CreateSupplierReviewInput) {
    return eventApiRequest<PrismSupplier>(supplierPath(supplierId, "/reviews"), { method: "POST", body: input });
  },
  reliabilityNote(supplierId: string, input: CreateSupplierReliabilityNoteInput) {
    return eventApiRequest<PrismSupplier>(supplierPath(supplierId, "/reliability-notes"), { method: "POST", body: input });
  },
  promote(supplierId: string, input: PromoteSupplierInput) {
    return eventApiRequest<PrismSupplier>(supplierPath(supplierId, "/promote"), { method: "POST", body: input });
  },
  certification(supplierId: string, input: CreateSupplierCertificationInput) {
    return eventApiRequest<PrismSupplier>(supplierPath(supplierId, "/certifications"), { method: "POST", body: input });
  },
};
