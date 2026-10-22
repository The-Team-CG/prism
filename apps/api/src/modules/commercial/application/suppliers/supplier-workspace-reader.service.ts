import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import type {
  PrismPmcmSupplierCertificationsPage,
  PrismPmcmSupplierDirectoryPage,
  PrismPmcmSupplierEngagementFactsPage,
  PrismPmcmSupplierProfile,
  PrismPmcmSupplierRecordsPage,
  PrismPmcmSupplierReviewsPage,
} from '@prism/types';
import type {
  PmcmSupplierDirectoryQuery,
  PmcmSupplierHistoryQuery,
  PmcmSupplierProfileQuery,
  PmcmSupplierRecordsQuery,
} from '@prism/types';
import { PrismaService } from '@prism/kernel/database';
import type { SupplierWorkspaceReader } from '../../contracts/supplier-workspace-reader.port';
import { SupplierWorkspaceQueries } from './supplier-workspace.queries';

const page = <T>(items: T[], totalCount: number, pageIndex: number, pageSize: number) => ({
  items,
  totalCount,
  page: pageIndex,
  pageSize,
  hasNextPage: (pageIndex + 1) * pageSize < totalCount,
});

function asIso(value: Date | null | undefined) {
  return value?.toISOString() ?? null;
}

@Injectable()
export class SupplierWorkspaceReaderService implements SupplierWorkspaceReader {
  constructor(
    private readonly prisma: PrismaService,
    private readonly queries: SupplierWorkspaceQueries,
  ) {}

  async listDirectory(query: PmcmSupplierDirectoryQuery): Promise<PrismPmcmSupplierDirectoryPage> {
    const asOf = new Date();
    const result = await this.queries.listDirectory(query, asOf);
    return { ...page(result.rows, result.totalCount, query.page, query.pageSize), query, asOf: asOf.toISOString() };
  }

