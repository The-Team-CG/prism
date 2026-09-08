import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ComplianceWorkflowService } from './compliance-workflow.service';

@Injectable()
export class ComplianceReevaluationScheduler implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(ComplianceReevaluationScheduler.name);
  private timer?: NodeJS.Timeout;

  constructor(private readonly complianceWorkflowService: ComplianceWorkflowService) {}

  onModuleInit() {
    if (process.env.PRISM_DISABLE_COMPLIANCE_JOB === '1') return;
    this.timer = setInterval(() => {
      this.complianceWorkflowService.runScheduledReevaluations().catch((error: unknown) => {
        this.logger.warn(`Compliance sweep skipped: ${error instanceof Error ? error.message : String(error)}`);
      });
    }, 60_000);
    this.timer.unref?.();
  }

  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
  }
}

