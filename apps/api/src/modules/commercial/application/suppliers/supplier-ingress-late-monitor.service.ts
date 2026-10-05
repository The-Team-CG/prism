import { Inject, Injectable, Logger } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
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
}
