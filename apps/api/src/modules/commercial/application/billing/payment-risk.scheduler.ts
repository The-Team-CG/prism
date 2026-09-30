import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { BillingOperationsService } from './billing-operations.service';

@Injectable()
export class PaymentRiskScheduler implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PaymentRiskScheduler.name);
  private timer?: NodeJS.Timeout;

  constructor(private readonly billingOperationsService: BillingOperationsService) {}

  onModuleInit() {
    if (process.env.PRISM_DISABLE_PAYMENT_RISK_JOB === '1') return;
    this.timer = setInterval(() => {
      this.billingOperationsService.runPaymentRiskSweep().catch((error: unknown) => {
        this.logger.warn(`Payment-risk sweep skipped: ${error instanceof Error ? error.message : String(error)}`);
      });
    }, 60_000);
    this.timer.unref?.();
  }

  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
  }
}
