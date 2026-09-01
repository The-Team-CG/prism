import { afterEach, describe, expect, it, vi } from 'vitest';
import { InquiryConformeReminderScheduler } from './inquiry-conforme-reminder.scheduler';
import type { InquiriesService } from './inquiries.service';

describe('InquiryConformeReminderScheduler', () => {
  const previousFlag = process.env.PRISM_DISABLE_CONFORME_REMINDER_JOB;

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
    if (previousFlag === undefined) {
      delete process.env.PRISM_DISABLE_CONFORME_REMINDER_JOB;
    } else {
      process.env.PRISM_DISABLE_CONFORME_REMINDER_JOB = previousFlag;
    }
  });

  it('does not start the reminder interval when disabled', () => {
    vi.useFakeTimers();
    process.env.PRISM_DISABLE_CONFORME_REMINDER_JOB = '1';
    const inquiriesService = { runConformeReminderSweep: vi.fn().mockResolvedValue(undefined) } as unknown as InquiriesService;
    const scheduler = new InquiryConformeReminderScheduler(inquiriesService);

    scheduler.onModuleInit();
    vi.advanceTimersByTime(60_000);
    scheduler.onModuleDestroy();

    expect(inquiriesService.runConformeReminderSweep).not.toHaveBeenCalled();
  });

  it('runs the conforme reminder sweep on the interval', async () => {
    vi.useFakeTimers();
    delete process.env.PRISM_DISABLE_CONFORME_REMINDER_JOB;
    const inquiriesService = { runConformeReminderSweep: vi.fn().mockResolvedValue(undefined) } as unknown as InquiriesService;
    const scheduler = new InquiryConformeReminderScheduler(inquiriesService);

    scheduler.onModuleInit();
    vi.advanceTimersByTime(60_000);
    await Promise.resolve();
    scheduler.onModuleDestroy();

    expect(inquiriesService.runConformeReminderSweep).toHaveBeenCalledTimes(1);
  });
});
