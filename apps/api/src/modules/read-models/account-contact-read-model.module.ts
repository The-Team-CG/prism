import { Module } from '@nestjs/common';
import { DatabaseModule } from '@prism/kernel/database';
import { ACCOUNT_CONTACT_READ_MODEL } from './contracts/ports/account-contact-read-model.port';
import { AccountContactReadModelsService } from './application/services/account-contact-read-models.service';

/** Narrow, read-only account contact lookup shared by notification consumers. */
@Module({
  imports: [DatabaseModule],
  providers: [AccountContactReadModelsService, { provide: ACCOUNT_CONTACT_READ_MODEL, useExisting: AccountContactReadModelsService }],
  exports: [ACCOUNT_CONTACT_READ_MODEL],
})
export class AccountContactReadModelModule {}
