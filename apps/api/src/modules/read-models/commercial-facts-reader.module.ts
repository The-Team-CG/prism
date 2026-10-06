import { Module } from '@nestjs/common';
import { DatabaseModule } from '@prism/kernel/database';
import { COMMERCIAL_FACTS_READER } from './contracts/ports/commercial-facts-reader.port';
import { CommercialFactsReaderService } from './application/services/commercial-facts-reader.service';

@Module({
  imports: [DatabaseModule],
  providers: [CommercialFactsReaderService, { provide: COMMERCIAL_FACTS_READER, useExisting: CommercialFactsReaderService }],
  exports: [COMMERCIAL_FACTS_READER],
})
export class CommercialFactsReaderModule {}
