import { Module } from '@nestjs/common';
import { DatabaseModule } from '@prism/kernel/database';
import { CONFIRMED_CANCELLATION_FEE_WRITER } from './contracts/confirmed-cancellation-fee-writer.port';
import { ConfirmedCancellationFeeWriterService } from './application/billing/confirmed-cancellation-fee-writer.service';

@Module({
  imports: [DatabaseModule],
  providers: [ConfirmedCancellationFeeWriterService, { provide: CONFIRMED_CANCELLATION_FEE_WRITER, useExisting: ConfirmedCancellationFeeWriterService }],
  exports: [CONFIRMED_CANCELLATION_FEE_WRITER],
})
export class ConfirmedCancellationFeeModule {}
