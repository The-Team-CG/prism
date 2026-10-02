import { describe, expect, it } from 'vitest';
import {
  DEFAULT_SUPPLIER_INGRESS_LATE_GRACE_MINUTES,
  supplierIngressLateGraceMinutes,
} from './supplier-ingress-late-policy';

describe('supplier ingress late policy', () => {
  it('defaults to fifteen minutes and accepts whole-minute settings through one day', () => {
    expect(supplierIngressLateGraceMinutes(undefined)).toBe(15);
    expect(supplierIngressLateGraceMinutes('0')).toBe(0);
    expect(supplierIngressLateGraceMinutes('30')).toBe(30);
    expect(supplierIngressLateGraceMinutes('1440')).toBe(1440);
  });

  it.each(['-1', '1.5', '1441', 'not-a-number'])(
    'uses the default for invalid grace period %s',
    (value) => {
      expect(supplierIngressLateGraceMinutes(value)).toBe(
        DEFAULT_SUPPLIER_INGRESS_LATE_GRACE_MINUTES,
      );
    },
  );
});
