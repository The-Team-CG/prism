import type { OpsAuditLog } from '@prisma/client';

function timestamp(value: Date) {
  return value.toISOString();
}

/** Map the platform audit persistence row without requiring the audit service. */
export function mapAuditLog(log: OpsAuditLog) {
  return {
    id: log.id,
    eventId: log.eventId ?? undefined,
    actor: log.actor,
    actorRole: log.actorRole,
    actorEmail: log.actorEmail,
    action: log.action,
    actionType: log.actionType,
    category: log.category,
    affectedType: log.affectedType,
    affectedId: log.affectedId,
    affectedLabel: log.affectedLabel,
    metadata: log.metadata,
    ipAddress: log.ipAddress,
    device: log.device,
    severity: log.severity,
    immutableHash: log.immutableHash,
    previousHash: log.previousHash,
    createdAt: timestamp(log.createdAt),
  };
}
