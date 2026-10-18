import { BadRequestException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { describe, expect, it, vi } from 'vitest';
import type { PrismTransactionContext } from '@prism/kernel/shared-kernel';
import { SuppliersService } from './suppliers.service';

const eventReferences = {
  findOperationsEvents: async () => [],
} as any;
const commercialFacts = {
  findSupplierReviewEventEligibility: vi.fn(async (_eventId: string, client?: any) =>
    client ? client.opsEvent.findUnique({ where: { id: _eventId } }) : { id: _eventId, status: 'closed', actualEndedAt: new Date('2026-01-02') }),
} as any;

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

    const service = new SuppliersService(prisma as any, eventReferences, commercialFacts);
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

    const service = new SuppliersService(prisma as any, eventReferences, commercialFacts);

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
        findFirst: async () => null,
        create: async (args: any) => {
          createCalls.push(args);
          return { id: args.data.id };
        },
      },
    };

    const service = new SuppliersService(prisma as any, eventReferences, commercialFacts);
    const result = await service.addSupplierReview('sup_1', {
      rating: 5,
      eventId: 'evt_1', notes: 'Great work',
      dimensionRatings: [{ dimensionId: 'dim_quality', rating: 4 }],
    }, 'Reviewer One');

    expect(createCalls).toHaveLength(1);
    expect(createCalls[0].data.reviewedBy).toBe('Reviewer One');
    expect(createCalls[0].data.dimensionRatings.create).toEqual([
      expect.objectContaining({ dimensionId: 'dim_quality', rating: 4 }),
    ]);
    expect(result.reviewId).toBeTruthy();
  });

  it('uses the transaction client for eligibility, dimensions, persistence, and result reads', async () => {
    const rootEvent = async () => { throw new Error('root client must not be used'); };
    const findEligibility = vi.fn(async (_eventId: string, client: any) => client.opsEvent.findUnique({ where: { id: _eventId } }));
    const facts = { ...commercialFacts, findSupplierReviewEventEligibility: findEligibility };
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
    const service = new SuppliersService(root as never, eventReferences, facts);

    const result = await service.addSupplierReview('sup_1', { eventId: 'evt_1', rating: 5, notes: 'Tx' }, 'Reviewer Two', {
      prisma: tx as never,
      correlationId: 'test',
    } satisfies PrismTransactionContext);

    expect(result.reviewId).toMatch(/^review_/);
    expect(findEligibility).toHaveBeenCalledWith('evt_1', tx);
  });

  it('replays a completed supplier promotion after the supplier tier changes', async () => {
    const supplier = { ...baseSupplierRow(), tier: 'pending_first_event' };
    const promotions = new Map<string, any>();
    const updateTier = vi.fn(async ({ data }: any) => {
      if (supplier.tier !== 'pending_first_event') return { count: 0 };
      supplier.tier = data.tier;
      return { count: 1 };
    });
    const createPromotion = vi.fn(async ({ data }: any) => {
      promotions.set(data.idempotencyKey, data);
      return data;
    });
    const prisma = {
      opsEvent: { findUnique: async () => ({ eventDate: new Date('2026-01-01'), status: 'closed', actualEndedAt: new Date('2026-01-02') }) },
      opsSupplierQuoteRequest: { findFirst: async () => ({ id: 'req_1' }) },
      opsSupplier: { findUnique: async () => supplier, updateMany: updateTier },
      opsSupplierReview: { findFirst: async () => ({ id: 'review_1' }) },
      opsSupplierPromotion: {
        findUnique: async ({ where }: any) => promotions.get(where.idempotencyKey) ?? null,
        create: createPromotion,
      },
    };
    const service = new SuppliersService(prisma as never, eventReferences, commercialFacts);
    const input = { eventId: 'evt_1', tier: 'tier_1' as const, reason: 'Completed assessment', idempotencyKey: 'promotion-key-1' };

    const first = await service.promoteSupplier('sup_1', input, 'Verified Reviewer');
    const retry = await service.promoteSupplier('sup_1', input, 'Verified Reviewer');

    expect(first.supplier.id).toBe('sup_1');
    expect(retry.supplier.id).toBe('sup_1');
    expect(first.replayed).toBe(false);
    expect(retry.replayed).toBe(true);
    expect(updateTier).toHaveBeenCalledTimes(1);
    expect(createPromotion).toHaveBeenCalledTimes(1);
  });
  it('maps an existing review with no dimension ratings back without error', () => {
    const service = new SuppliersService({} as any, eventReferences, commercialFacts);
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
        findFirst: async () => ({ id: 'review_existing', supplierId: 'sup_1', eventId: 'evt_1', rating: 5, notes: 'Retry', reviewedBy: 'Reviewer Three', idempotencyKey: 'draft-key-1' }),
      },
    };

    const service = new SuppliersService(prisma as any, eventReferences, commercialFacts);
    const result = await service.addSupplierReview('sup_1', {
      eventId: 'evt_1', rating: 5,
      notes: 'Retry',
      idempotencyKey: 'draft-key-1',
    }, 'Retrying Reviewer');

    expect(result.reviewId).toBe('review_existing');
  });

  it('rejects a second assessment for the same supplier and event under a different key', async () => {
    const create = vi.fn();
    const prisma = {
      opsSupplier: { findUnique: async () => baseSupplierRow() },
      opsEvent: { findUnique: async () => ({ eventDate: new Date('2026-01-01'), status: 'closed' }) },
      opsSupplierQuoteRequest: { findFirst: async () => ({ id: 'req_1' }) },
      opsSupplierReview: {
        findFirst: async () => ({ id: 'review_first', idempotencyKey: 'first-key' }),
        create,
      },
    };

    const service = new SuppliersService(prisma as any, eventReferences, commercialFacts);
    await expect(service.addSupplierReview('sup_1', {
      eventId: 'evt_1', rating: 3, notes: 'Second pass', idempotencyKey: 'second-key',
    }, 'Reviewer Two')).rejects.toBeInstanceOf(BadRequestException);
    await expect(service.addSupplierReview('sup_1', {
      eventId: 'evt_1', rating: 3, notes: 'Second pass',
    }, 'Reviewer Two')).rejects.toBeInstanceOf(BadRequestException);
    expect(create).not.toHaveBeenCalled();
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
        findFirst: async (args: { where: { idempotencyKey?: string } }) => {
          if (args.where.idempotencyKey) throw new Error('should not be called: this P2002 does not name the idempotency key');
          return null;
        },
      },
    };

    const service = new SuppliersService(prisma as any, eventReferences, commercialFacts);

    await expect(
        service.addSupplierReview('sup_1', { eventId: 'evt_1', rating: 5, notes: 'Retry', idempotencyKey: 'draft-key-1' }, 'Reviewer Four'),
    ).rejects.toBe(error);
  });
});
