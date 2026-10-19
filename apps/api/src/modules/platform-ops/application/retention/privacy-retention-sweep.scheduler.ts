import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrivacyRetentionSweepService } from './privacy-retention-sweep.service';

const SWEEP_INTERVAL_MS = 60 * 60 * 1000;
const FIRST_RUN_DELAY_MS = 60 * 1000;

/**
 * Hourly retention sweep. Set PRISM_DISABLE_PRIVACY_RETENTION_SWEEP=1 to stop scheduling. The sweep only queues
 * review items, so an enabled policy never changes records without an operator decision.
 */
@Injectable()
export class PrivacyRetentionSweepScheduler implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PrivacyRetentionSweepScheduler.name);
  private timer?: NodeJS.Timeout;
  private startTimer?: NodeJS.Timeout;
  private running = false;

  constructor(private readonly sweepService: PrivacyRetentionSweepService) {}

  onModuleInit() {
    if (process.env.PRISM_DISABLE_PRIVACY_RETENTION_SWEEP === '1') return;
    this.startTimer = setTimeout(() => {
      void this.runSweep();
    }, FIRST_RUN_DELAY_MS);
    this.startTimer.unref?.();
    this.timer = setInterval(() => {
      void this.runSweep();
    }, SWEEP_INTERVAL_MS);
    this.timer.unref?.();
  }

  onModuleDestroy() {
    if (this.startTimer) clearTimeout(this.startTimer);
    if (this.timer) clearInterval(this.timer);
  }

  private async runSweep() {
    if (this.running) return;
    this.running = true;
    try {
      const summary = await this.sweepService.runSweep();
      if (summary.created || summary.held || summary.released) {
        this.logger.log(`Privacy retention sweep queued ${summary.created}, held ${summary.held}, released ${summary.released} review items`);
      }
    } catch (error) {
      this.logger.warn(`Privacy retention sweep skipped: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      this.running = false;
    }
  }
}
