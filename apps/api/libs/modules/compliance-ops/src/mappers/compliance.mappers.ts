import type { OpsComplianceCheck, OpsComplianceRule } from '@prisma/client';

function timestamp(value: Date) {
  return value.toISOString();
}

export function mapComplianceRule(rule: OpsComplianceRule) {
  return {
    id: rule.id,
    eventId: rule.eventId ?? null,
    eventType: rule.eventType,
    phase: rule.phase,
    severity: rule.severity,
    layer: rule.layer,
    conditionKey: rule.conditionKey,
    title: rule.title,
    note: rule.note,
    active: rule.active,
    createdAt: timestamp(rule.createdAt),
    updatedAt: timestamp(rule.updatedAt),
  };
}

export function mapComplianceCheck(check: OpsComplianceCheck) {
  const expanded = check as OpsComplianceCheck & {
    ruleId?: string | null;
    severity?: string;
    phase?: string;
    conditionKey?: string;
    resolvedAt?: Date | null;
    resolvedBy?: string | null;
    overrideReason?: string | null;
    overrideAt?: Date | null;
    overrideBy?: string | null;
  };
  return {
    id: check.id,
    eventId: check.eventId,
    ruleId: expanded.ruleId ?? null,
    layer: check.layer as 'Must-Fix' | 'Should-Fix' | 'Advisory',
    severity: expanded.severity ?? 'must_fix',
    phase: expanded.phase ?? 'planning',
    conditionKey: expanded.conditionKey ?? '',
    title: check.title,
    status: check.status as 'open' | 'resolved' | 'overridden',
    note: check.note,
    resolvedAt: expanded.resolvedAt ? timestamp(expanded.resolvedAt) : null,
    resolvedBy: expanded.resolvedBy ?? null,
    overrideReason: expanded.overrideReason ?? null,
    overrideAt: expanded.overrideAt ? timestamp(expanded.overrideAt) : null,
    overrideBy: expanded.overrideBy ?? null,
  };
}
