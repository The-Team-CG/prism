import { BadRequestException } from '@nestjs/common';
import { describe, expect, it } from 'vitest';
import { SuppliersService } from './suppliers.service';

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
});
