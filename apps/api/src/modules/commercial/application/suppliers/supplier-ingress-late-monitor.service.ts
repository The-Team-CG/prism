import { Inject, Injectable, Logger } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { randomUUID } from 'node:crypto';
import { PrismaService } from '@prism/kernel/database';
import { AuditActionType, AuditCategory, OpsUserRole } from '@prism/kernel/event-core';
import {
  AUDIT_WRITER,
  EventAccessPolicyService,
  type AuditWriter,
  type ResolvedEventOpsActor,
  writeAudit,
} from '@prism/kernel/access-control';
import { supplierIngressLateGraceMinutes } from './supplier-ingress-late-policy';

const MAX_INGRESS_SCHEDULES_PER_PAGE = 500;
const MAX_INGRESS_PAGES_PER_RUN = 2;
const UNREPORTED_EVENT_DAY_STATUSES = ['not_started', 'planned'];
/** Hours after the late flag with no arrival before the booking counts as a no-show. */
export const SUPPLIER_NO_SHOW_HOURS = 12;

async function lockSupplierSchedule(prisma: Prisma.TransactionClient, scheduleId: string) {
  await prisma.$queryRaw`SELECT id FROM "commercial"."supplier_schedules" WHERE id = ${scheduleId} FOR UPDATE`; // QUERY_AUDIT_RAW_SQL: parameterized row lock serializes late marking against schedule changes.
}

function isLateEligibleStatus(status: string) {
  return UNREPORTED_EVENT_DAY_STATUSES.includes(status);
}

@Injectable()
export class SupplierIngressLateMonitorService {
  private readonly logger = new Logger(SupplierIngressLateMonitorService.name);

  constructor(
    private readonly prisma: PrismaService,
    @Inject(AUDIT_WRITER) private readonly auditWriter: AuditWriter,
    private readonly eventAccessPolicyService: EventAccessPolicyService,
  ) {}

  async markLateSupplierIngresses(actor: ResolvedEventOpsActor, now = new Date()) {
    await this.eventAccessPolicyService.requireActorRole(
      actor,
      [OpsUserRole.System],
      'supplier ingress late monitor',
    );
    const graceMinutes = supplierIngressLateGraceMinutes();
    const dueBefore = new Date(now.getTime() - graceMinutes * 60_000);
    let cursorAfter: string | undefined;
    let marked = 0;

    for (let pageNumber = 0; pageNumber < MAX_INGRESS_PAGES_PER_RUN; pageNumber += 1) { // QUERY_AUDIT_ALLOW_BOUNDED_LOOP: at most two stable-ID keyset pages per scheduled run.
      const schedules = await this.prisma.opsSupplierSchedule.findMany({
        where: {
          ...(cursorAfter ? { id: { gt: cursorAfter } } : {}),
          status: 'planned',
          ingressAt: { lte: dueBefore },
          request: {
            is: {
              status: 'selected',
              assignmentStatus: 'confirmed',
              eventDayStatus: { in: UNREPORTED_EVENT_DAY_STATUSES },
            },
          },
        },
        orderBy: { id: 'asc' },
        take: MAX_INGRESS_SCHEDULES_PER_PAGE,
      });

      for (const candidate of schedules) { // QUERY_AUDIT_ALLOW_BOUNDED_LOOP: each candidate is locked, rechecked, updated, and audited atomically.
        try {
          const wasMarked = await this.prisma.$transaction(async (tx: Prisma.TransactionClient) => {
            await lockSupplierSchedule(tx, candidate.id);
            const current = await tx.opsSupplierSchedule.findUnique({
              where: { id: candidate.id },
              include: { request: true },
            });
            if (
              !current ||
              current.status !== 'planned' ||
              current.ingressAt > dueBefore ||
              current.request.status !== 'selected' ||
              current.request.assignmentStatus !== 'confirmed' ||
              !isLateEligibleStatus(current.request.eventDayStatus)
            ) {
              return false;
            }

            const changed = await tx.opsSupplierQuoteRequest.updateMany({
              where: {
                id: current.requestId,
                eventId: current.eventId,
                status: 'selected',
                assignmentStatus: 'confirmed',
                eventDayStatus: { in: UNREPORTED_EVENT_DAY_STATUSES },
              },
              data: { eventDayStatus: 'late', eventDayStatusAt: now },
            });
            if (changed.count !== 1) return false;

            await writeAudit(
              this.auditWriter,
              current.eventId,
              actor.name,
              `Supplier ingress late: ${current.request.supplierName}`,
              {
                actorRole: actor.role,
                actorEmail: actor.email,
                actionType: AuditActionType.Update,
                category: AuditCategory.Suppliers,
                affectedType: 'supplier_quote_request',
                affectedId: current.requestId,
                affectedLabel: current.request.supplierName,
                severity: 'warning',
                metadata: {
                  eventDayStatus: 'late',
                  ingressAt: current.ingressAt.toISOString(),
                  graceMinutes,
                  markedAt: now.toISOString(),
                },
              },
              { prisma: tx, actorId: actor.id, correlationId: `supplier-ingress-late:${current.requestId}:${current.ingressAt.toISOString()}` },
            );

            // A missed ingress is a reliability fact for future supplier selection (FR-79). The request moves to
            // late only once, so the idempotency key keeps the note to one per booking.
            if (current.request.supplierId) {
              const event = await tx.opsEvent.findUnique({ where: { id: current.eventId }, select: { eventName: true } });
              const noteKey = `supplier-ingress-late-note:${current.requestId}`;
              await tx.opsSupplierReliabilityNote.upsert({
                where: { idempotencyKey: noteKey },
                update: {},
                create: {
                  id: `reliability_${randomUUID()}`,
                  supplierId: current.request.supplierId,
                  eventId: current.eventId,
                  note: `Ingress late at ${event?.eventName ?? 'an event'} (${current.request.category}): no arrival reported after the ${current.ingressAt.toISOString()} window start`,
                  createdBy: actor.name,
                  idempotencyKey: noteKey,
                },
              });
            }
            return true;
          });
          if (wasMarked) marked += 1;
        } catch (error) {
          this.logger.warn(
            `Supplier ingress late flag skipped for schedule ${candidate.id}: ${error instanceof Error ? error.message : String(error)}`,
          );
        }
      }

      if (schedules.length < MAX_INGRESS_SCHEDULES_PER_PAGE) break;
      cursorAfter = schedules[schedules.length - 1].id;
    }

    return { graceMinutes, marked };
  }

