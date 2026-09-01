import type { OpsNotificationLog } from '@prisma/client';

function timestamp(value: Date) {
  return value.toISOString();
}

export function mapNotificationLog(log: OpsNotificationLog) {
  const expanded = log as OpsNotificationLog & {
    attempts?: number;
    correlationId?: string | null;
    failureReason?: string | null;
    sentAt?: Date | null;
    failedAt?: Date | null;
    acknowledgedAt?: Date | null;
  };
  return {
    id: log.id,
    eventId: log.eventId ?? undefined,
    channel: log.channel as 'email' | 'viber',
    recipient: log.recipient,
    message: log.message,
    status: log.status,
    attempts: expanded.attempts ?? 0,
    correlationId: expanded.correlationId ?? null,
    failureReason: expanded.failureReason ?? null,
    sentAt: expanded.sentAt ? timestamp(expanded.sentAt) : null,
    failedAt: expanded.failedAt ? timestamp(expanded.failedAt) : null,
    acknowledgedAt: expanded.acknowledgedAt ? timestamp(expanded.acknowledgedAt) : null,
    createdAt: timestamp(log.createdAt),
  };
}
