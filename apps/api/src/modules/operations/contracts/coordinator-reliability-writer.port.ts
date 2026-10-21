import type { PrismTransactionContext } from '@prism/kernel/shared-kernel';

export interface CoordinatorReliabilityNoteInput {
  eventId: string;
  coordinatorId: string | null;
  assignmentId: string;
  note: string;
  severity: 'warning' | 'critical';
}

export interface CoordinatorReliabilityWriter {
  record(input: CoordinatorReliabilityNoteInput, transaction?: PrismTransactionContext): Promise<void>;
}
