import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { AUDIT_WRITER, type AuditWriter, type ResolvedEventOpsActor, writeAudit } from '@prism/kernel/access-control';
import { PrismaService } from '@prism/kernel/database';
import { AuditActionType, AuditCategory } from '@prism/kernel/event-core';
import type { SetEventPrivacyInput } from '@prism/types';

@Injectable()
export class EventPrivacyService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(AUDIT_WRITER) private readonly auditWriter: AuditWriter,
  ) {}

  /** PMCM sets whether the event is private or public. Public events cannot use table assignment or the seating list. */
  async setEventPrivacy(eventId: string, input: SetEventPrivacyInput, actor: ResolvedEventOpsActor) {
    return this.prisma.$transaction(async (tx) => {
      const event = await tx.opsEvent.findUnique({ where: { id: eventId }, select: { id: true, archived: true, privacy: true } });
      if (!event) throw new NotFoundException('Event not found');
      if (event.archived) throw new BadRequestException('Archived events cannot change privacy');
      if (event.privacy === input.privacy) return { eventId, privacy: input.privacy };
      await tx.opsEvent.update({ where: { id: eventId }, data: { privacy: input.privacy } });
      await writeAudit(this.auditWriter, eventId, actor.name, `Set event privacy to ${input.privacy}`, {
        actorRole: actor.role,
        actorEmail: actor.email,
        category: AuditCategory.Events,
        actionType: AuditActionType.Update,
        affectedType: 'event',
        affectedId: eventId,
        affectedLabel: 'Event privacy',
        metadata: { from: event.privacy, to: input.privacy, actorId: actor.id ?? null },
      }, { prisma: tx, correlationId: `event-privacy:${eventId}`, actorId: actor.id });
      return { eventId, privacy: input.privacy };
    }, { isolationLevel: 'Serializable' });
  }
}