  async getProfile(supplierId: string, query: PmcmSupplierProfileQuery): Promise<PrismPmcmSupplierProfile> {
    const supplier = await this.prisma.opsSupplier.findUnique({
      where: { id: supplierId },
      select: {
        id: true,
        name: true,
        categoryId: true,
        tier: true,
        bniMember: true,
        contactName: true,
        email: true,
        phone: true,
        serviceInclusions: true,
        performanceNotes: true,
        applicationDate: true,
        category: {
          select: {
            name: true,
            slug: true,
            reviewDimensions: {
              where: { active: true },
              orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }],
              select: { id: true, slug: true, name: true, sortOrder: true, active: true },
            },
          },
        },
      },
    });
    if (!supplier) throw new NotFoundException('Supplier not found');

    const asOf = new Date();
    const metrics = await this.queries.getProfileMetrics(supplierId, supplier.categoryId, query.period, asOf);
    return {
      supplier: {
        id: supplier.id,
        name: supplier.name,
        categoryId: supplier.categoryId,
        categoryName: supplier.category.name,
        categorySlug: supplier.category.slug,
        tier: supplier.tier,
        bniMember: supplier.bniMember,
        contactName: supplier.contactName,
        email: supplier.email,
        phone: supplier.phone,
        serviceInclusions: supplier.serviceInclusions,
        performanceNotes: supplier.performanceNotes,
        applicationDate: supplier.applicationDate.toISOString().slice(0, 10),
      },
      rating: metrics.rating,
      lastReviewedAt: metrics.lastReviewedAt,
      certifications: metrics.certifications,
      reviewDimensions: supplier.category.reviewDimensions,
      scorecards: metrics.scorecards,
      period: query.period,
      asOf: asOf.toISOString(),
    };
  }

  async listReviews(supplierId: string, query: PmcmSupplierHistoryQuery): Promise<PrismPmcmSupplierReviewsPage> {
    await this.requireSupplier(supplierId);
    const [totalCount, reviews] = await Promise.all([
      this.prisma.opsSupplierReview.count({ where: { supplierId } }),
      this.prisma.opsSupplierReview.findMany({
        where: { supplierId },
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        // QUERY_AUDIT_ALLOW_OFFSET: shared history schema caps pages at index 1000 and size 50.
        skip: query.page * query.pageSize,
        take: query.pageSize,
        select: {
          id: true,
          rating: true,
          notes: true,
          reviewedBy: true,
          eventId: true,
          createdAt: true,
          dimensionRatings: {
            select: { dimensionId: true, rating: true, dimension: { select: { name: true } } },
          },
        },
      }),
    ]);
    const eventIds = [...new Set(reviews.flatMap((review) => review.eventId ? [review.eventId] : []))];
    const events = eventIds.length
      ? await this.prisma.opsEvent.findMany({ where: { id: { in: eventIds } }, select: { id: true, eventName: true } })
      : [];
    const eventNames = new Map(events.map((event) => [event.id, event.eventName]));
    const items = reviews.map((review) => ({
      id: review.id,
      rating: review.rating,
      notes: review.notes,
      reviewedBy: review.reviewedBy,
      eventId: review.eventId,
      eventName: review.eventId ? eventNames.get(review.eventId) ?? null : null,
      createdAt: review.createdAt.toISOString(),
      dimensionRatings: review.dimensionRatings.map((rating) => ({
        dimensionId: rating.dimensionId,
        dimensionName: rating.dimension.name,
        rating: rating.rating,
      })),
    }));
    return page(items, totalCount, query.page, query.pageSize);
  }

  async listCertifications(supplierId: string, query: PmcmSupplierHistoryQuery): Promise<PrismPmcmSupplierCertificationsPage> {
    await this.requireSupplier(supplierId);
    const [totalCount, certifications] = await Promise.all([
      this.prisma.opsSupplierCertification.count({ where: { supplierId } }),
      this.prisma.opsSupplierCertification.findMany({
        where: { supplierId },
        orderBy: [{ uploadedAt: 'desc' }, { id: 'desc' }],
        // QUERY_AUDIT_ALLOW_OFFSET: shared history schema caps pages at index 1000 and size 50.
        skip: query.page * query.pageSize,
        take: query.pageSize,
        select: {
          id: true, fileName: true, documentType: true, issuer: true,
          expiresAt: true, status: true, notes: true, uploadedAt: true,
        },
      }),
    ]);
    const items = certifications.map((certification) => ({
      id: certification.id,
      fileName: certification.fileName,
      documentType: certification.documentType,
      issuer: certification.issuer,
      expiresAt: asIso(certification.expiresAt)?.slice(0, 10) ?? null,
      status: certification.status,
      notes: certification.notes,
      uploadedAt: certification.uploadedAt.toISOString(),
    }));
    return page(items, totalCount, query.page, query.pageSize);
  }

  async listRecords(supplierId: string, query: PmcmSupplierRecordsQuery): Promise<PrismPmcmSupplierRecordsPage> {
    await this.requireSupplier(supplierId);
    const asOf = new Date();
    const result = await this.queries.listRecords(supplierId, query, asOf);
    return {
      ...page(result.rows, result.totalCount, query.page, query.pageSize),
      period: query.period,
      asOf: asOf.toISOString(),
      chartStartDate: result.chartStartDate,
      chartEndDate: result.chartEndDate,
      counts: result.counts,
      dailyBuckets: result.dailyBuckets,
    };
  }

  async listEngagementFacts(supplierId: string, query: PmcmSupplierHistoryQuery): Promise<PrismPmcmSupplierEngagementFactsPage> {
    await this.requireSupplier(supplierId);
    const result = await this.queries.listEngagementFacts(supplierId, query);
    return { ...page(result.rows, result.totalCount, query.page, query.pageSize), supplierTier: result.supplierTier };
  }

  private async requireSupplier(supplierId: string) {
    const supplier = await this.prisma.opsSupplier.findUnique({ where: { id: supplierId }, select: { id: true } });
    if (!supplier) throw new NotFoundException('Supplier not found');
  }
}
