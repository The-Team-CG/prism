import type { ResolvedEventOpsActor } from '@prism/modules/access-control';

export interface SupplierLiveOperations {
  recordEventDayLog(
    eventId: string,
    action: string,
    actor: ResolvedEventOpsActor,
    message: string,
    affectedType?: string,
    affectedId?: string,
    metadata?: Record<string, unknown>,
  ): Promise<unknown>;
}
