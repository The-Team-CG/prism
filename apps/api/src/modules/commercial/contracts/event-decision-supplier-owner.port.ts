import type { PrismTransactionContext } from '@prism/kernel/shared-kernel';

export type EventDecisionSupplierImpact = {
  id: string;
  supplierName: string;
  assignmentStatus: string;
};

/** Commercial-owned supplier-request facts and release transition used by Lifecycle decisions. */
export interface EventDecisionSupplierOwner {
  findEventDecisionSupplierImpact(eventId: string, transaction: PrismTransactionContext): Promise<EventDecisionSupplierImpact[]>;
  releaseEventSupplierObligations(eventId: string, transaction: PrismTransactionContext): Promise<number>;
}

export const EVENT_DECISION_SUPPLIER_OWNER = Symbol('EVENT_DECISION_SUPPLIER_OWNER');
