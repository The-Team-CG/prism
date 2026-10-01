import { afterEach, describe, expect, it, vi } from 'vitest';
import { PaymentRiskScheduler } from './payment-risk.scheduler';
import type { BillingOperationsService } from './billing-operations.service';

describe('PaymentRiskScheduler', () => {
  const previousFlag = process.env.PRISM_DISABLE_PAYMENT_RISK_JOB;

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
    if (previousFlag === undefined) {
      delete process.env.PRISM_DISABLE_PAYMENT_RISK_JOB;
    } else {
      process.env.PRISM_DISABLE_PAYMENT_RISK_JOB = previousFlag;
    }
  });

  it('does not start the payment-risk interval when disabled', () => {
    vi.useFakeTimers();
    process.env.PRISM_DISABLE_PAYMENT_RISK_JOB = '1';
    const service = { runPaymentRiskSweep: vi.fn().mockResolvedValue(undefined) } as unknown as BillingOperationsService;
    const scheduler = new PaymentRiskScheduler(service);

    scheduler.onModuleInit();
    vi.advanceTimersByTime(60_000);
    scheduler.onModuleDestroy();

    expect(service.runPaymentRiskSweep).not.toHaveBeenCalled();
  });

  it('runs the payment-risk sweep on the interval', async () => {
    vi.useFakeTimers();
    delete process.env.PRISM_DISABLE_PAYMENT_RISK_JOB;
    const service = { runPaymentRiskSweep: vi.fn().mockResolvedValue(undefined) } as unknown as BillingOperationsService;
    const scheduler = new PaymentRiskScheduler(service);

    scheduler.onModuleInit();
    vi.advanceTimersByTime(60_000);
    await Promise.resolve();
    scheduler.onModuleDestroy();

    expect(service.runPaymentRiskSweep).toHaveBeenCalledTimes(1);
  });
});
