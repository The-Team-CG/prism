import { Module } from '@nestjs/common';
import { DatabaseModule } from '@prism/kernel/database';
import { URGENT_ISSUE_REFERENCE_READER } from './contracts/urgent-issue-reference-reader.port';
import { UrgentIssueReferenceReaderService } from './application/urgent-issue-reference-reader.service';

/** Small LiveOps owner capability module that avoids importing supplier command composition. */
@Module({
  imports: [DatabaseModule],
  providers: [
    UrgentIssueReferenceReaderService,
    { provide: URGENT_ISSUE_REFERENCE_READER, useExisting: UrgentIssueReferenceReaderService },
  ],
  exports: [URGENT_ISSUE_REFERENCE_READER],
})
export class UrgentIssueReferenceModule {}
