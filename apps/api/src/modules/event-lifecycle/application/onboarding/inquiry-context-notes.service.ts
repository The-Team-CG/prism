import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import type { OpsInquiryContextNote } from '@prisma/client';
import { randomUUID } from 'node:crypto';
import { PrismaService } from '@prism/kernel/database';
import { AuditActionType, AuditCategory, OpsUserRole } from '@prism/kernel/event-core';
import { AUDIT_WRITER, EventAccessPolicyService, type AuditWriter, type ResolvedEventOpsActor, writeAudit } from '@prism/kernel/access-control';
import type { CreateInquiryContextNoteInput, PrismInquiryContextNote } from '@prism/types';

function mapNote(row: OpsInquiryContextNote): PrismInquiryContextNote {
  return {
    id: row.id, inquiryId: row.inquiryId, kind: row.kind as PrismInquiryContextNote['kind'], body: row.body,
    followUpAt: row.followUpAt?.toISOString() ?? null, createdBy: row.createdBy, createdAt: row.createdAt.toISOString(),
  };
}

/** FR-53: PMCM's pre-conforme notes log on an inquiry, carried into the event workspace as Pre-Conforme Context. */
@Injectable()
export class InquiryContextNotesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: EventAccessPolicyService,
    @Inject(AUDIT_WRITER) private readonly auditWriter: AuditWriter,
  ) {}

  async list(inquiryId: string, actor: ResolvedEventOpsActor): Promise<PrismInquiryContextNote[]> {
    await this.access.requireActorRole(actor, [OpsUserRole.PmcmAdmin], 'pre-conforme notes');
    return this.notesFor(inquiryId);
  }

  async add(inquiryId: string, input: CreateInquiryContextNoteInput, actor: ResolvedEventOpsActor): Promise<PrismInquiryContextNote> {
    await this.access.requireActorRole(actor, [OpsUserRole.PmcmAdmin], 'pre-conforme notes');
    const inquiry = await this.prisma.opsInquiry.findUnique({ where: { id: inquiryId }, select: { id: true } });
    if (!inquiry) throw new NotFoundException('Inquiry not found');
    const row = await this.prisma.opsInquiryContextNote.create({ data: {
      id: `icn_note_${randomUUID()}`, inquiryId, kind: input.kind, body: input.body,
      followUpAt: input.followUpAt ? new Date(input.followUpAt) : null, createdBy: actor.name,
    } });
    await writeAudit(this.auditWriter, undefined, actor.name, `Added pre-conforme ${input.kind.replace('_', ' ')}`, {
      actorRole: actor.role, actorEmail: actor.email, category: AuditCategory.Events, actionType: AuditActionType.Create,
      affectedType: 'inquiry', affectedId: inquiryId, metadata: { noteId: row.id, actorId: actor.id ?? null },
    });
    return mapNote(row);
  }

  /** The event's inquiry notes, read once the event workspace exists. */
  async forEvent(eventId: string, actor: ResolvedEventOpsActor): Promise<PrismInquiryContextNote[]> {
    await this.access.requireActorRole(actor, [OpsUserRole.PmcmAdmin], 'pre-conforme context', eventId);
    const event = await this.prisma.opsEvent.findUnique({ where: { id: eventId }, select: { inquiryId: true } });
    if (!event) throw new NotFoundException('Event not found');
    return this.notesFor(event.inquiryId);
  }

  private async notesFor(inquiryId: string) {
    const rows = await this.prisma.opsInquiryContextNote.findMany({ where: { inquiryId }, orderBy: [{ createdAt: 'asc' }, { id: 'asc' }], take: 200 });
    return rows.map(mapNote);
  }
}
