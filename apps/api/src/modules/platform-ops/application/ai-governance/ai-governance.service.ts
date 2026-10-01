import { BadRequestException, Injectable } from '@nestjs/common';
import type { OpsAiApprovalRecord, OpsAiAuditLog } from '@prisma/client';
import { PrismaService } from '@prism/kernel/database';
import { toPrismaJson } from '@prism/kernel/database';
import { randomUUID } from 'node:crypto';
import type { ResolvedEventOpsActor } from '@prism/kernel/access-control';
import { requireVerifiedTrustActor } from '../trust/verified-trust-actor';

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

const KEY_REDACTIONS: Array<{ test: (key: string) => boolean; value: string }> = [
  { test: (key) => key.includes('email'), value: '[email redacted]' },
  { test: (key) => key.includes('phone') || key.includes('mobile'), value: '[phone redacted]' },
  { test: (key) => key === 'clientname' || key === 'client_name', value: 'Client A' },
  { test: (key) => key === 'suppliername' || key === 'supplier_name', value: 'Supplier X' },
];

function redactedLabelForKey(key: string) {
  const normalized = key.toLowerCase();
  for (const rule of KEY_REDACTIONS) {
    if (rule.test(normalized)) return rule.value;
  }
}

function redactStringContent(value: string) {
  return value
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, '[email redacted]')
    .replace(/(\+?\d[\d\s().-]{7,}\d)/g, '[phone redacted]')
    .replace(/\bAna Reyes\b/g, 'Client A')
    .replace(/\bSonicLine Technicals\b/g, 'Supplier X');
}

function redactValue(key: string, value: unknown): unknown {
  if (Array.isArray(value)) return value.map((item) => redactValue(key, item));
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([childKey, childValue]) => [
        childKey,
        redactValue(childKey, childValue),
      ]),
    );
  }
  const byKey = redactedLabelForKey(key);
  if (byKey) return byKey;
  if (typeof value !== 'string') return value;
  return redactStringContent(value);
}

@Injectable()
export class AiGovernanceService {
  constructor(private readonly prisma: PrismaService) {}

  sanitizePayload(payload: Record<string, unknown>) {
    return redactValue('payload', payload) as Record<string, unknown>;
  }

  async runDryRun(input: AiGovernanceDryRunInput, actor: ResolvedEventOpsActor): Promise<AiGovernanceDryRunResult> {
    const verifiedActor = requireVerifiedTrustActor(actor, 'an AI governance dry-run');
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
        requestedBy: verifiedActor.name,
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
