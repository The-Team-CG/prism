import { Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { PrismaService } from '@prism/kernel/database';
import type { ParticipantEventFacts, ParticipantFactsReader } from './participant-facts.port';

@Injectable()
export class ParticipantFactsService implements ParticipantFactsReader {
  constructor(private readonly prisma: PrismaService) {}

  async findForEvent(eventId: string, db: Prisma.TransactionClient = this.prisma): Promise<ParticipantEventFacts | null> {
    return (await this.findForEvents([eventId], db)).get(eventId) ?? null;
  }

  /** One fixed set of queries for any number of events, so access checks over a list do not scale with its length. */
  async findForEvents(eventIds: string[], db: Prisma.TransactionClient = this.prisma): Promise<Map<string, ParticipantEventFacts>> {
    const ids = [...new Set(eventIds)];
    if (!ids.length) return new Map();
    const events = await db.opsEvent.findMany({ where: { id: { in: ids } }, select: { id: true, clientName: true, clientPortalStatus: true, inquiryId: true } });
    const inquiryIds = [...new Set(events.map(({ inquiryId }) => inquiryId))];
    const [inquiries, supplierAssignments, coordinatorAssignments] = await Promise.all([
      db.opsInquiry.findMany({ where: { id: { in: inquiryIds } }, select: { id: true, email: true } }),
      db.opsSupplierQuoteRequest.findMany({ where: { eventId: { in: ids } }, select: { eventId: true, supplierId: true, assignmentStatus: true } }),
      db.opsCoordinatorAssignment.findMany({ where: { eventId: { in: ids } }, select: { eventId: true, coordinatorId: true, status: true } }),
    ]);
    const supplierIds = [...new Set(supplierAssignments.flatMap(({ supplierId }) => supplierId ? [supplierId] : []))];
    const coordinatorIds = [...new Set(coordinatorAssignments.flatMap(({ coordinatorId }) => coordinatorId ? [coordinatorId] : []))];
    const [suppliers, coordinators] = await Promise.all([
      supplierIds.length ? db.opsSupplier.findMany({ where: { id: { in: supplierIds } }, select: { id: true, email: true } }) : Promise.resolve([]),
      coordinatorIds.length ? db.opsCoordinator.findMany({ where: { id: { in: coordinatorIds } }, select: { id: true, userId: true } }) : Promise.resolve([]),
    ]);
    const inquiryEmail = new Map(inquiries.map((inquiry) => [inquiry.id, inquiry.email]));
    return new Map(events.map((event) => [event.id, {
      event: { id: event.id, clientName: event.clientName, clientPortalStatus: event.clientPortalStatus, inquiryEmail: inquiryEmail.get(event.inquiryId) ?? null },
      supplierAssignments: supplierAssignments.filter((row) => row.eventId === event.id).map(({ supplierId, assignmentStatus }) => ({ supplierId, status: assignmentStatus })),
      suppliers,
      coordinatorAssignments: coordinatorAssignments.filter((row) => row.eventId === event.id).map(({ coordinatorId, status }) => ({ coordinatorId, status })),
      coordinators,
    }]));
  }
}
