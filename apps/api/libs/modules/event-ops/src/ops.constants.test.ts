import { describe, expect, it } from 'vitest';
import { SupplierVerificationStatus, isOpsConstantValue } from './ops.constants';

describe('ops constants', () => {
  it('narrows string values against constant maps', () => {
    expect(isOpsConstantValue(SupplierVerificationStatus, 'verified')).toBe(true);
    expect(isOpsConstantValue(SupplierVerificationStatus, 'unknown')).toBe(false);
  });
});
