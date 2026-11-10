import {
  type ChangeSupplierTierInput,
  type CreateSupplierCertificationInput,
  type CreateSupplierInput,
  type CreateSupplierReliabilityNoteInput,
  type CreateSupplierReviewInput,
  type PromoteSupplierInput,
  type UpdateSupplierInput,
} from "@prism/types";
import { eventApi } from "@/lib/prism-api";

export const supplierDirectoryCommands = {
  create(input: CreateSupplierInput) {
    return eventApi.commercial.createSupplier(input);
  },
  update(supplierId: string, input: UpdateSupplierInput) {
    return eventApi.commercial.updateSupplier(supplierId, input);
  },
  changeTier(supplierId: string, input: ChangeSupplierTierInput) {
    return eventApi.commercial.changeSupplierTier(supplierId, input);
  },
  review(supplierId: string, input: CreateSupplierReviewInput) {
    return eventApi.commercial.addSupplierReview(supplierId, input);
  },
  reliabilityNote(supplierId: string, input: CreateSupplierReliabilityNoteInput) {
    return eventApi.commercial.addSupplierReliabilityNote(supplierId, input);
  },
  promote(supplierId: string, input: PromoteSupplierInput) {
    return eventApi.commercial.promoteSupplier(supplierId, input);
  },
  certification(supplierId: string, input: CreateSupplierCertificationInput) {
    return eventApi.commercial.addSupplierCertification(supplierId, input);
  },
};
