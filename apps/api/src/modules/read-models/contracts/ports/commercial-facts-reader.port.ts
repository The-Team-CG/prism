import type { OpsAuditLog, OpsEvent, OpsInquiry, Prisma, PrismaClient } from '@prisma/client';
import type { PrismSupplierGap } from '@prism/types';

export type SupplierReviewEventEligibility = Pick<OpsEvent, 'id' | 'status' | 'actualEndedAt'>;
export type ProposalReviewEvent = OpsEvent & { inquiry: Pick<OpsInquiry, 'email'> };
export type ProposalReviewAudit = Pick<OpsAuditLog, 'metadata'>;
export type ReadClient = PrismaClient | Prisma.TransactionClient;
export type LifecycleCommercialFacts = {
  supplierQuoteRequests: Array<{ id: string; supplierName: string; assignmentStatus: string; readinessStatus: string; eventDayStatus: string }>;
  billingSources: Array<{ id: string; status: string }>;
  supplierReviews: Array<{ id: string; supplierId: string; rating: number; notes: string; reviewedBy: string }>;
  billingStatements: Array<{ id: string; totalAmount: number }>;
  paymentMilestones: Array<{ id: string; amountPaid: number; remainingBalance: number }>;
};

/** Read-only cross-domain facts used by Commercial commands, with caller transaction forwarding. */
export interface CommercialFactsReader {
  findSupplierReviewEventEligibility(eventId: string, client?: ReadClient): Promise<SupplierReviewEventEligibility | null>;
  findProposalReviewEvent(eventId: string, client?: ReadClient): Promise<ProposalReviewEvent | null>;
  findProposalReviewAudit(eventId: string, idempotencyKey: string, client: Prisma.TransactionClient): Promise<ProposalReviewAudit | null>;
  listProposalReviewAudits(eventId: string, client: Prisma.TransactionClient): Promise<ProposalReviewAudit[]>;
  getLifecycleFacts(eventId: string, client?: ReadClient): Promise<LifecycleCommercialFacts>;
  /** FR-63: per requested category, whether a Tier 1 or Tier 2 supplier is free on the event date. */
  listSupplierGaps(eventId: string, client?: ReadClient): Promise<PrismSupplierGap[]>;
}

export const COMMERCIAL_FACTS_READER = Symbol('COMMERCIAL_FACTS_READER');
