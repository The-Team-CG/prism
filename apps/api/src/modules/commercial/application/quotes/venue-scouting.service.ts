import { BadRequestException, ForbiddenException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import type { OpsVenueScoutingOption, Prisma } from '@prisma/client';
import { randomUUID } from 'node:crypto';
import { PrismaService } from '@prism/kernel/database';
import { AuditActionType, AuditCategory, OpsUserRole } from '@prism/kernel/event-core';
import { AUDIT_WRITER, EventAccessPolicyService, type AuditWriter, type ResolvedEventOpsActor, writeAudit } from '@prism/kernel/access-control';
import { OPERATIONS_EVENT_REFERENCE_READER, type OperationsEventReferenceReader } from '@prism/contexts/event-lifecycle/operations-reference';
import {
  VENUE_SCOUTING_MIN_OPTIONS,
  type ChooseVenueScoutingPreferenceInput,
  type CreateVenueScoutingOptionInput,
  type PrismVenueScouting,
  type PrismVenueScoutingOption,
} from '@prism/types';
import { isPrimaryClientContact } from '../../domain/proposal-client-review.policy';

function mapOption(row: OpsVenueScoutingOption): PrismVenueScoutingOption {
  return {
    id: row.id, eventId: row.eventId, name: row.name, location: row.location, capacity: row.capacity,
    priceRange: row.priceRange, availableDates: row.availableDates, notes: row.notes,
    status: row.status as PrismVenueScoutingOption['status'],
    clientPreferredAt: row.clientPreferredAt?.toISOString() ?? null,
    clientPreferenceNote: row.clientPreferenceNote, createdAt: row.createdAt.toISOString(),
  };
}

/** FR-10: PMCM scouts venues for a client without one; the client sees the published shortlist and marks one preference. */
@Injectable()
export class VenueScoutingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: EventAccessPolicyService,
    @Inject(AUDIT_WRITER) private readonly auditWriter: AuditWriter,
    @Inject(OPERATIONS_EVENT_REFERENCE_READER) private readonly events: OperationsEventReferenceReader,
  ) {}

  async get(eventId: string, actor: ResolvedEventOpsActor): Promise<PrismVenueScouting> {
    await this.access.requireActorRole(actor, [OpsUserRole.Client, OpsUserRole.PmcmAdmin], 'venue scouting', eventId);
    if (actor.role === OpsUserRole.Client) await this.requirePrimaryClient(eventId, actor);
    const statuses = actor.role === OpsUserRole.Client ? ['published'] : ['draft', 'published'];
    return this.read(this.prisma, eventId, statuses);
  }

  async addOption(eventId: string, input: CreateVenueScoutingOptionInput, actor: ResolvedEventOpsActor): Promise<PrismVenueScoutingOption> {
    await this.requirePmcm(eventId, actor);
    const row = await this.prisma.opsVenueScoutingOption.create({ data: {
      id: `venue_option_${randomUUID()}`, eventId, name: input.name, location: input.location, capacity: input.capacity,
      priceRange: input.priceRange, availableDates: input.availableDates, notes: input.notes ?? '', createdBy: actor.id ?? actor.name,
    } });
    await this.audit(eventId, actor, `Added venue option: ${row.name}`, AuditActionType.Create, row.id);
    return mapOption(row);
  }

  /** Publishes every draft once the shortlist has the minimum number of options. */
  async publish(eventId: string, actor: ResolvedEventOpsActor): Promise<PrismVenueScouting> {
    await this.requirePmcm(eventId, actor);
    return this.prisma.$transaction(async (tx) => {
      const active = await tx.opsVenueScoutingOption.count({ where: { eventId, status: { in: ['draft', 'published'] } } });
      if (active < VENUE_SCOUTING_MIN_OPTIONS) throw new BadRequestException(`Add at least ${VENUE_SCOUTING_MIN_OPTIONS} venue options before sharing them with the client`);
      const result = await tx.opsVenueScoutingOption.updateMany({ where: { eventId, status: 'draft' }, data: { status: 'published' } });
      if (result.count === 0) throw new BadRequestException('There are no new venue options to share');
      await this.audit(eventId, actor, `Shared ${result.count} venue options with the client`, AuditActionType.Update, eventId, tx);
      return this.read(tx, eventId, ['draft', 'published']);
    }, { isolationLevel: 'Serializable' });
  }

  async withdraw(eventId: string, optionId: string, actor: ResolvedEventOpsActor): Promise<PrismVenueScoutingOption> {
    await this.requirePmcm(eventId, actor);
    const existing = await this.prisma.opsVenueScoutingOption.findFirst({ where: { id: optionId, eventId } });
    if (!existing) throw new NotFoundException('Venue option not found');
    const row = await this.prisma.opsVenueScoutingOption.update({ where: { id: optionId }, data: { status: 'withdrawn', clientPreferredAt: null } });
    await this.audit(eventId, actor, `Withdrew venue option: ${row.name}`, AuditActionType.Update, row.id);
    return mapOption(row);
  }

  /** The primary client contact marks one published option as preferred; any earlier preference is cleared. */
  async choosePreference(eventId: string, input: ChooseVenueScoutingPreferenceInput, actor: ResolvedEventOpsActor): Promise<PrismVenueScouting> {
    await this.access.requireActorRole(actor, [OpsUserRole.Client], 'venue preference', eventId);
    await this.requirePrimaryClient(eventId, actor);
    return this.prisma.$transaction(async (tx) => {
      const option = await tx.opsVenueScoutingOption.findFirst({ where: { id: input.optionId, eventId, status: 'published' } });
      if (!option) throw new NotFoundException('Venue option not found');
      await tx.opsVenueScoutingOption.updateMany({ where: { eventId, clientPreferredAt: { not: null } }, data: { clientPreferredAt: null, clientPreferenceNote: '' } });
      await tx.opsVenueScoutingOption.update({ where: { id: option.id }, data: { clientPreferredAt: new Date(), clientPreferenceNote: input.note ?? '' } });
      await this.audit(eventId, actor, `Client prefers venue option: ${option.name}`, AuditActionType.Update, option.id, tx);
      return this.read(tx, eventId, ['published']);
    }, { isolationLevel: 'Serializable' });
  }

  private async read(db: Prisma.TransactionClient | PrismaService, eventId: string, statuses: string[]): Promise<PrismVenueScouting> {
    const rows = await db.opsVenueScoutingOption.findMany({ where: { eventId, status: { in: statuses } }, orderBy: [{ createdAt: 'asc' }, { id: 'asc' }], take: 50 });
    const options = rows.map(mapOption);
    return { eventId, options, preferredOptionId: options.find((option) => option.clientPreferredAt)?.id ?? null };
  }

  private async requirePmcm(eventId: string, actor: ResolvedEventOpsActor) {
    await this.access.requireActorRole(actor, [OpsUserRole.PmcmAdmin], 'venue scouting', eventId);
    const event = await this.events.findOperationsEvent(eventId);
    if (!event) throw new NotFoundException('Event not found');
    if (event.archived) throw new BadRequestException('Archived events cannot change venue scouting');
  }

  private async requirePrimaryClient(eventId: string, actor: ResolvedEventOpsActor) {
    const event = await this.events.findEventReadAccess(eventId);
    if (!event) throw new NotFoundException('Event not found');
    await this.access.requireCanReadEvent(actor, { ...event, inquiry: { email: event.inquiry?.email ?? '' } }, 'venue scouting');
    if (!isPrimaryClientContact(actor.email ?? '', event.inquiry?.email ?? '')) throw new ForbiddenException('Only the primary client contact can choose a venue');
  }

  private audit(eventId: string, actor: ResolvedEventOpsActor, action: string, actionType: string, affectedId: string, tx?: Prisma.TransactionClient) {
    return writeAudit(this.auditWriter, eventId, actor.name, action, {
      actorRole: actor.role, actorEmail: actor.email, category: AuditCategory.Events, actionType,
      affectedType: 'venue_scouting_option', affectedId, metadata: { actorId: actor.id ?? null },
    }, tx ? { prisma: tx, correlationId: `venue-scouting:${eventId}:${affectedId}`, actorId: actor.id } : undefined);
  }
}
