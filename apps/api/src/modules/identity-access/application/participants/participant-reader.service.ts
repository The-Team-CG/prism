import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '@prism/kernel/database';
import { EventAccessPolicyService, type ResolvedEventOpsActor } from '@prism/kernel/access-control';
import { OpsUserRole } from '@prism/kernel/event-core';
import type { ParticipantReader } from '../../contracts/participant-reader.port';

@Injectable()
export class ParticipantReaderService implements ParticipantReader {
  constructor(private readonly prisma: PrismaService, private readonly policy: EventAccessPolicyService) {}

  async resolveForEvent(actorId: string, eventId: string): Promise<ResolvedEventOpsActor> {
    const user = await this.prisma.opsUser.findUnique({ where: { id: actorId }, select: { id: true, name: true, email: true, role: true, approvalStatus: true } });
    if (!user || user.approvalStatus !== 'approved') throw new NotFoundException('Communication participant account not found');
    const role = user.role as OpsUserRole;
    const actor: ResolvedEventOpsActor = { id: user.id, name: user.name, email: user.email, role, explicit: true, verified: true };
    const event = await this.prisma.opsEvent.findUnique({ where: { id: eventId }, include: { inquiry: true, supplierQuoteRequests: { select: { supplierId: true, assignmentStatus: true } }, coordinatorAssignments: { select: { coordinatorId: true, status: true } } } });
    if (!event) throw new NotFoundException('Event not found');
    if (role === OpsUserRole.PmcmAdmin || role === OpsUserRole.System) return actor;
    if (role === OpsUserRole.Client) {
      await this.policy.requireCanReadEvent(actor, event, 'communication participant', {});
      return actor;
    }
    if (role === OpsUserRole.Supplier) {
      const supplier = await this.prisma.opsSupplier.findFirst({ where: { email: user.email }, select: { id: true } });
      if (!supplier || !event.supplierQuoteRequests.some((r) => r.supplierId === supplier.id && ['confirmed', 'pending_confirmation'].includes(r.assignmentStatus))) throw new ForbiddenException('Supplier is not assigned to this event');
      actor.supplierId = supplier.id;
      await this.policy.requireCanReadEvent(actor, event, 'communication participant', { supplierEventIds: [eventId] });
      return actor;
    }
    if (role === OpsUserRole.Coordinator) {
      const coordinator = await this.prisma.opsCoordinator.findUnique({ where: { userId: user.id }, select: { id: true } });
      if (!coordinator || !event.coordinatorAssignments.some((a) => a.coordinatorId === coordinator.id && a.status !== 'cancelled')) throw new ForbiddenException('Coordinator is not assigned to this event');
      actor.coordinatorId = coordinator.id;
      actor.eventId = eventId;
      await this.policy.requireCanReadEvent(actor, event, 'communication participant', {});
      return actor;
    }
    throw new ForbiddenException('Account role cannot join communication threads');
  }
}
