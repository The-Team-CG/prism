import type { PrismTransactionContext } from '@prism/kernel/shared-kernel';

export interface GuestQrPassLifecycleOwner {
  expireEventGuestQrPasses(
    eventId: string,
    reason: 'event-ended' | 'event-archived',
    context: PrismTransactionContext,
  ): Promise<void>;
}

export const GUEST_QR_PASS_LIFECYCLE_OWNER = Symbol('GUEST_QR_PASS_LIFECYCLE_OWNER');
