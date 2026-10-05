import { ForbiddenException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { PrismaService } from '@prism/kernel/database';
import { EventAccessPolicyService, type ResolvedEventOpsActor } from '@prism/kernel/access-control';
import { OpsUserRole } from '@prism/kernel/event-core';
import { PARTICIPANT_FACTS, type ParticipantEventFacts, type ParticipantFactsReader } from '@prism/contexts/read-models/participant-facts';
import type { ParticipantReader } from '../../contracts/participant-reader.port';

function normalizeEmail(value: string) { return value.trim().toLowerCase(); }
const activeSupplierStatuses = ['confirmed', 'pending_confirmation'];

function toPolicyEvent(facts: ParticipantEventFacts) {
  return { ...facts.event, inquiry: facts.event.inquiryEmail === null ? null : { email: facts.event.inquiryEmail } };
}

@Injectable()
export class ParticipantReaderService implements ParticipantReader {
  constructor(
    private readonly prisma: PrismaService,
    private readonly policy: EventAccessPolicyService,
    @Inject(PARTICIPANT_FACTS) private readonly factsReader: ParticipantFactsReader,
  ) {}

  async resolveForEvent(actorId: string, eventId: string, db?: Prisma.TransactionClient): Promise<ResolvedEventOpsActor> {
    const [user, event] = await Promise.all([
      (db ?? this.prisma).opsUser.findUnique({ where: { id: actorId }, select: { id: true, name: true, email: true, role: true, approvalStatus: true } }),
      this.factsReader.findForEvent(eventId, db),
    ]);
    if (!user || user.approvalStatus !== 'approved') throw new NotFoundException('Communication participant account not found');
    if (!event) throw new NotFoundException('Event not found');
    const role = user.role as OpsUserRole;
    const actor: ResolvedEventOpsActor = { id: user.id, name: user.name, email: user.email, role, explicit: true, verified: true };
    return this.resolveRole(actor, role, event, eventId);
  }

  async listEligibleForEvent(eventId: string, requester: ResolvedEventOpsActor) {
    if (requester.role !== OpsUserRole.PmcmAdmin && requester.role !== OpsUserRole.System) throw new ForbiddenException('Only PMCM can enumerate communication participants');
    const facts = await this.factsReader.findForEvent(eventId);
    const event = facts && toPolicyEvent(facts);
    if (!event) throw new NotFoundException('Event not found');
    const users = await this.prisma.opsUser.findMany({ where: { approvalStatus: 'approved' }, select: { id: true, name: true, email: true, role: true }, orderBy: { id: 'asc' } });
    const eligible = users.filter((user) => this.canResolveRole(user, facts!, event));
    return eligible;
  }

  private canResolveRole(user: { id: string; email: string; role: string }, facts: ParticipantEventFacts, event: ReturnType<typeof toPolicyEvent>) {
    if (user.role === OpsUserRole.PmcmAdmin || user.role === OpsUserRole.System) return true;
    if (user.role === OpsUserRole.Client) return Boolean(event.inquiry?.email && normalizeEmail(event.inquiry.email) === normalizeEmail(user.email));
    if (user.role === OpsUserRole.Supplier) {
      const supplierIds = new Set(facts.suppliers.filter((supplier) => normalizeEmail(supplier.email) === normalizeEmail(user.email)).map(({ id }) => id));
      return facts.supplierAssignments.some((assignment) => assignment.supplierId && supplierIds.has(assignment.supplierId) && activeSupplierStatuses.includes(assignment.status));
    }
    if (user.role === OpsUserRole.Coordinator) {
      const coordinatorIds = new Set(facts.coordinators.filter((coordinator) => coordinator.userId === user.id).map(({ id }) => id));
      return facts.coordinatorAssignments.some((assignment) => assignment.coordinatorId && coordinatorIds.has(assignment.coordinatorId) && assignment.status !== 'cancelled');
    }
    return false;
  }

  private async resolveRole(actor: ResolvedEventOpsActor, role: OpsUserRole, facts: ParticipantEventFacts, eventId: string) {
    const event = toPolicyEvent(facts);
    if (role === OpsUserRole.PmcmAdmin || role === OpsUserRole.System) return actor;
    if (role === OpsUserRole.Client) return this.resolveClient(actor, event);
    if (role === OpsUserRole.Supplier) return this.resolveSupplier(actor, facts, event, eventId);
    if (role === OpsUserRole.Coordinator) return this.resolveCoordinator(actor, facts, event, eventId);
    throw new ForbiddenException('Account role cannot join communication threads');
  }

  private async resolveClient(actor: ResolvedEventOpsActor, event: ReturnType<typeof toPolicyEvent>) {
    const inquiryEmail = event.inquiry?.email;
    if (!inquiryEmail || normalizeEmail(inquiryEmail) !== normalizeEmail(actor.email ?? '')) {
      throw new ForbiddenException('Client is not the primary contact for this event');
    }
    await this.policy.requireCanReadEvent(actor, event, 'communication participant', {});
    return actor;
  }

  private async resolveSupplier(actor: ResolvedEventOpsActor, facts: ParticipantEventFacts, event: ReturnType<typeof toPolicyEvent>, eventId: string) {
    const supplier = facts.suppliers.find(({ email, id }) =>
      normalizeEmail(email) === normalizeEmail(actor.email ?? '') &&
      facts.supplierAssignments.some((request) => request.supplierId === id && activeSupplierStatuses.includes(request.status)),
    );
    if (!supplier) throw new ForbiddenException('Supplier is not assigned to this event');
    actor.supplierId = supplier.id;
    await this.policy.requireCanReadEvent(actor, event, 'communication participant', { supplierEventIds: [eventId] });
    return actor;
  }

  private async resolveCoordinator(actor: ResolvedEventOpsActor, facts: ParticipantEventFacts, event: ReturnType<typeof toPolicyEvent>, eventId: string) {
    const coordinator = facts.coordinators.find(({ userId }) => userId === actor.id);
    const assigned = coordinator && facts.coordinatorAssignments.some((assignment) => assignment.coordinatorId === coordinator.id && assignment.status !== 'cancelled');
    if (!assigned) throw new ForbiddenException('Coordinator is not assigned to this event');
    actor.coordinatorId = coordinator.id;
    actor.eventId = eventId;
    await this.policy.requireCanReadEvent(actor, event, 'communication participant', {});
    return actor;
  }
}
