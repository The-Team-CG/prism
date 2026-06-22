import type { OpsComplianceRule } from '@prisma/client';

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
