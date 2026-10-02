import { Injectable } from '@nestjs/common';
import type { OpsAuditLog, Prisma } from '@prisma/client';
import { PrismaService } from '@prism/kernel/database';
import type { AuditLogFilters } from '@prism/types';
import { mapAuditLog } from './audit.mappers';

type AuditReadFilters = AuditLogFilters & {
  from?: string;
  to?: string;
};

const AUDIT_EQUAL_FILTERS = ['category', 'eventId', 'actor', 'actionType', 'severity'] as const;
const DATE_RANGE_DAYS: Record<string, number> = { '24h': 1, '7d': 7, '30d': 30 };

function applyAuditEqualFilters(where: Prisma.OpsAuditLogWhereInput, input: AuditReadFilters) {
  for (const key of AUDIT_EQUAL_FILTERS) {
    const value = input[key];
    if (value && value !== 'all') where[key] = value;
  }
}

function applyAuditQuery(where: Prisma.OpsAuditLogWhereInput, query?: string) {
  if (!query) return;
  where.OR = [
    { actor: { contains: query, mode: 'insensitive' } },
    { action: { contains: query, mode: 'insensitive' } },
    { affectedLabel: { contains: query, mode: 'insensitive' } },
  ];
}

function createdAtFromDateRange(dateRange: string, now: Date) {
  const from = new Date(now);
  const days = DATE_RANGE_DAYS[dateRange];
  if (days) from.setDate(from.getDate() - days);
  return { gte: from };
}

function applyAuditDateFilters(where: Prisma.OpsAuditLogWhereInput, input: AuditReadFilters) {
  if (input.dateRange && input.dateRange !== 'all') {
    where.createdAt = createdAtFromDateRange(input.dateRange, new Date());
  }
  if (input.from || input.to) {
    where.createdAt = {
      ...(input.from ? { gte: new Date(input.from) } : {}),
      ...(input.to ? { lte: new Date(input.to) } : {}),
    };
  }
}

@Injectable()
export class AuditReadService {
  constructor(private readonly prisma: PrismaService) {}

  async listAuditLogs(input: AuditReadFilters = {}) {
    const where = this.auditWhere(input);
    const take = Math.min(Math.max(Number(input.limit ?? 100) || 100, 1), 500);

    const logs = await this.prisma.opsAuditLog.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      // QUERY_AUDIT_ALLOW_BOUNDED_TAKE: input.limit is clamped to 1..500 above.
      take,
    });

    return logs.map((log: OpsAuditLog) => mapAuditLog(log));
  }

  private auditWhere(input: AuditReadFilters) {
    const where: Prisma.OpsAuditLogWhereInput = {};
    applyAuditEqualFilters(where, input);
    applyAuditQuery(where, input.query);
    applyAuditDateFilters(where, input);
    return where;
  }
}
