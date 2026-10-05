import { Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { PrismaService } from '@prism/kernel/database';
import type { ParticipantEventFacts, ParticipantFactsReader } from './participant-facts.port';

@Injectable()
export class ParticipantFactsService implements ParticipantFactsReader {
  constructor(private readonly prisma: PrismaService) {}

  async findForEvent(eventId: string, db: Prisma.TransactionClient = this.prisma): Promise<ParticipantEventFacts | null> {
    const event = await db.opsEvent.findUnique({
      where: { id: eventId },
      select: { id: true, clientName: true, clientPortalStatus: true, inquiryId: true },
    });
    if (!event) return null;

    const [inquiry, supplierAssignments, coordinatorAssignments] = await Promise.all([
      db.opsInquiry.findUnique({ where: { id: event.inquiryId }, select: { email: true } }),
      db.opsSupplierQuoteRequest.findMany({ where: { eventId }, select: { supplierId: true, assignmentStatus: true } }),
      db.opsCoordinatorAssignment.findMany({ where: { eventId }, select: { coordinatorId: true, status: true } }),
    ]);
    const supplierIds = [...new Set(supplierAssignments.flatMap(({ supplierId }) => supplierId ? [supplierId] : []))];
    const coordinatorIds = [...new Set(coordinatorAssignments.flatMap(({ coordinatorId }) => coordinatorId ? [coordinatorId] : []))];
    const [suppliers, coordinators] = await Promise.all([
      supplierIds.length
        ? db.opsSupplier.findMany({ where: { id: { in: supplierIds } }, select: { id: true, email: true } })
        : Promise.resolve([]),
      coordinatorIds.length
        ? db.opsCoordinator.findMany({ where: { id: { in: coordinatorIds } }, select: { id: true, userId: true } })
        : Promise.resolve([]),
    ]);

    return {
      event: { id: event.id, clientName: event.clientName, clientPortalStatus: event.clientPortalStatus, inquiryEmail: inquiry?.email ?? null },
      supplierAssignments: supplierAssignments.map(({ supplierId, assignmentStatus }) => ({ supplierId, status: assignmentStatus })),
      suppliers,
      coordinatorAssignments,
      coordinators,
    };
  }
}
