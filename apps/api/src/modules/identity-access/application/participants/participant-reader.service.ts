import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '@prism/kernel/database';
import { EventAccessPolicyService, type ResolvedEventOpsActor } from '@prism/kernel/access-control';
import { OpsUserRole } from '@prism/kernel/event-core';
import type { ParticipantReader } from '../../contracts/participant-reader.port';

const communicationEventInclude = { inquiry: true, supplierQuoteRequests: { select: { supplierId: true, assignmentStatus: true } }, coordinatorAssignments: { select: { coordinatorId: true, status: true } } } as const;
type CommunicationEvent = Prisma.OpsEventGetPayload<{ include: typeof communicationEventInclude }>;

function normalizeEmail(value: string) { return value.trim().toLowerCase(); }

@Injectable()
export class ParticipantReaderService implements ParticipantReader {
  constructor(private readonly prisma: PrismaService, private readonly policy: EventAccessPolicyService) {}

  async resolveForEvent(actorId: string, eventId: string): Promise<ResolvedEventOpsActor> {
    const [user, event] = await Promise.all([
      this.prisma.opsUser.findUnique({ where: { id: actorId }, select: { id: true, name: true, email: true, role: true, approvalStatus: true } }),
      this.prisma.opsEvent.findUnique({ where: { id: eventId }, include: communicationEventInclude }),
    ]);
    if (!user || user.approvalStatus !== 'approved') throw new NotFoundException('Communication participant account not found');
    if (!event) throw new NotFoundException('Event not found');
    const role = user.role as OpsUserRole;
    const actor: ResolvedEventOpsActor = { id: user.id, name: user.name, email: user.email, role, explicit: true, verified: true };
    return this.resolveRole(actor, role, event, eventId);
  }

  async listEligibleForEvent(eventId: string, requester: ResolvedEventOpsActor) {
    if (requester.role !== OpsUserRole.PmcmAdmin && requester.role !== OpsUserRole.System) throw new ForbiddenException('Only PMCM can enumerate communication participants');
    const event = await this.prisma.opsEvent.findUnique({ where: { id: eventId }, include: communicationEventInclude });
    if (!event) throw new NotFoundException('Event not found');
    const users = await this.prisma.opsUser.findMany({ where: { approvalStatus: 'approved' }, select: { id: true, name: true, email: true, role: true }, orderBy: { id: 'asc' } });
    const [suppliers, coordinators] = await Promise.all([
      this.prisma.opsSupplier.findMany({ select: { id: true, email: true } }),
      this.prisma.opsCoordinator.findMany({ where: { userId: { in: users.filter((user) => user.role === OpsUserRole.Coordinator).map((user) => user.id) } }, select: { id: true, userId: true } }),
    ]);
    const supplierByEmail = new Map(suppliers.map((supplier) => [normalizeEmail(supplier.email), supplier.id]));
    const coordinatorByUser = new Map(coordinators.filter((coordinator) => coordinator.userId).map((coordinator) => [coordinator.userId!, coordinator.id]));
    const eligible = users.filter((user) => this.canResolveRole(user, event, supplierByEmail, coordinatorByUser));
    return eligible;
  }

  private canResolveRole(user: { id: string; email: string; role: string }, event: CommunicationEvent, supplierByEmail: Map<string, string>, coordinatorByUser: Map<string, string>) {
    if (user.role === OpsUserRole.PmcmAdmin || user.role === OpsUserRole.System) return true;
    if (user.role === OpsUserRole.Client) return event.inquiry?.email.trim().toLowerCase() === normalizeEmail(user.email);
    if (user.role === OpsUserRole.Supplier) {
      const supplierId = supplierByEmail.get(normalizeEmail(user.email));
      return Boolean(supplierId && event.supplierQuoteRequests.some((request) => request.supplierId === supplierId && ['confirmed', 'pending_confirmation'].includes(request.assignmentStatus)));
    }
    if (user.role === OpsUserRole.Coordinator) {
      const coordinatorId = coordinatorByUser.get(user.id);
      return Boolean(coordinatorId && event.coordinatorAssignments.some((assignment) => assignment.coordinatorId === coordinatorId && assignment.status !== 'cancelled'));
    }
    return false;
  }

  private async resolveRole(actor: ResolvedEventOpsActor, role: OpsUserRole, event: CommunicationEvent, eventId: string) {
    if (role === OpsUserRole.PmcmAdmin || role === OpsUserRole.System) return actor;
    if (role === OpsUserRole.Client) return this.resolveClient(actor, event);
    if (role === OpsUserRole.Supplier) return this.resolveSupplier(actor, event, eventId);
    if (role === OpsUserRole.Coordinator) return this.resolveCoordinator(actor, event, eventId);
    throw new ForbiddenException('Account role cannot join communication threads');
  }

  private async resolveClient(actor: ResolvedEventOpsActor, event: CommunicationEvent) {
    await this.policy.requireCanReadEvent(actor, event, 'communication participant', {});
    return actor;
  }

  private async resolveSupplier(actor: ResolvedEventOpsActor, event: CommunicationEvent, eventId: string) {
    const supplier = await this.prisma.opsSupplier.findFirst({ where: { email: { equals: normalizeEmail(actor.email ?? ''), mode: 'insensitive' } }, select: { id: true } });
    const assigned = supplier && event.supplierQuoteRequests.some((request) => request.supplierId === supplier.id && ['confirmed', 'pending_confirmation'].includes(request.assignmentStatus));
    if (!assigned) throw new ForbiddenException('Supplier is not assigned to this event');
    actor.supplierId = supplier!.id;
    await this.policy.requireCanReadEvent(actor, event, 'communication participant', { supplierEventIds: [eventId] });
    return actor;
  }

  private async resolveCoordinator(actor: ResolvedEventOpsActor, event: CommunicationEvent, eventId: string) {
    const coordinator = await this.prisma.opsCoordinator.findUnique({ where: { userId: actor.id }, select: { id: true } });
    const assigned = coordinator && event.coordinatorAssignments.some((assignment) => assignment.coordinatorId === coordinator.id && assignment.status !== 'cancelled');
    if (!assigned) throw new ForbiddenException('Coordinator is not assigned to this event');
    actor.coordinatorId = coordinator!.id;
    actor.eventId = eventId;
    await this.policy.requireCanReadEvent(actor, event, 'communication participant', {});
    return actor;
  }
}
