import { BadRequestException, ForbiddenException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import type { OpsClientOwnedSupplier } from '@prisma/client';
import { randomUUID } from 'node:crypto';
import { PrismaService } from '@prism/kernel/database';
import { AuditActionType, AuditCategory, OpsUserRole } from '@prism/kernel/event-core';
import { AUDIT_WRITER, EventAccessPolicyService, type AuditWriter, type ResolvedEventOpsActor, writeAudit } from '@prism/kernel/access-control';
import { OPERATIONS_EVENT_REFERENCE_READER, type OperationsEventReferenceReader } from '@prism/contexts/event-lifecycle/operations-reference';
import type { CreateClientOwnedSupplierInput, PrismClientOwnedSupplier, RaiseClientSupplierRiskInput } from '@prism/types';
import { isPrimaryClientContact } from '../../domain/proposal-client-review.policy';

function mapSupplier(row: OpsClientOwnedSupplier): PrismClientOwnedSupplier {
  return {
    id: row.id, eventId: row.eventId, category: row.category, supplierName: row.supplierName, contact: row.contact,
    operationalNotes: row.operationalNotes, status: row.status === 'confirmed' ? 'confirmed' : 'pending',
    confirmedAt: row.confirmedAt?.toISOString() ?? null, riskWarning: row.riskWarning, riskRaisedBy: row.riskRaisedBy, createdAt: row.createdAt.toISOString(),
  };
}

/** FR-65: the client coordinates its own supplier and confirms it; PMCM sees the operational details and can raise a risk warning. */
@Injectable()
export class ClientOwnedSupplierService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: EventAccessPolicyService,
    @Inject(AUDIT_WRITER) private readonly auditWriter: AuditWriter,
    @Inject(OPERATIONS_EVENT_REFERENCE_READER) private readonly events: OperationsEventReferenceReader,
  ) {}

  async list(eventId: string, actor: ResolvedEventOpsActor): Promise<PrismClientOwnedSupplier[]> {
    await this.access.requireActorRole(actor, [OpsUserRole.Client, OpsUserRole.PmcmAdmin], 'client-owned suppliers', eventId);
    if (actor.role === OpsUserRole.Client) await this.requirePrimaryClient(eventId, actor);
    const rows = await this.prisma.opsClientOwnedSupplier.findMany({ where: { eventId }, orderBy: [{ createdAt: 'asc' }, { id: 'asc' }], take: 100 });
    return rows.map(mapSupplier);
  }

  async create(eventId: string, input: CreateClientOwnedSupplierInput, actor: ResolvedEventOpsActor): Promise<PrismClientOwnedSupplier> {
    await this.access.requireActorRole(actor, [OpsUserRole.Client], 'client-owned supplier', eventId);
    await this.requirePrimaryClient(eventId, actor);
    const row = await this.prisma.opsClientOwnedSupplier.create({ data: {
      id: `cos_${randomUUID()}`, eventId, category: input.category, supplierName: input.supplierName, contact: input.contact ?? '',
      operationalNotes: input.operationalNotes ?? '', createdBy: actor.id ?? actor.name,
    } });
    await this.audit(eventId, actor, `Client added own supplier: ${row.supplierName} (${row.category})`, AuditActionType.Create, row.id);
    return mapSupplier(row);
  }

  async confirm(eventId: string, supplierId: string, actor: ResolvedEventOpsActor): Promise<PrismClientOwnedSupplier> {
    await this.access.requireActorRole(actor, [OpsUserRole.Client], 'client-owned supplier', eventId);
    await this.requirePrimaryClient(eventId, actor);
    const existing = await this.requireRow(eventId, supplierId);
    if (existing.status === 'confirmed') return mapSupplier(existing);
    const row = await this.prisma.opsClientOwnedSupplier.update({ where: { id: supplierId }, data: { status: 'confirmed', confirmedAt: new Date() } });
    await this.audit(eventId, actor, `Client confirmed own supplier: ${row.supplierName}`, AuditActionType.Update, row.id);
    return mapSupplier(row);
  }

  async raiseRisk(eventId: string, supplierId: string, input: RaiseClientSupplierRiskInput, actor: ResolvedEventOpsActor): Promise<PrismClientOwnedSupplier> {
    await this.access.requireActorRole(actor, [OpsUserRole.PmcmAdmin], 'client-owned supplier risk', eventId);
    await this.requireRow(eventId, supplierId);
    const row = await this.prisma.opsClientOwnedSupplier.update({ where: { id: supplierId }, data: { riskWarning: input.warning, riskRaisedBy: actor.name } });
    await this.audit(eventId, actor, `Risk warning on client-owned supplier ${row.supplierName}: ${input.warning}`, AuditActionType.Update, row.id);
    return mapSupplier(row);
  }

  private async requireRow(eventId: string, supplierId: string) {
    const row = await this.prisma.opsClientOwnedSupplier.findFirst({ where: { id: supplierId, eventId } });
    if (!row) throw new NotFoundException('Client-owned supplier not found');
    return row;
  }

  private async requirePrimaryClient(eventId: string, actor: ResolvedEventOpsActor) {
    const event = await this.events.findEventReadAccess(eventId);
    if (!event) throw new NotFoundException('Event not found');
    await this.access.requireCanReadEvent(actor, { ...event, inquiry: { email: event.inquiry?.email ?? '' } }, 'client-owned suppliers');
    if (!isPrimaryClientContact(actor.email ?? '', event.inquiry?.email ?? '')) throw new ForbiddenException('Only the primary client contact can manage client-owned suppliers');
    if (event.clientPortalStatus !== 'unlocked') throw new BadRequestException('Client-owned suppliers need an unlocked event');
  }

  private audit(eventId: string, actor: ResolvedEventOpsActor, action: string, actionType: string, affectedId: string) {
    return writeAudit(this.auditWriter, eventId, actor.name, action, {
      actorRole: actor.role, actorEmail: actor.email, category: AuditCategory.Suppliers, actionType,
      affectedType: 'client_owned_supplier', affectedId, metadata: { actorId: actor.id ?? null },
    });
  }
}
