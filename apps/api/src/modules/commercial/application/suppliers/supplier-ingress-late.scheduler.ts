import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { OpsUserRole } from '@prism/kernel/event-core';
import type { ResolvedEventOpsActor } from '@prism/kernel/access-control';
import { SupplierIngressLateMonitorService } from './supplier-ingress-late-monitor.service';

const SYSTEM_ACTOR: ResolvedEventOpsActor = {
  id: 'system:supplier-ingress-late-monitor',
  role: OpsUserRole.System,
  name: 'Supplier Ingress Monitor',
  email: 'system@prism.local',
  explicit: true,
  verified: true,
};

@Injectable()
export class SupplierIngressLateScheduler implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(SupplierIngressLateScheduler.name);
  private timer?: NodeJS.Timeout;
  private running = false;

  constructor(private readonly monitorService: SupplierIngressLateMonitorService) {}

  onModuleInit() {
    if (process.env.PRISM_DISABLE_SUPPLIER_INGRESS_LATE_JOB === '1') return;
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
      await this.monitorService.markLateSupplierIngresses(SYSTEM_ACTOR);
    } catch (error) {
      this.logger.warn(
        `Supplier ingress late sweep skipped: ${error instanceof Error ? error.message : String(error)}`,
      );
    } finally {
      this.running = false;
    }
  }
}
