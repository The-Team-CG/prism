import type { OpsEvent, OpsSupplier, OpsSupplierCategory, OpsSupplierCertification, OpsSupplierReliabilityNote, OpsSupplierReview } from '@prisma/client';
import type { AddSupplierQuoteInput } from './commercial-workflow-commands.port';

export type QuoteSupplierProfile = OpsSupplier & {
  category: OpsSupplierCategory;
  reviews: Array<OpsSupplierReview & { event: OpsEvent | null }>;
  reliabilityNotes: Array<OpsSupplierReliabilityNote & { event: OpsEvent | null }>;
  certifications: OpsSupplierCertification[];
};

export interface QuoteSupplierResolver {
  resolveQuoteSupplier(input: AddSupplierQuoteInput): Promise<QuoteSupplierProfile | null>;
}