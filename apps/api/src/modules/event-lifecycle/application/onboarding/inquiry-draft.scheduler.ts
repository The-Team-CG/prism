import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { InquiryDraftService } from './inquiry-draft.service';

/** FR-50: sends draft reminders and purges old drafts every fifteen minutes. */
@Injectable()
export class InquiryDraftScheduler implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(InquiryDraftScheduler.name);
  private timer?: NodeJS.Timeout;

  constructor(private readonly drafts: InquiryDraftService) {}

  onModuleInit() {
    if (process.env.PRISM_DISABLE_INQUIRY_DRAFT_JOB === '1') return;
    this.timer = setInterval(() => {
      this.drafts.sweep().catch((error: unknown) => {
        this.logger.warn(`Inquiry draft sweep skipped: ${error instanceof Error ? error.message : String(error)}`);
      });
    }, 15 * 60_000);
    this.timer.unref?.();
  }

  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
  }
}
