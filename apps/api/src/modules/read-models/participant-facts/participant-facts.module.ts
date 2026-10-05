import { Module } from '@nestjs/common';
import { DatabaseModule } from '@prism/kernel/database';
import { PARTICIPANT_FACTS } from './participant-facts.port';
import { ParticipantFactsService } from './participant-facts.service';

/** Small read-only composition module; deliberately imports no domain modules. */
@Module({
  imports: [DatabaseModule],
  providers: [ParticipantFactsService, { provide: PARTICIPANT_FACTS, useExisting: ParticipantFactsService }],
  exports: [PARTICIPANT_FACTS],
})
export class ParticipantFactsModule {}
