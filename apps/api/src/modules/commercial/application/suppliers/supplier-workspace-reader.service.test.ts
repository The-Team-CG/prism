import { NotFoundException } from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SupplierWorkspaceReaderService } from './supplier-workspace-reader.service';

describe('SupplierWorkspaceReaderService', () => {
  beforeEach(() => {
    vi.useRealTimers();
  });

  it('keeps all-history rating totals independent from the bounded review page', async () => {
    const supplier = {
      id: 'sup_701', name: 'Northstar Catering', categoryId: 'cat_food', tier: 'tier_1', bniMember: true,
      contactName: 'Mara', email: 'mara@example.test', phone: '+63 900 111 2222', serviceInclusions: 'Meals',
      performanceNotes: 'Reliable', applicationDate: new Date('2025-01-01T00:00:00.000Z'),
      category: { name: 'Catering', slug: 'catering', reviewDimensions: [] },
    };
    const prisma = {
      opsSupplier: { findUnique: vi.fn(async () => ({ id: supplier.id })) },
      opsSupplierReview: {
        count: vi.fn(async () => 127),
        findMany: vi.fn(async () => [{
          id: 'review_1', rating: 5, notes: 'Excellent service', reviewedBy: 'Maxine', eventId: 'evt_1',
          createdAt: new Date('2026-09-20T08:00:00.000Z'), event: { eventName: 'Annual Summit' }, dimensionRatings: [],
        }]),
      },
    };
    const service = new SupplierWorkspaceReaderService(prisma as any, {} as any);

    const result = await service.listReviews('sup_701', { page: 0, pageSize: 25 });

    expect(result).toMatchObject({ totalCount: 127, page: 0, pageSize: 25, hasNextPage: true });
    expect(result.items).toHaveLength(1);
    expect(prisma.opsSupplierReview.findMany).toHaveBeenCalledWith(expect.objectContaining({ skip: 0, take: 25 }));
  });

  it('returns a focused profile with the selected period and actual active category dimensions', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-10-07T12:00:00.000Z'));
    const supplier = {
      id: 'sup_701', name: 'Northstar Catering', categoryId: 'cat_food', tier: 'tier_1', bniMember: true,
      contactName: 'Mara', email: 'mara@example.test', phone: '+63 900 111 2222', serviceInclusions: 'Meals',
      performanceNotes: 'Reliable', applicationDate: new Date('2025-01-01T00:00:00.000Z'),
      category: {
        name: 'Catering', slug: 'catering',
        reviewDimensions: [{ id: 'dim_quality', slug: 'quality', name: 'Food quality', sortOrder: 1, active: true }],
      },
    };
    const prisma = { opsSupplier: { findUnique: vi.fn(async () => supplier) } };
    const queries = {
      getProfileMetrics: vi.fn(async (_id, _categoryId, period, asOf) => ({
        rating: { average: 4.3, count: 127 }, lastReviewedAt: '2026-09-20T08:00:00.000Z',
        certifications: { rejected: 0, expired: 1, submitted: 0, verified: 2, unknown: 0, attention: 'expired' },
        scorecards: [{
          dimensionId: 'dim_quality', dimensionName: 'Food quality', average: 4.7, sampleCount: period === '30d' ? 2 : 119,
          latest: { rating: 5, reviewedBy: 'Maxine', createdAt: '2026-09-20T08:00:00.000Z' },
        }],
        capturedAsOf: asOf,
      })),
    };
    const service = new SupplierWorkspaceReaderService(prisma as any, queries as any);

    const result = await service.getProfile('sup_701', { period: '30d' });

    expect(result).toMatchObject({
      supplier: { id: 'sup_701', categoryName: 'Catering' },
      rating: { average: 4.3, count: 127 },
      certifications: { attention: 'expired' },
      reviewDimensions: [{ id: 'dim_quality', active: true }],
      scorecards: [{ dimensionId: 'dim_quality', sampleCount: 2 }],
      period: '30d',
      asOf: '2026-10-07T12:00:00.000Z',
    });
    expect(queries.getProfileMetrics).toHaveBeenCalledWith('sup_701', 'cat_food', '30d', new Date('2026-10-07T12:00:00.000Z'));
  });

  it('does not return a profile for a missing supplier', async () => {
    const prisma = { opsSupplier: { findUnique: vi.fn(async () => null) } };
    const queries = { getProfileMetrics: vi.fn() };
    const service = new SupplierWorkspaceReaderService(prisma as any, queries as any);

    await expect(service.getProfile('missing', { period: 'all' })).rejects.toBeInstanceOf(NotFoundException);
    expect(queries.getProfileMetrics).not.toHaveBeenCalled();
  });
});
