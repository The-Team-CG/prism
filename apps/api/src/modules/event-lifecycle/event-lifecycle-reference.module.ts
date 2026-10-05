import { Module } from '@nestjs/common';
import { DatabaseModule } from '@prism/kernel/database';
import { POST_EVENT_LIFECYCLE_STATE_READER } from './contracts/post-event-reference-reader.port';
import { PostEventLifecycleStateReaderService } from './application/onboarding/post-event-lifecycle-state-reader.service';

/** Small Lifecycle owner capability module that can be consumed without importing Lifecycle workflows. */
@Module({
  imports: [DatabaseModule],
  providers: [
    PostEventLifecycleStateReaderService,
    { provide: POST_EVENT_LIFECYCLE_STATE_READER, useExisting: PostEventLifecycleStateReaderService },
  ],
  exports: [POST_EVENT_LIFECYCLE_STATE_READER],
})
export class EventLifecycleReferenceModule {}
