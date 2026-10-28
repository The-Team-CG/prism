import type { BillingActor } from './billing-operations.types';
import type { PrismTransactionContext } from '@prism/kernel/shared-kernel';

export const CONFIRMED_CANCELLATION_FEE_WRITER = Symbol('CONFIRMED_CANCELLATION_FEE_WRITER');

export interface ConfirmedCancellationFeeWriter {
  createConfirmedCancellationFeeSource(
    eventId: string,
    input: { amount: number; reason: string; idempotencyKey: string; sourceDocumentId?: string },
    actor: BillingActor,
    transaction: PrismTransactionContext,
  ): Promise<{ id: string; eventId: string; sourceLabel: string; totalAmount: number; status: string } | null>;
}
