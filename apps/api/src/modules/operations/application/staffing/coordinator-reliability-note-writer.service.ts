import { Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { PrismaService } from '@prism/kernel/database';
import type { PrismTransactionContext } from '@prism/kernel/shared-kernel';
import type { CoordinatorReliabilityNoteInput, CoordinatorReliabilityWriter } from '../../contracts/coordinator-reliability-writer.port';

@Injectable()
export class CoordinatorReliabilityNoteWriterService implements CoordinatorReliabilityWriter {
  constructor(private readonly prisma: PrismaService) {}

  async record(input: CoordinatorReliabilityNoteInput, transaction?: PrismTransactionContext) {
    const database = transaction?.prisma ?? this.prisma;
    await database.opsCoordinatorReliabilityNote.create({
      data: {
        id: `crn_${randomUUID()}`,
        eventId: input.eventId,
        coordinatorId: input.coordinatorId,
        assignmentId: input.assignmentId,
        note: input.note,
        severity: input.severity,
      },
    });
  }
}
