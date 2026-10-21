import { afterEach, describe, expect, it, vi } from 'vitest';
import { OpsUserRole } from '@prism/kernel/event-core';
import { SupplierIngressLateScheduler } from './supplier-ingress-late.scheduler';
import type { SupplierIngressLateMonitorService } from './supplier-ingress-late-monitor.service';

describe('SupplierIngressLateScheduler', () => {
  const previousDisabledValue = process.env.PRISM_DISABLE_SUPPLIER_INGRESS_LATE_JOB;

  afterEach(() => {
    vi.useRealTimers();
    if (previousDisabledValue === undefined) {
      delete process.env.PRISM_DISABLE_SUPPLIER_INGRESS_LATE_JOB;
    } else {
      process.env.PRISM_DISABLE_SUPPLIER_INGRESS_LATE_JOB = previousDisabledValue;
    }
  });

  it('runs the ingress monitor every minute with an explicit system actor', async () => {
    vi.useFakeTimers();
    delete process.env.PRISM_DISABLE_SUPPLIER_INGRESS_LATE_JOB;
    const markLateSupplierIngresses = vi.fn().mockResolvedValue({ marked: 0 });
    const scheduler = new SupplierIngressLateScheduler({
      markLateSupplierIngresses,
    } as unknown as SupplierIngressLateMonitorService);

    scheduler.onModuleInit();
    await vi.advanceTimersByTimeAsync(60_000);
    scheduler.onModuleDestroy();

    expect(markLateSupplierIngresses).toHaveBeenCalledTimes(1);
    expect(markLateSupplierIngresses).toHaveBeenCalledWith(expect.objectContaining({
      id: 'system:supplier-ingress-late-monitor',
      role: OpsUserRole.System,
      explicit: true,
      verified: true,
    }));
  });

  it('does not start when explicitly disabled', async () => {
    vi.useFakeTimers();
    process.env.PRISM_DISABLE_SUPPLIER_INGRESS_LATE_JOB = '1';
    const markLateSupplierIngresses = vi.fn().mockResolvedValue({ marked: 0 });
    const scheduler = new SupplierIngressLateScheduler({
      markLateSupplierIngresses,
    } as unknown as SupplierIngressLateMonitorService);

    scheduler.onModuleInit();
    await vi.advanceTimersByTimeAsync(60_000);
    scheduler.onModuleDestroy();

    expect(markLateSupplierIngresses).not.toHaveBeenCalled();
  });
});
