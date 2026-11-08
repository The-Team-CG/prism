import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import type { OpsLogisticsBooking } from '@prisma/client';
import { createHash, randomUUID } from 'node:crypto';
import { PrismaService, toPrismaJson } from '@prism/kernel/database';
import { AuditActionType, AuditCategory, OpsUserRole } from '@prism/kernel/event-core';
import { AUDIT_WRITER, EventAccessPolicyService, type AuditWriter, type ResolvedEventOpsActor, writeAudit } from '@prism/kernel/access-control';
import { LOGISTICS_PROVIDER_LABELS, type CreateLogisticsBookingInput, type PrismLogisticsBooking } from '@prism/types';

function mapBooking(row: OpsLogisticsBooking): PrismLogisticsBooking {
  return {
    id: row.id, eventId: row.eventId, provider: row.provider as PrismLogisticsBooking['provider'], bookingReference: row.bookingReference,
    description: row.description, amount: row.amount, billingSourceId: row.billingSourceId, createdBy: row.createdBy, createdAt: row.createdAt.toISOString(),
  };
}

/** New-P4: PMCM records the courier booking for returning client assets; a priced booking raises a draft logistics billing source. */
@Injectable()
export class LogisticsBookingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: EventAccessPolicyService,
    @Inject(AUDIT_WRITER) private readonly auditWriter: AuditWriter,
  ) {}

  async list(eventId: string, actor: ResolvedEventOpsActor): Promise<PrismLogisticsBooking[]> {
    await this.access.requireActorRole(actor, [OpsUserRole.PmcmAdmin], 'logistics bookings', eventId);
    const rows = await this.prisma.opsLogisticsBooking.findMany({ where: { eventId }, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }], take: 100 });
    return rows.map(mapBooking);
  }

  async create(eventId: string, input: CreateLogisticsBookingInput, actor: ResolvedEventOpsActor): Promise<PrismLogisticsBooking> {
    await this.access.requireActorRole(actor, [OpsUserRole.PmcmAdmin], 'logistics bookings', eventId);
    const event = await this.prisma.opsEvent.findUnique({ where: { id: eventId }, select: { id: true } });
    if (!event) throw new NotFoundException('Event not found');
    const bookingId = `logi_${randomUUID()}`;
    const label = `${LOGISTICS_PROVIDER_LABELS[input.provider]} ${input.bookingReference}: ${input.description}`.slice(0, 200);
    return this.prisma.$transaction(async (tx) => {
      const source = input.amount > 0 ? await tx.opsBillingSource.create({ data: {
        id: `bsrc_${randomUUID()}`, eventId, sourceType: 'logistics', sourceLabel: `Logistics: ${label}`, sourceDocumentId: null,
        lineItems: toPrismaJson([{ label, amount: input.amount }]),
        paymentSchedule: toPrismaJson([{ label: 'Logistics', percentage: 100, dueDate: new Date().toISOString().slice(0, 10) }]),
        paymentMethods: toPrismaJson([]), totalAmount: input.amount, status: 'draft', paymentTermsPolicyState: 'standard',
        idempotencyKey: `logistics-booking:${bookingId}`,
        payloadHash: createHash('sha256').update(JSON.stringify({ eventId, bookingId, amount: input.amount })).digest('hex'),
      } }) : null;
      const row = await tx.opsLogisticsBooking.create({ data: {
        id: bookingId, eventId, provider: input.provider, bookingReference: input.bookingReference, description: input.description,
        amount: input.amount, billingSourceId: source?.id ?? null, createdBy: actor.name,
      } });
      await writeAudit(this.auditWriter, eventId, actor.name, `Recorded logistics booking ${input.bookingReference}`, {
        actorRole: actor.role, actorEmail: actor.email, category: AuditCategory.Finance, actionType: AuditActionType.Create,
        affectedType: 'logistics_booking', affectedId: row.id, metadata: { amount: input.amount, billingSourceId: source?.id ?? null, actorId: actor.id ?? null },
      }, { prisma: tx, correlationId: `logistics-booking:${row.id}`, actorId: actor.id });
      return mapBooking(row);
    });
  }
}
