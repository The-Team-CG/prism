import { Module } from '@nestjs/common';
import { DatabaseModule } from '@prism/kernel/database';
import { COORDINATOR_ACCOUNT_ELIGIBILITY_READER } from './contracts/coordinator-account-reference.port';
import { CoordinatorAccountReferenceService } from './application/coordinator-account-reference.service';

@Module({
  imports: [DatabaseModule],
  providers: [
    CoordinatorAccountReferenceService,
    { provide: COORDINATOR_ACCOUNT_ELIGIBILITY_READER, useExisting: CoordinatorAccountReferenceService },
  ],
  exports: [COORDINATOR_ACCOUNT_ELIGIBILITY_READER],
})
export class CoordinatorAccountReferenceModule {}