import { Module } from '@nestjs/common';
import { DatabaseModule } from '@prism/kernel/database';
import { ConformeReminderWindowClaimService } from './application/onboarding/conforme-reminder-window-claim.service';
import { CONFORME_REMINDER_WINDOW_CLAIMER } from './contracts/conforme-reminder-window-claim.port';

@Module({
  imports: [DatabaseModule],
  providers: [
    ConformeReminderWindowClaimService,
    { provide: CONFORME_REMINDER_WINDOW_CLAIMER, useExisting: ConformeReminderWindowClaimService },
  ],
  exports: [CONFORME_REMINDER_WINDOW_CLAIMER],
})
export class ConformeReminderWindowModule {}
