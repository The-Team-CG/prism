import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import { OpsUserRole } from "@prism/kernel/event-core";
import type { ResolvedEventOpsActor } from "@prism/kernel/access-control";
import { CoordinatorsService } from "./coordinators.service";

const SYSTEM_ACTOR: ResolvedEventOpsActor = {
  id: "system:coordinator-acknowledgement-reminder",
  role: OpsUserRole.System,
  name: "Coordinator Reminder Scheduler",
  email: "system@prism.local",
  explicit: true,
  verified: true,
};

@Injectable()
export class CoordinatorAcknowledgementReminderScheduler implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(CoordinatorAcknowledgementReminderScheduler.name);
  private timer?: NodeJS.Timeout;
  private running = false;

  constructor(private readonly coordinatorsService: CoordinatorsService) {}

  onModuleInit() {
    if (process.env.PRISM_DISABLE_COORDINATOR_ACKNOWLEDGEMENT_JOB === "1") return;
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
      await this.coordinatorsService.enqueueAcknowledgementReminders(undefined, SYSTEM_ACTOR);
    } catch (error) {
      this.logger.warn(
        `Coordinator acknowledgement reminder sweep skipped: ${error instanceof Error ? error.message : String(error)}`,
      );
    } finally {
      this.running = false;
    }
  }
}
