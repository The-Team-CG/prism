import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { FileRequirementCommandsService } from './file-requirement-commands.service';

const SWEEP_INTERVAL_MS = 10 * 60_000;

@Injectable()
export class FileRequirementReminderScheduler implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(FileRequirementReminderScheduler.name);
  private timer?: NodeJS.Timeout;
  private running = false;

  constructor(private readonly commands: FileRequirementCommandsService) {}

  onModuleInit() {
    if (process.env.PRISM_DISABLE_FILE_REQUIREMENT_REMINDER_JOB === '1') return;
    this.timer = setInterval(() => { void this.sweep(); }, SWEEP_INTERVAL_MS);
    this.timer.unref?.();
  }

  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
  }

  private async sweep() {
    if (this.running) return;
    this.running = true;
    try {
      await this.commands.runReminderSweep();
    } catch (error) {
      this.logger.warn(`File requirement reminder sweep skipped: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      this.running = false;
    }
  }
}
