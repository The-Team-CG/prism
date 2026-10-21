import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { OpsUserRole } from '@prism/kernel/event-core';
import type { ResolvedEventOpsActor } from '@prism/kernel/access-control';
import { LiveOpsOverdueTaskNotificationService } from './overdue-task-notification.service';

const SYSTEM_ACTOR: ResolvedEventOpsActor = {
  id: 'system:live-ops-overdue-task-notifier',
  role: OpsUserRole.System,
  name: 'Live Ops Overdue Task Notifier',
  email: 'system@prism.local',
  explicit: true,
  verified: true,
};

@Injectable()
export class LiveOpsOverdueTaskNotificationScheduler implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(LiveOpsOverdueTaskNotificationScheduler.name);
  private timer?: NodeJS.Timeout;
  private running = false;

  constructor(private readonly notificationService: LiveOpsOverdueTaskNotificationService) {}

  onModuleInit() {
    if (process.env.PRISM_DISABLE_LIVE_OPS_OVERDUE_TASK_JOB === '1') return;
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
      await this.notificationService.enqueueOverdueTaskNotifications(SYSTEM_ACTOR);
    } catch (error) {
      this.logger.warn(
        `Live-ops overdue task notification sweep skipped: ${error instanceof Error ? error.message : String(error)}`,
      );
    } finally {
      this.running = false;
    }
  }
}
