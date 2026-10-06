import { Injectable } from '@nestjs/common';
import { PrismaService } from '@prism/kernel/database';
import type { Prisma } from '@prisma/client';
import type { CommercialFactsReader, ReadClient } from '../../contracts/ports/commercial-facts-reader.port';

@Injectable()
export class CommercialFactsReaderService implements CommercialFactsReader {
  constructor(private readonly prisma: PrismaService) {}

  findSupplierReviewEventEligibility(eventId: string, client: ReadClient = this.prisma) {
    return client.opsEvent.findUnique({ where: { id: eventId }, select: { id: true, status: true, actualEndedAt: true } });
  }

  findProposalReviewEvent(eventId: string, client: ReadClient = this.prisma) {
    return client.opsEvent.findUnique({ where: { id: eventId }, include: { inquiry: { select: { email: true } } } });
  }

  findProposalReviewAudit(eventId: string, idempotencyKey: string, client: Prisma.TransactionClient) {
    return client.opsAuditLog.findFirst({
      where: { eventId, affectedType: 'proposal_client_review', affectedId: idempotencyKey },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      select: { metadata: true },
    });
  }

  listProposalReviewAudits(eventId: string, client: Prisma.TransactionClient) {
    return client.opsAuditLog.findMany({
      where: { eventId, affectedType: 'proposal_client_review' },
      select: { metadata: true },
    });
  }

  async getLifecycleFacts(eventId: string, client: ReadClient = this.prisma) {
    const [supplierQuoteRequests, billingSources, supplierReviews, billingStatements, paymentMilestones] = await Promise.all([
      client.opsSupplierQuoteRequest.findMany({ where: { eventId }, select: { id: true, supplierName: true, assignmentStatus: true, readinessStatus: true } }),
      client.opsBillingSource.findMany({ where: { eventId }, select: { id: true, status: true } }),
      client.opsSupplierReview.findMany({ where: { eventId }, select: { id: true, supplierId: true, rating: true, notes: true, reviewedBy: true } }),
      client.opsBillingStatement.findMany({ where: { eventId }, select: { id: true, totalAmount: true } }),
      client.opsPaymentMilestone.findMany({ where: { eventId }, select: { id: true, amountPaid: true, remainingBalance: true } }),
    ]);
    return { supplierQuoteRequests, billingSources, supplierReviews, billingStatements, paymentMilestones };
  }
}
