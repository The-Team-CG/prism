import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import type { OpsExternalCreativeTicket } from '@prisma/client';
import { randomUUID } from 'node:crypto';
import { PrismaService } from '@prism/kernel/database';
import { AUDIT_WRITER, type AuditWriter, type ResolvedEventOpsActor, writeAudit } from '@prism/kernel/access-control';
import { AuditActionType, AuditCategory } from '@prism/kernel/event-core';
import {
  OPERATIONS_EVENT_REFERENCE_READER,
  type OperationsEventReferenceReader,
} from '@prism/contexts/event-lifecycle/operations-reference';
import type {
  CompleteExternalCreativeTicketInput,
  CreateExternalCreativeTicketInput,
  PrismExternalCreativeTicket,
  UpdateExternalCreativeTicketInput,
} from '@prism/types';

function mapTicket(row: OpsExternalCreativeTicket): PrismExternalCreativeTicket {
  return {
    id: row.id,
    eventId: row.eventId,
    designerName: row.designerName,
    designerContact: row.designerContact,
    deliverable: row.deliverable,
    dueDate: row.dueDate?.toISOString().slice(0, 10) ?? null,
    status: row.status as PrismExternalCreativeTicket['status'],
    progressNote: row.progressNote,
    outputDocumentId: row.outputDocumentId,
    outputFileName: row.outputFileName,
    completedAt: row.completedAt?.toISOString() ?? null,
    completedBy: row.completedBy,
    updatedAt: row.updatedAt.toISOString(),
  };
}

/** FR-87: PMCM tracks an outsourced designer's deliverable; the designer never touches Prism. */
@Injectable()
export class ExternalCreativeTicketService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(AUDIT_WRITER) private readonly auditWriter: AuditWriter,
    @Inject(OPERATIONS_EVENT_REFERENCE_READER) private readonly eventReferences: OperationsEventReferenceReader,
  ) {}

  async list(eventId: string): Promise<PrismExternalCreativeTicket[]> {
    // QUERY_AUDIT_ALLOW_UNBOUNDED: one event's outsourced creative tickets.
    const rows = await this.prisma.opsExternalCreativeTicket.findMany({ where: { eventId }, orderBy: [{ createdAt: 'asc' }, { id: 'asc' }] });
    return rows.map(mapTicket);
  }

  private async requireActiveEvent(eventId: string) {
    const event = await this.eventReferences.findOperationsEvent(eventId);
    if (!event) throw new NotFoundException('Event not found');
    if (event.archived) throw new BadRequestException('Archived events cannot change creative tickets');
  }

  private async audit(ticket: OpsExternalCreativeTicket, actor: ResolvedEventOpsActor, action: string, actionType: string) {
    await writeAudit(this.auditWriter, ticket.eventId, actor.name, action, {
      actorRole: actor.role,
      actorEmail: actor.email,
      category: AuditCategory.Suppliers,
      actionType,
      affectedType: 'external_creative_ticket',
      affectedId: ticket.id,
      affectedLabel: ticket.designerName,
      metadata: { status: ticket.status, actorId: actor.id ?? null },
    });
  }

  async create(eventId: string, input: CreateExternalCreativeTicketInput, actor: ResolvedEventOpsActor) {
    await this.requireActiveEvent(eventId);
    const row = await this.prisma.opsExternalCreativeTicket.create({ data: {
      id: `ect_${randomUUID()}`,
      eventId,
      designerName: input.designerName.trim(),
      designerContact: input.designerContact?.trim() ?? '',
      deliverable: input.deliverable.trim(),
      dueDate: input.dueDate ? new Date(`${input.dueDate}T00:00:00.000Z`) : null,
      createdBy: actor.name,
    } });
    await this.audit(row, actor, `Opened outsourced creative ticket for ${row.designerName}`, AuditActionType.Create);
    return mapTicket(row);
  }

  private async requireOpenTicket(eventId: string, ticketId: string) {
    const ticket = await this.prisma.opsExternalCreativeTicket.findFirst({ where: { id: ticketId, eventId } });
    if (!ticket) throw new NotFoundException('Creative ticket not found');
    if (ticket.status === 'completed') throw new BadRequestException('This creative ticket is already completed');
    return ticket;
  }

  async update(eventId: string, ticketId: string, input: UpdateExternalCreativeTicketInput, actor: ResolvedEventOpsActor) {
    await this.requireActiveEvent(eventId);
    await this.requireOpenTicket(eventId, ticketId);
    const row = await this.prisma.opsExternalCreativeTicket.update({ where: { id: ticketId }, data: { status: input.status, progressNote: input.progressNote } });
    await this.audit(row, actor, `Updated outsourced creative ticket for ${row.designerName}: ${input.status.replace('_', ' ')}`, AuditActionType.Update);
    return mapTicket(row);
  }

  async complete(eventId: string, ticketId: string, input: CompleteExternalCreativeTicketInput, actor: ResolvedEventOpsActor) {
    await this.requireActiveEvent(eventId);
    await this.requireOpenTicket(eventId, ticketId);
    // The finished output must already be in this event's file hub.
    const document = await this.prisma.opsDocument.findFirst({ where: { id: input.outputDocumentId, eventId }, select: { id: true, fileName: true } });
    if (!document) throw new BadRequestException('Upload the finished creative output to this event\'s files first');
    const row = await this.prisma.opsExternalCreativeTicket.update({ where: { id: ticketId }, data: {
      status: 'completed', outputDocumentId: document.id, outputFileName: document.fileName, completedAt: new Date(), completedBy: actor.name,
    } });
    await this.audit(row, actor, `Completed outsourced creative ticket for ${row.designerName}`, AuditActionType.Update);
    return mapTicket(row);
  }
}
