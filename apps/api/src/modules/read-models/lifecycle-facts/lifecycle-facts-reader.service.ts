import { Injectable } from '@nestjs/common';
import { PrismaService } from '@prism/kernel/database';
import type { Prisma } from '@prisma/client';
import type { ClosureLifecycleFacts, ComplianceLifecycleFacts, LifecycleFactsReader } from './lifecycle-facts-reader.port';

@Injectable()
export class LifecycleFactsReaderService implements LifecycleFactsReader {
  constructor(private readonly prisma: PrismaService) {}

  async getComplianceFacts(eventId: string, client: Prisma.TransactionClient = this.prisma): Promise<ComplianceLifecycleFacts> {
    const [coverageRequirements, coordinatorAssignments, guestRosterCount] = await Promise.all([
      client.opsEventCoverageRequirement.findMany({ where: { eventId }, select: { role: true, required: true } }),
      client.opsCoordinatorAssignment.findMany({ where: { eventId }, select: { role: true, status: true, withdrawnAt: true } }),
      client.opsGuestRosterEntry.count({ where: { eventId } }),
    ]);
    return { coverageRequirements, coordinatorAssignments, guestRosterCount };
  }

  async getClosureFacts(eventId: string, client: Prisma.TransactionClient = this.prisma): Promise<ClosureLifecycleFacts> {
    const [guestFeedback, issues, scheduleDays] = await Promise.all([
      client.opsGuestFeedback.findMany({ where: { eventId }, select: { id: true, rating: true, moderationStatus: true, privacyConsentAccepted: true, privacyConsentWithdrawnAt: true } }),
      client.opsUrgentIssue.findMany({ where: { eventId }, select: { id: true } }),
      client.opsEventScheduleDay.findMany({ where: { eventId }, include: { segments: { select: { id: true, actualEndedAt: true, plannedEndAt: true } } } }),
    ]);
    return { guestFeedback, issues, scheduleDays };
  }
}
