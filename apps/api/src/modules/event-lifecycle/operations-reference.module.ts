import { Module } from '@nestjs/common';
import { DatabaseModule } from '@prism/kernel/database';
import {
  GUEST_PRIVACY_CLASSIFICATION_OWNER,
  OPERATIONS_EVENT_REFERENCE_READER,
  WALK_IN_POLICY_OWNER,
} from './contracts/operations-event-reference.port';
import { OperationsEventReferenceService } from './application/onboarding/operations-event-reference.service';

/** Focused Lifecycle owner capabilities for Operations event checks and guest policy. */
@Module({
  imports: [DatabaseModule],
  providers: [
    OperationsEventReferenceService,
    { provide: OPERATIONS_EVENT_REFERENCE_READER, useExisting: OperationsEventReferenceService },
    { provide: WALK_IN_POLICY_OWNER, useExisting: OperationsEventReferenceService },
    { provide: GUEST_PRIVACY_CLASSIFICATION_OWNER, useExisting: OperationsEventReferenceService },
  ],
  exports: [OPERATIONS_EVENT_REFERENCE_READER, WALK_IN_POLICY_OWNER, GUEST_PRIVACY_CLASSIFICATION_OWNER],
})
export class OperationsEventReferenceModule {}