  /**
   * FR-79: a supplier still flagged late SUPPLIER_NO_SHOW_HOURS after the late flag never reported arriving, so the
   * booking is recorded once as a no-show on the supplier profile. The event-day status itself is left as late.
   */
  async noteSupplierNoShows(actor: ResolvedEventOpsActor, now = new Date()) {
    await this.eventAccessPolicyService.requireActorRole(actor, [OpsUserRole.System], 'supplier no-show monitor');
    const cutoff = new Date(now.getTime() - SUPPLIER_NO_SHOW_HOURS * 3_600_000);
    const requests = await this.prisma.opsSupplierQuoteRequest.findMany({
      where: { status: 'selected', assignmentStatus: 'confirmed', eventDayStatus: 'late', eventDayStatusAt: { lte: cutoff }, supplierId: { not: null } },
      select: { id: true, eventId: true, supplierId: true, supplierName: true, category: true },
      orderBy: { id: 'asc' },
      take: MAX_INGRESS_SCHEDULES_PER_PAGE,
    });
    let noted = 0;
    // QUERY_AUDIT_ALLOW_BOUNDED_LOOP: capped by the take above; each note is idempotent per booking.
    for (const request of requests) {
      const noteKey = `supplier-no-show-note:${request.id}`;
      const existing = await this.prisma.opsSupplierReliabilityNote.findUnique({ where: { idempotencyKey: noteKey }, select: { id: true } });
      if (existing) continue;
      const event = await this.prisma.opsEvent.findUnique({ where: { id: request.eventId }, select: { eventName: true } });
      await this.prisma.opsSupplierReliabilityNote.create({ data: {
        id: `reliability_${randomUUID()}`, supplierId: request.supplierId!, eventId: request.eventId,
        note: `No-show at ${event?.eventName ?? 'an event'} (${request.category}): never reported arriving after being flagged late`,
        createdBy: actor.name, idempotencyKey: noteKey,
      } });
      await writeAudit(this.auditWriter, request.eventId, actor.name, `Supplier no-show: ${request.supplierName}`, {
        actorRole: actor.role, actorEmail: actor.email, actionType: AuditActionType.Update, category: AuditCategory.Suppliers,
        affectedType: 'supplier_quote_request', affectedId: request.id, affectedLabel: request.supplierName, severity: 'warning',
        metadata: { noShowAfterHours: SUPPLIER_NO_SHOW_HOURS },
      });
      noted += 1;
    }
    return { noted };
  }
}
