import { Module } from '@nestjs/common';
import { DatabaseModule } from '@prism/kernel/database';
import { DATE_CHANGE_FACTS_READER } from './date-change-facts-reader.port';
import { DateChangeFactsReaderService } from './date-change-facts-reader.service';

/** Narrow read-only composition for the date change impact; avoids importing the full ReadModelsModule. */
@Module({
  imports: [DatabaseModule],
  providers: [DateChangeFactsReaderService, { provide: DATE_CHANGE_FACTS_READER, useExisting: DateChangeFactsReaderService }],
  exports: [DATE_CHANGE_FACTS_READER],
})
export class DateChangeFactsReaderModule {}
