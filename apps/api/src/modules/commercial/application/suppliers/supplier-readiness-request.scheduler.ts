import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { SupplierReadinessRequestService } from './supplier-readiness-request.service';

@Injectable()
export class SupplierReadinessRequestScheduler implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(SupplierReadinessRequestScheduler.name);
  private timer?: NodeJS.Timeout;
  private running = false;

  constructor(private readonly requestService: SupplierReadinessRequestService) {}

  onModuleInit() {
    if (process.env.PRISM_DISABLE_SUPPLIER_READINESS_REQUEST_JOB === '1') return;
    this.timer = setInterval(() => {
      void this.runSweep();
    }, 60_000);
    this.timer.unref?.();
  }

  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
  }

  private async runSweep() {
    if (this.running) return;
    this.running = true;
    try {
      await this.requestService.queueDueReadinessRequests();
    } catch (error) {
      this.logger.warn(
        `Supplier readiness request sweep skipped: ${error instanceof Error ? error.message : String(error)}`,
      );
    } finally {
      this.running = false;
    }
  }
}
