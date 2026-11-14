import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { StorageObjectService } from './storage-object.service';

const SWEEP_INTERVAL_MS = 6 * 60 * 60 * 1000;
const FIRST_RUN_DELAY_MS = 5 * 60 * 1000;

/**
 * Every six hours, removes uploads that never finished (requested or failed for more than three days), so they stop
 * filling file lists and provider storage. Set PRISM_DISABLE_ABANDONED_UPLOAD_CLEANUP_JOB=1 to stop scheduling.
 */
@Injectable()
export class AbandonedUploadCleanupScheduler implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(AbandonedUploadCleanupScheduler.name);
  private timer?: NodeJS.Timeout;
  private startTimer?: NodeJS.Timeout;
  private running = false;

  constructor(private readonly storage: StorageObjectService) {}

  onModuleInit() {
    if (process.env.PRISM_DISABLE_ABANDONED_UPLOAD_CLEANUP_JOB === '1') return;
    this.startTimer = setTimeout(() => { void this.sweep(); }, FIRST_RUN_DELAY_MS);
    this.startTimer.unref?.();
    this.timer = setInterval(() => { void this.sweep(); }, SWEEP_INTERVAL_MS);
    this.timer.unref?.();
  }

  onModuleDestroy() {
    if (this.startTimer) clearTimeout(this.startTimer);
    if (this.timer) clearInterval(this.timer);
  }

  private async sweep() {
    if (this.running) return;
    this.running = true;
    try {
      const removed = await this.storage.cleanUpAbandonedUploads();
      if (removed) this.logger.log(`Removed ${removed} uploads that never finished`);
    } catch (error) {
      this.logger.warn(`Abandoned upload cleanup skipped: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      this.running = false;
    }
  }
}
