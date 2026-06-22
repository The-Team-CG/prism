import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { InquiriesService } from './inquiries.service';

@Injectable()
export class InquiryConformeReminderScheduler implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(InquiryConformeReminderScheduler.name);
  private reminderTimer?: NodeJS.Timeout;

  constructor(private readonly inquiriesService: InquiriesService) {}

  onModuleInit() {
    if (process.env.PRISM_DISABLE_CONFORME_REMINDER_JOB === '1') return;

    this.reminderTimer = setInterval(() => {
      this.inquiriesService.runConformeReminderSweep().catch((error: unknown) => {
        const message = error instanceof Error ? error.message : String(error);
        this.logger.warn(`Conforme reminder sweep skipped: ${message}`);
      });
    }, 60_000);
    this.reminderTimer.unref?.();
  }

  onModuleDestroy() {
    if (this.reminderTimer) clearInterval(this.reminderTimer);
  }
}
