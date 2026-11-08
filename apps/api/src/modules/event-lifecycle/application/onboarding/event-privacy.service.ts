import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { AUDIT_WRITER, type AuditWriter, type ResolvedEventOpsActor, writeAudit } from '@prism/kernel/access-control';
import { PrismaService } from '@prism/kernel/database';
import { AuditActionType, AuditCategory } from '@prism/kernel/event-core';
import type { SetEventModulesInput, SetEventPrivacyInput } from '@prism/types';

@Injectable()
export class EventPrivacyService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(AUDIT_WRITER) private readonly auditWriter: AuditWriter,
  ) {}

  /** FR-24: PMCM switches optional modules off (or back on) for one event. */
  async setEventModules(eventId: string, input: SetEventModulesInput, actor: ResolvedEventOpsActor) {
    const event = await this.prisma.opsEvent.findUnique({ where: { id: eventId }, select: { id: true, archived: true, disabledModules: true } });
    if (!event) throw new NotFoundException('Event not found');
    if (event.archived) throw new BadRequestException('Archived events cannot change modules');
    await this.prisma.opsEvent.update({ where: { id: eventId }, data: { disabledModules: input.disabledModules } });
    await writeAudit(this.auditWriter, eventId, actor.name, input.disabledModules.length ? `Switched off modules: ${input.disabledModules.join(', ')}` : 'Switched every module on', {
      actorRole: actor.role, actorEmail: actor.email, category: AuditCategory.Events, actionType: AuditActionType.Update,
      affectedType: 'event', affectedId: eventId, affectedLabel: 'Event modules',
      metadata: { from: event.disabledModules, to: input.disabledModules, actorId: actor.id ?? null },
    });
    return { eventId, disabledModules: input.disabledModules };
  }

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
