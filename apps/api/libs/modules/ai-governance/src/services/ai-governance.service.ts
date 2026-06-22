import { BadRequestException, Injectable } from '@nestjs/common';
import type { OpsAiApprovalRecord, OpsAiAuditLog } from '@prisma/client';
import type { PrismaService } from '@prism/database';
import { toPrismaJson } from '@prism/database';
import { randomUUID } from 'node:crypto';

export type AiGovernanceDryRunInput = {
  eventId?: string;
  featureName: string;
  modelVersion: string;
  zdrConfirmed: boolean;
  payload: Record<string, unknown>;
};

export type AiGovernanceDryRunResult = {
  audit: OpsAiAuditLog;
  approval: OpsAiApprovalRecord;
};

@Injectable()
export class AiGovernanceService {
  constructor(private readonly prisma: PrismaService) {}

  sanitizePayload(payload: Record<string, unknown>) {
    const redactValue = (key: string, value: unknown): unknown => {
      if (Array.isArray(value)) return value.map((item) => redactValue(key, item));
      if (value && typeof value === 'object') {
        return Object.fromEntries(
          Object.entries(value as Record<string, unknown>).map(([childKey, childValue]) => [
            childKey,
            redactValue(childKey, childValue),
          ]),
        );
      }
      const normalizedKey = key.toLowerCase();
      if (normalizedKey.includes('email')) return '[email redacted]';
      if (normalizedKey.includes('phone') || normalizedKey.includes('mobile')) return '[phone redacted]';
      if (normalizedKey === 'clientname' || normalizedKey === 'client_name') return 'Client A';
      if (normalizedKey === 'suppliername' || normalizedKey === 'supplier_name') return 'Supplier X';
      if (typeof value !== 'string') return value;

      return value
        .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, '[email redacted]')
        .replace(/(\+?\d[\d\s().-]{7,}\d)/g, '[phone redacted]')
        .replace(/\bAna Reyes\b/g, 'Client A')
        .replace(/\bSonicLine Technicals\b/g, 'Supplier X');
    };

    return redactValue('payload', payload) as Record<string, unknown>;
  }

  async runDryRun(input: AiGovernanceDryRunInput): Promise<AiGovernanceDryRunResult> {
    const sanitizedPayload = this.sanitizePayload(input.payload ?? {});
    const dataCategories = this.detectDataCategories(input.payload ?? {});
    const baseData = {
      id: `aia_${randomUUID()}`,
      eventId: input.eventId ?? null,
      featureName: input.featureName,
      modelVersion: input.modelVersion,
      dataCategories: toPrismaJson(dataCategories),
      sanitizedPayload: toPrismaJson(sanitizedPayload),
      zdrConfirmed: Boolean(input.zdrConfirmed),
      humanApprovalRequired: true,
      humanApproved: false,
    };

    if (!input.zdrConfirmed) {
      await this.prisma.opsAiAuditLog.create({
        data: {
          ...baseData,
          status: 'ZDR_UNCONFIRMED',
        },
      });
      throw new BadRequestException('ZDR confirmation is required before AI can run');
    }

    const audit = await this.prisma.opsAiAuditLog.create({
      data: {
        ...baseData,
        status: 'pending_human_approval',
      },
    });
    const approval = await this.prisma.opsAiApprovalRecord.create({
      data: {
        id: `aip_${randomUUID()}`,
        aiAuditLogId: audit.id,
        eventId: input.eventId ?? null,
        featureName: input.featureName,
        requestedBy: 'PMCM Admin',
        humanApproved: false,
        status: 'pending_human_approval',
      },
    });

    return { audit, approval };
  }

  private detectDataCategories(payload: Record<string, unknown>) {
    const serialized = JSON.stringify(payload).toLowerCase();
    const categories = new Set<string>();
    if (serialized.includes('client') || serialized.includes('email') || serialized.includes('phone')) {
      categories.add('client_contact');
    }
    if (serialized.includes('supplier')) categories.add('supplier');
    if (serialized.includes('amount') || serialized.includes('billing') || serialized.includes('payment')) {
      categories.add('financial');
    }
    if (serialized.includes('guest')) categories.add('guest');
    if (categories.size === 0) categories.add('operational');
    return [...categories];
  }
}
