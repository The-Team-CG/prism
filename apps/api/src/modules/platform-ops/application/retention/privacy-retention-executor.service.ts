import { Inject, Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { COMMERCIAL_PRIVACY_REDACTOR, type CommercialPrivacyRedactor } from '@prism/contexts/commercial';
import { LIFECYCLE_PRIVACY_REDACTOR, type LifecyclePrivacyRedactor } from '@prism/contexts/event-lifecycle';
import { OPERATIONS_PRIVACY_REDACTOR, type OperationsPrivacyRedactor } from '@prism/contexts/operations';
import type { PlatformRetentionCandidate } from '@prism/contexts/read-models';

export type RetentionRedactionResult = { surfaces: string[]; touchedRecords: number };

/**
 * Applies the existing owner redactors to one retention candidate. Every write goes through the owner
 * redactor used by privacy requests, so retention never bypasses owner-specific redaction rules.
 */
@Injectable()
export class PrivacyRetentionExecutorService {
  constructor(
    @Inject(LIFECYCLE_PRIVACY_REDACTOR) private readonly lifecyclePrivacy: LifecyclePrivacyRedactor,
    @Inject(COMMERCIAL_PRIVACY_REDACTOR) private readonly commercialPrivacy: CommercialPrivacyRedactor,
    @Inject(OPERATIONS_PRIVACY_REDACTOR) private readonly operationsPrivacy: OperationsPrivacyRedactor,
  ) {}

  async redactCandidate(
    candidate: PlatformRetentionCandidate,
    reviewItemId: string,
    transaction: Prisma.TransactionClient,
  ): Promise<RetentionRedactionResult> {
    if (candidate.category === 'inquiry') {
      // Event-scoped: only this event's inquiry and billing rows change; other events for the same contact are untouched.
      const redactedEmail = `redacted+retention_${reviewItemId}@privacy.local`;
      const lifecycle = await this.lifecyclePrivacy.redactClient(
        { email: candidate.subjectEmail.trim().toLowerCase(), redactedEmail, eventId: candidate.eventId },
        transaction,
      );
      const commercial = await this.commercialPrivacy.redactClientBilling(
        { eventIds: lifecycle.eventIds, redactedEmail },
        transaction,
      );
      return {
        surfaces: [...lifecycle.surfaces, ...commercial.surfaces],
        touchedRecords: lifecycle.touchedRecords + commercial.touchedRecords,
      };
    }
    // Guest redaction targets only the referenced record by id, never by name, so a different guest who shares the name is untouched.
    const result = await this.operationsPrivacy.redactGuestRecord(
      { eventId: candidate.eventId, recordType: candidate.category, recordId: candidate.subjectId },
      transaction,
    );
    return { surfaces: result.surfaces, touchedRecords: result.touchedRecords };
  }
}
