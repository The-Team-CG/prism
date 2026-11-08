import { Injectable } from '@nestjs/common';
import { PrismaService } from '@prism/kernel/database';
import type { Prisma } from '@prisma/client';
import type { PrismSupplierGap } from '@prism/types';
import type { CommercialFactsReader, ReadClient } from '../../contracts/ports/commercial-facts-reader.port';
import { supplierGapsFrom } from './supplier-gap.rules';

@Injectable()
export class CommercialFactsReaderService implements CommercialFactsReader {
  constructor(private readonly prisma: PrismaService) {}

  findSupplierReviewEventEligibility(eventId: string, client: ReadClient = this.prisma) {
    return client.opsEvent.findUnique({ where: { id: eventId }, select: { id: true, status: true, actualEndedAt: true } });
  }

  async listSupplierGaps(eventId: string, client: ReadClient = this.prisma): Promise<PrismSupplierGap[]> {
    const event = await client.opsEvent.findUnique({ where: { id: eventId }, select: { eventDate: true } });
    if (!event) return [];
    // QUERY_AUDIT_ALLOW_UNBOUNDED: one event's quote requests; bounded by the categories PMCM requested.
    const requests = await client.opsSupplierQuoteRequest.findMany({
      where: { eventId, categoryId: { not: null }, status: { notIn: ['closed', 'expired'] } },
      select: { categoryId: true, status: true, category: true },
    });
    const categoryIds = [...new Set(requests.map((request) => request.categoryId).filter((id): id is string => Boolean(id)))];
    if (categoryIds.length === 0) return [];
    // QUERY_AUDIT_ALLOW_UNBOUNDED: events held on one calendar date.
    const sameDayEvents = await client.opsEvent.findMany({ where: { eventDate: event.eventDate }, select: { id: true } });
    const [categories, suppliers, acknowledgements, bookings] = await Promise.all([
      client.opsSupplierCategory.findMany({ where: { id: { in: categoryIds } }, select: { id: true, name: true } }),
      // QUERY_AUDIT_ALLOW_UNBOUNDED: Tier 1 and Tier 2 suppliers of the requested categories only.
      client.opsSupplier.findMany({
        where: { categoryId: { in: categoryIds }, tier: { in: ['tier_1', 'tier_2'] } },
        select: { id: true, categoryId: true, tier: true, availability: { where: { availableOn: event.eventDate }, select: { blocked: true, capacity: true } } },
      }),
      client.opsSupplierGapAcknowledgement.findMany({ where: { eventId, categoryId: { in: categoryIds } } }),
      // QUERY_AUDIT_ALLOW_UNBOUNDED: selected bookings on one date, grouped per supplier.
      client.opsSupplierQuoteRequest.groupBy({
        by: ['supplierId'],
        where: { status: 'selected', assignmentStatus: { in: ['pending_confirmation', 'confirmed'] }, supplierId: { not: null }, eventId: { in: sameDayEvents.map((item) => item.id) } },
        _count: { _all: true },
      }),
    ]);
    const bookingsBySupplier = new Map(bookings.map((row) => [row.supplierId, row._count._all]));
    const covered = new Set(requests.filter((request) => request.status === 'selected').map((request) => request.categoryId));
    return supplierGapsFrom({
      eventDate: event.eventDate.toISOString().slice(0, 10),
      categories: categories.map((category) => ({ id: category.id, name: category.name, coveredByThisEvent: covered.has(category.id) })),
      suppliers: suppliers.map((supplier) => ({
        id: supplier.id,
        categoryId: supplier.categoryId,
        tier: supplier.tier,
        availability: supplier.availability[0] ?? null,
        bookingsOnDate: bookingsBySupplier.get(supplier.id) ?? 0,
      })),
      acknowledgements: new Map(acknowledgements.map((row) => [row.categoryId, { reason: row.reason, acknowledgedBy: row.acknowledgedBy, acknowledgedAt: row.acknowledgedAt.toISOString() }])),
    });
  }

  async getCancellationFacts(eventId: string, client: ReadClient = this.prisma) {
    const [proposal, paid, committed] = await Promise.all([
      client.opsProposalVersion.findFirst({ where: { eventId, status: 'issued' }, orderBy: { versionNumber: 'desc' }, select: { totalAmount: true } }),
      client.opsPaymentMilestone.aggregate({ where: { eventId, supersededAt: null }, _sum: { amountPaid: true } }),
      client.opsSupplierQuote.aggregate({ where: { eventId, status: 'selected' }, _sum: { amount: true } }),
    ]);
    return {
      contractAmount: proposal?.totalAmount ?? 0,
      paidAmount: paid._sum.amountPaid ?? 0,
      committedSupplierAmount: committed._sum.amount ?? 0,
    };
  }

  async topReviewedSuppliers(eventId: string, client: ReadClient = this.prisma) {
    // QUERY_AUDIT_ALLOW_UNBOUNDED: one event's supplier assessments, at most one per supplier.
    const reviews = await client.opsSupplierReview.findMany({ where: { eventId }, select: { rating: true, supplier: { select: { name: true, category: { select: { name: true } } } } } });
    const best = new Map<string, { category: string; supplierName: string; rating: number }>();
    for (const review of reviews) {
      const category = review.supplier.category.name;
      const current = best.get(category);
      if (!current || review.rating > current.rating) best.set(category, { category, supplierName: review.supplier.name, rating: review.rating });
    }
    return [...best.values()].sort((left, right) => left.category.localeCompare(right.category));
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
      client.opsSupplierQuoteRequest.findMany({ where: { eventId }, select: { id: true, supplierName: true, assignmentStatus: true, readinessStatus: true, eventDayStatus: true } }),
      client.opsBillingSource.findMany({ where: { eventId }, select: { id: true, status: true } }),
      client.opsSupplierReview.findMany({ where: { eventId }, select: { id: true, supplierId: true, rating: true, notes: true, reviewedBy: true } }),
      client.opsBillingStatement.findMany({ where: { eventId }, select: { id: true, totalAmount: true } }),
      client.opsPaymentMilestone.findMany({ where: { eventId, supersededAt: null }, select: { id: true, amountPaid: true, remainingBalance: true } }),
    ]);
    return { supplierQuoteRequests, billingSources, supplierReviews, billingStatements, paymentMilestones };
  }
}
