import { BadRequestException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { describe, expect, it } from 'vitest';
import type { PrismTransactionContext } from '@prism/kernel/shared-kernel';
import { SuppliersService } from './suppliers.service';

function makeP2002(target: string[] | string): unknown {
  const error = Object.create(Prisma.PrismaClientKnownRequestError.prototype);
  error.code = 'P2002';
  error.meta = { target };
  error.message = 'Unique constraint failed';
  return error;
}

function baseSupplierRow() {
  return {
    id: 'sup_1',
    name: 'Acme AV',
    categoryId: 'cat_prod',
    category: { id: 'cat_prod', name: 'Production', slug: 'production', sortOrder: 1, active: true },
    contactName: '',
    email: '',
    phone: '',
    tier: 'tier_1',
    bniMember: false,
    serviceInclusions: '',
    performanceNotes: '',
    applicationDate: new Date('2026-01-01'),
    reviews: [],
    reliabilityNotes: [],
    certifications: [],
  };
}

describe('SuppliersService', () => {
  it('auto-selects the Tier 1 supplier for a requested category', async () => {
    const prisma = {
      opsSupplierCategory: {
        findUnique: async () => ({ id: 'cat_av', name: 'Technicals' }),
      },
      opsSupplier: {
        findFirst: async () => ({ id: 'sup_tier_1' }),
        findUnique: async () => ({
          id: 'sup_tier_1',
          category: { id: 'cat_av', name: 'Technicals', slug: 'technicals', sortOrder: 1, active: true },
          reviews: [],
          reliabilityNotes: [],
          certifications: [],
        }),
      },
    };

    const service = new SuppliersService(prisma as any);
    const supplier = await service.resolveQuoteSupplier({ categoryId: 'cat_av' });

    if (!supplier) throw new Error('Expected tier 1 supplier to resolve');
    expect(supplier.id).toBe('sup_tier_1');
  });

  it('excludes pending-first-event suppliers from category auto-suggestion', async () => {
    const prisma = {
      opsSupplierCategory: {
        findUnique: async () => ({ id: 'cat_doc', name: 'Documentation' }),
      },
      opsSupplier: {
        findFirst: async () => null,
      },
    };

    const service = new SuppliersService(prisma as any);

    await expect(service.resolveQuoteSupplier({ categoryId: 'cat_doc' })).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('creates dimension ratings alongside a review when provided', async () => {
    const createCalls: any[] = [];
    const prisma = {
      opsSupplier: { findUnique: async () => baseSupplierRow() },
      opsEvent: { findUnique: async () => ({ eventDate: new Date('2026-01-01'), status: 'closed' }) },
      opsSupplierQuoteRequest: { findFirst: async () => ({ id: 'req_1' }) },
      opsSupplierReviewDimension: {
        findMany: async () => [{ id: 'dim_quality' }],
      },
      opsSupplierReview: {
        create: async (args: any) => {
          createCalls.push(args);
          return { id: args.data.id };
        },
      },
    };

    const service = new SuppliersService(prisma as any);
    const result = await service.addSupplierReview('sup_1', {
      rating: 5,
      eventId: 'evt_1', notes: 'Great work',
      dimensionRatings: [{ dimensionId: 'dim_quality', rating: 4 }],
    });

    expect(createCalls).toHaveLength(1);
    expect(createCalls[0].data.dimensionRatings.create).toEqual([
      expect.objectContaining({ dimensionId: 'dim_quality', rating: 4 }),
    ]);
    expect(result.reviewId).toBeTruthy();
  });

  it('uses the transaction client for eligibility, dimensions, persistence, and result reads', async () => {
    const rootEvent = async () => { throw new Error('root client must not be used'); };
    const rootDimensions = async () => { throw new Error('root client must not be used'); };
    const tx = {
      opsSupplier: { findUnique: async () => baseSupplierRow() },
      opsEvent: { findUnique: async () => ({ eventDate: new Date('2026-01-01'), status: 'closed' }) },
      opsSupplierQuoteRequest: { findFirst: async () => ({ id: 'req_1' }) },
      opsSupplierReviewDimension: { findMany: async () => [{ id: 'dim_quality' }] },
      opsSupplierReview: {
        create: async () => ({ id: 'review_tx' }),
      },
    };
    const root = {
      opsSupplier: { findUnique: async () => baseSupplierRow() },
      opsEvent: { findUnique: rootEvent },
      opsSupplierQuoteRequest: { findFirst: async () => ({ id: 'req_1' }) },
      opsSupplierReviewDimension: { findMany: rootDimensions },
      opsSupplierReview: { create: async () => ({ id: 'review_root' }) },
    };
    const service = new SuppliersService(root as never);

    const result = await service.addSupplierReview('sup_1', { eventId: 'evt_1', rating: 5, notes: 'Tx' }, {
      prisma: tx as never,
      correlationId: 'test',
    } satisfies PrismTransactionContext);

    expect(result.reviewId).toMatch(/^review_/);
  });

  it('maps an existing review with no dimension ratings back without error', () => {
    const service = new SuppliersService({} as any);
    const mapped = service.mapSupplier({
      id: 'sup_1',
      name: 'Acme AV',
      categoryId: 'cat_prod',
      category: { id: 'cat_prod', name: 'Production', slug: 'production' },
      contactName: '',
      email: '',
      phone: '',
      tier: 'tier_1',
      bniMember: false,
      serviceInclusions: '',
      performanceNotes: '',
      applicationDate: new Date('2026-01-01'),
      reviews: [
        {
          id: 'rev_1',
          rating: 5,
          notes: '',
          reviewedBy: 'PMCM Admin',
          eventId: null,
          event: null,
          createdAt: new Date('2026-01-02'),
          dimensionRatings: [],
        },
      ],
      reliabilityNotes: [],
      certifications: [],
    } as any);

    expect(mapped.reviews[0].dimensionRatings).toEqual([]);
    expect(mapped.aggregateRating).toBe(5);
  });

  it('returns the existing review when a retry raises a P2002 on the idempotency key', async () => {
    const prisma = {
      opsSupplier: { findUnique: async () => baseSupplierRow() },
      opsEvent: { findUnique: async () => ({ eventDate: new Date('2026-01-01'), status: 'closed' }) },
      opsSupplierQuoteRequest: { findFirst: async () => ({ id: 'req_1' }) },
      opsSupplierReview: {
        create: async () => {
          throw makeP2002(['idempotencyKey']);
        },
        findFirst: async () => ({ id: 'review_existing', supplierId: 'sup_1', eventId: 'evt_1', rating: 5, notes: 'Retry', reviewedBy: 'PMCM Admin' }),
      },
    };

    const service = new SuppliersService(prisma as any);
    const result = await service.addSupplierReview('sup_1', {
      eventId: 'evt_1', rating: 5,
      notes: 'Retry',
      idempotencyKey: 'draft-key-1',
    });

    expect(result.reviewId).toBe('review_existing');
  });

  it('rethrows a P2002 that does not name the idempotency key (e.g. a PK collision)', async () => {
    const error = makeP2002(['id']);
    const prisma = {
      opsSupplier: { findUnique: async () => baseSupplierRow() },
      opsEvent: { findUnique: async () => ({ eventDate: new Date('2026-01-01'), status: 'closed' }) },
      opsSupplierQuoteRequest: { findFirst: async () => ({ id: 'req_1' }) },
      opsSupplierReview: {
        create: async () => {
          throw error;
        },
        findFirst: async () => {
          throw new Error('should not be called: this P2002 does not name the idempotency key');
        },
      },
    };

    const service = new SuppliersService(prisma as any);

    await expect(
        service.addSupplierReview('sup_1', { eventId: 'evt_1', rating: 5, notes: 'Retry', idempotencyKey: 'draft-key-1' }),
    ).rejects.toBe(error);
  });
});
