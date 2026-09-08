import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { EventClosureService } from './event-closure.service';

@Injectable()
export class EventWrapUpReminderScheduler implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(EventWrapUpReminderScheduler.name);
  private timer?: NodeJS.Timeout;

  constructor(private readonly eventClosureService: EventClosureService) {}

  onModuleInit() {
    if (process.env.PRISM_DISABLE_WRAP_UP_REMINDER_JOB === '1') return;
    this.timer = setInterval(() => {
      this.eventClosureService.runWrapUpReminderSweep().catch((error: unknown) => {
        this.logger.warn(`Wrap-up reminder sweep skipped: ${error instanceof Error ? error.message : String(error)}`);
      });
    }, 60_000);
    this.timer.unref?.();
  }

  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
  }
}
