import { Global, Module } from '@nestjs/common';
import { DatabaseModule } from '@prism/kernel/database';
import { COMMAND_RECEIPT_STORE } from '@prism/kernel/event-core';
import { PlatformCommandReceiptStore } from './infrastructure/trust/command-receipt.store';

/** Root composition bridge for the kernel command-receipt port. */
@Global()
@Module({
  imports: [DatabaseModule],
  providers: [
    PlatformCommandReceiptStore,
    { provide: COMMAND_RECEIPT_STORE, useExisting: PlatformCommandReceiptStore },
  ],
  exports: [COMMAND_RECEIPT_STORE],
})
export class PlatformOpsCommandReceiptModule {}
