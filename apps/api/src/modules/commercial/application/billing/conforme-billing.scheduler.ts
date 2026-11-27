import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConformeBillingService } from './conforme-billing.service';

/** UAT 5.3: issues the billing statement within a minute of a signed conforme activating the portal. */
@Injectable()
export class ConformeBillingScheduler implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(ConformeBillingScheduler.name);
  private timer?: NodeJS.Timeout;
  private running = false;

  constructor(private readonly conformeBilling: ConformeBillingService) {}

  onModuleInit() {
    if (['1', 'true'].includes(process.env.PRISM_DISABLE_CONFORME_BILLING_JOB ?? '')) return;
    this.timer = setInterval(() => void this.tick(), 60_000);
    this.timer.unref?.();
  }

  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
  }

  private async tick() {
    if (this.running) return;
    this.running = true;
    try {
      await this.conformeBilling.issuePending();
    } catch (error) {
      this.logger.warn(`Conforme billing sweep skipped: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      this.running = false;
    }
  }
}
