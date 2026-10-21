import { Injectable } from '@nestjs/common';
import { PrismaService } from '@prism/kernel/database';
import { CoordinatorAssignmentStatus, CoordinatorAttendanceStatus } from '@prism/kernel/event-core';
import type { PrismCoordinatorInsightFacts } from '@prism/types';
import type { CoordinatorInsightFactsReader } from '../../contracts/coordinator-insight-facts-reader.port';

@Injectable()
export class CoordinatorInsightFactsReaderService implements CoordinatorInsightFactsReader {
  constructor(private readonly prisma: PrismaService) {}

  async getForEvent(eventId: string): Promise<PrismCoordinatorInsightFacts> {
    const [assignments, awaitingAcknowledgement, lateAttendance, absentAttendance, replacedAssignments, cancelledAssignments, reliabilityNotes] =
      await Promise.all([
        this.prisma.opsCoordinatorAssignment.count({ where: { eventId } }),
        this.prisma.opsCoordinatorAssignment.count({
          where: { eventId, status: CoordinatorAssignmentStatus.PendingAcknowledgement },
        }),
        this.prisma.opsCoordinatorAssignment.count({
          where: { eventId, attendanceStatus: CoordinatorAttendanceStatus.Late },
        }),
        this.prisma.opsCoordinatorAssignment.count({
          where: { eventId, attendanceStatus: CoordinatorAttendanceStatus.Absent },
        }),
        this.prisma.opsCoordinatorAssignment.count({
          where: { eventId, status: CoordinatorAssignmentStatus.Replaced },
        }),
        this.prisma.opsCoordinatorAssignment.count({
          where: { eventId, status: CoordinatorAssignmentStatus.Cancelled },
        }),
        this.prisma.opsCoordinatorReliabilityNote.count({ where: { eventId } }),
      ]);

    return {
      assignments,
      awaitingAcknowledgement,
      lateAttendance,
      absentAttendance,
      replacedAssignments,
      cancelledAssignments,
      reliabilityNotes,
    };
  }
}
