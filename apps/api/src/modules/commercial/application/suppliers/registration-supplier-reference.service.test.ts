import { describe, expect, it, vi } from 'vitest';
import type { PrismTransactionContext } from '@prism/kernel/shared-kernel';
import { RegistrationSupplierReferenceService } from './registration-supplier-reference.service';

describe('RegistrationSupplierReferenceService', () => {
  it('returns only Commercial eligibility facts for an active selected registration supplier', async () => {
    const findUnique = vi.fn(async () => ({
      id: 'sup_1',
      categoryId: 'cat_1',
      category: { name: 'Digital Registration', slug: 'digital-registration', active: true },
    }));
    const findFirst = vi.fn(async () => ({ id: 'request_1' }));
    const service = new RegistrationSupplierReferenceService({
      opsSupplier: { findUnique },
      opsSupplierQuoteRequest: { findFirst },
    } as never);

    await expect(service.findRegistrationSupplier('evt_1', 'sup_1')).resolves.toEqual({
      id: 'sup_1',
      registrationCategory: true,
      categoryActive: true,
      selectedForEvent: true,
    });
    expect(findUnique).toHaveBeenCalledWith({
      where: { id: 'sup_1' },
      select: {
        id: true,
        categoryId: true,
        category: { select: { name: true, slug: true, active: true } },
      },
    });
    expect(findFirst).toHaveBeenCalledWith({
      where: { eventId: 'evt_1', supplierId: 'sup_1', status: 'selected' },
      select: { id: true },
    });
  });

  it('returns missing when the supplier owner has no record', async () => {
    const service = new RegistrationSupplierReferenceService({
      opsSupplier: { findUnique: vi.fn(async () => null) },
    } as never);

    await expect(service.findRegistrationSupplier('evt_1', 'missing')).resolves.toBeNull();
  });

  it('locks supplier, category, and selected assignment rows through the caller transaction', async () => {
    const queryRaw = vi.fn()
      .mockResolvedValueOnce([{ id: 'sup_1' }])
      .mockResolvedValueOnce([{ id: 'cat_1' }])
      .mockResolvedValueOnce([{ id: 'request_1' }]);
    const findUnique = vi.fn(async () => ({
      id: 'sup_1',
      categoryId: 'cat_1',
      category: { name: 'Digital Registration', slug: 'digital-registration', active: true },
    }));
    const service = new RegistrationSupplierReferenceService({} as never);
    const transaction = {
      prisma: {
        $queryRawUnsafe: queryRaw,
        opsSupplier: { findUnique },
      },
    } as unknown as PrismTransactionContext;

    await expect(service.findRegistrationSupplier('evt_1', 'sup_1', transaction)).resolves.toEqual({
      id: 'sup_1',
      registrationCategory: true,
      categoryActive: true,
      selectedForEvent: true,
    });
    expect(queryRaw).toHaveBeenNthCalledWith(
      1,
      'SELECT "id" FROM "commercial"."suppliers" WHERE "id" = $1 FOR UPDATE',
      'sup_1',
    );
    expect(queryRaw).toHaveBeenNthCalledWith(
      2,
      'SELECT "id" FROM "commercial"."supplier_categories" WHERE "id" = $1 FOR UPDATE',
      'cat_1',
    );
    expect(queryRaw).toHaveBeenNthCalledWith(
      3,
      'SELECT "id" FROM "commercial"."supplier_quote_requests" WHERE "event_id" = $1 AND "supplier_id" = $2 AND "status" = $3 ORDER BY "id" LIMIT 1 FOR UPDATE',
      'evt_1',
      'sup_1',
      'selected',
    );
  });

  it('fails closed when the selected quote row cannot be locked', async () => {
    const queryRaw = vi.fn()
      .mockResolvedValueOnce([{ id: 'sup_1' }])
      .mockResolvedValueOnce([{ id: 'cat_1' }])
      .mockResolvedValueOnce([]);
    const findUnique = vi.fn(async () => ({
      id: 'sup_1',
      categoryId: 'cat_1',
      category: { name: 'Registration', slug: 'registration', active: true },
    }));
    const service = new RegistrationSupplierReferenceService({} as never);
    const transaction = {
      prisma: { $queryRawUnsafe: queryRaw, opsSupplier: { findUnique } },
    } as unknown as PrismTransactionContext;

    await expect(service.findRegistrationSupplier('evt_1', 'sup_1', transaction)).resolves.toMatchObject({
      id: 'sup_1',
      selectedForEvent: false,
    });
  });
});