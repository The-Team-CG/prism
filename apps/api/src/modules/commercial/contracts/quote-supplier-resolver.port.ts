import type { OpsSupplier, OpsSupplierCategory, OpsSupplierCertification, OpsSupplierReliabilityNote, OpsSupplierReview } from '@prisma/client';
import type { AddSupplierQuoteInput } from '@prism/types';
import type { OperationsEventReference } from '@prism/contexts/event-lifecycle/operations-reference';

export type QuoteSupplierProfile = OpsSupplier & {
  category: OpsSupplierCategory;
  reviews: Array<OpsSupplierReview & { event: OperationsEventReference | null }>;
  reliabilityNotes: Array<OpsSupplierReliabilityNote & { event: Pick<OperationsEventReference, 'id' | 'eventName'> | null }>;
  certifications: OpsSupplierCertification[];
};

export interface QuoteSupplierResolver {
  resolveQuoteSupplier(input: AddSupplierQuoteInput): Promise<QuoteSupplierProfile | null>;
}
