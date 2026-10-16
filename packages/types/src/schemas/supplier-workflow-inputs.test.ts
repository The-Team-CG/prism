import { describe, expect, it } from 'vitest';
import { createSupplierCreativeTaskSchema, updateSupplierCreativeTaskSchema, updateSupplierCreativeProgressSchema } from './supplier-workflow-inputs';

describe('supplier creative workflow inputs', () => {
  it('requires a UUID idempotency key for PMCM task creation', () => {
    const payload = { requestId: 'request-1', title: 'Artwork', brief: 'Submit final artwork', dueAt: null };

    expect(createSupplierCreativeTaskSchema.safeParse({ ...payload, idempotencyKey: 'e1736ec7-819c-4bd4-994e-453a8c0b48b4' }).success).toBe(true);
    expect(createSupplierCreativeTaskSchema.safeParse({ ...payload, idempotencyKey: 'not-a-uuid' }).success).toBe(false);
    expect(createSupplierCreativeTaskSchema.safeParse(payload).success).toBe(false);
  });

  it('keeps supplier progress separate from PMCM review decisions', () => {
    expect(updateSupplierCreativeTaskSchema.safeParse({ status: 'in_progress' }).success).toBe(false);
    expect(updateSupplierCreativeTaskSchema.safeParse({ status: 'accepted', reviewNote: 'Approved for print' }).success).toBe(true);
    expect(updateSupplierCreativeProgressSchema.safeParse({ note: 'Artwork is in progress' }).success).toBe(true);
  });
});
