import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ChangeManagementService } from './change-management.service';

const HOUR_MS = 60 * 60 * 1000;

@Injectable()
export class EventAutoFreezeScheduler implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(EventAutoFreezeScheduler.name);
  private timer?: NodeJS.Timeout;

  constructor(private readonly changeManagementService: ChangeManagementService) {}

  onModuleInit() {
    if (process.env.PRISM_DISABLE_AUTO_FREEZE_JOB === '1') return;
    this.timer = setInterval(() => {
      this.changeManagementService.freezeEventsDue().catch((error: unknown) => {
        this.logger.warn(`Automatic freeze sweep skipped: ${error instanceof Error ? error.message : String(error)}`);
      });
    }, HOUR_MS);
    this.timer.unref?.();
  }

  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
  }
}
