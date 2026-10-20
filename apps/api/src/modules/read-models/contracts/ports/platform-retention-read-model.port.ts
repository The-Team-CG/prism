import type { PrismTransactionContext } from '@prism/kernel/shared-kernel';

export const PLATFORM_RETENTION_READ_MODEL = Symbol('PLATFORM_RETENTION_READ_MODEL');

/** Categories with a sweep candidate source. Audit, legal-hold, document, and approval records are never listed here. */
export const PLATFORM_RETENTION_SOURCE_CATEGORIES = ['inquiry', 'guest_check_in', 'guest_feedback'] as const;
export type PlatformRetentionSourceCategory = (typeof PLATFORM_RETENTION_SOURCE_CATEGORIES)[number];

export type PlatformRetentionCandidate = {
  category: PlatformRetentionSourceCategory;
  subjectId: string;
  eventId: string;
  /** Inquiry contact email; empty for guest categories. */
  subjectEmail: string;
  /** Guest name; empty for inquiry candidates. */
  subjectName: string;
  /** Archive timestamp of the owning event, the anchor for event-scoped categories. */
  anchorAt: Date;
};

export type PlatformRetentionCandidatePage = {
  candidates: PlatformRetentionCandidate[];
  /** Pass as `afterEventId` to continue; null when the archived-event scan is exhausted. */
  nextEventCursor: string | null;
};

/** Read-only composition of archived-event records for the privacy retention sweep. */
export interface PlatformRetentionReadModel {
  findRetentionCandidates(input: {
    category: PlatformRetentionSourceCategory;
    archivedBefore: Date;
    afterEventId?: string;
    eventTake: number;
  }): Promise<PlatformRetentionCandidatePage>;
  /** Re-reads one subject so execution decides against current data; null when it no longer matches. */
  findRetentionCandidate(
    input: { category: PlatformRetentionSourceCategory; subjectId: string; eventId: string },
    transaction?: PrismTransactionContext,
  ): Promise<PlatformRetentionCandidate | null>;
}
