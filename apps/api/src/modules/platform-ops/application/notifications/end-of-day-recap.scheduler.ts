import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { EndOfDayRecapService, manilaDayKey } from './end-of-day-recap.service';

/** Checks each minute; the service queues the day's recap once 18:00 Philippine time has passed, at most once a day. */
@Injectable()
export class EndOfDayRecapScheduler implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(EndOfDayRecapScheduler.name);
  private timer?: NodeJS.Timeout;
  private queuedDay?: string;

  constructor(private readonly recap: EndOfDayRecapService) {}

  onModuleInit() {
    if (['1', 'true'].includes(process.env.PRISM_DISABLE_END_OF_DAY_RECAP_JOB ?? '')) return;
    this.timer = setInterval(() => void this.tick(), 60_000);
    this.timer.unref?.();
  }

  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
  }

  private async tick() {
    if (this.queuedDay === manilaDayKey(new Date())) return;
    try {
      const result = await this.recap.queueRecap();
      if (result.status === 'queued' || (result.status === 'skipped' && result.reason !== 'before_send_time')) this.queuedDay = result.day;
    } catch (error) {
      this.logger.warn(`End-of-day recap skipped: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
}
