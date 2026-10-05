import type { PrismTransactionContext } from '@prism/kernel/shared-kernel';

export type PostEventLifecycleState = {
  eventId: string;
  actualEndedAt: Date | null;
};

/** Reads event-owned post-event eligibility, locking the event row when a command transaction is supplied. */
export interface PostEventLifecycleStateReader {
  findPostEventState(eventId: string, transaction?: PrismTransactionContext): Promise<PostEventLifecycleState | null>;
}

export const POST_EVENT_LIFECYCLE_STATE_READER = Symbol('POST_EVENT_LIFECYCLE_STATE_READER');
