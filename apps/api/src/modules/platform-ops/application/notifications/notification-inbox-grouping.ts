import type { PrismNotificationInboxItem } from '@prism/types';

type InboxDelivery = PrismNotificationInboxItem & { operationId?: string | null };

/** Channel-independent operation identity, not a text/time heuristic: repeated workflow notices stay separate. */
export function groupInboxDeliveries(rows: InboxDelivery[]): PrismNotificationInboxItem[] {
  const groups = new Map<string, InboxDelivery[]>();
  for (const row of rows) {
    const operation = row.operationId?.split(':').map((part) => part === row.channel ? '{channel}' : part).join(':');
    const key = operation ? JSON.stringify([operation, row.eventId, row.message, row.action]) : row.id;
    const group = groups.get(key) ?? [];
    group.push(row);
    groups.set(key, group);
  }
  return [...groups.values()].map((group) => {
    const [{ operationId: _, ...first }] = group;
    if (group.length === 1) return first;
    const due = group.flatMap((row) => !row.acknowledgedAt && row.acknowledgmentDueAt ? [row.acknowledgmentDueAt] : []).sort();
    return {
      ...first,
      channel: [...new Set(group.map((row) => row.channel))].sort().join(', '),
      readAt: group.every((row) => row.readAt) ? group.map((row) => row.readAt!).sort().reverse()[0] : null,
      acknowledgedAt: group.every((row) => row.acknowledgedAt) ? group.map((row) => row.acknowledgedAt!).sort().reverse()[0] : null,
      acknowledgmentDueAt: due[0] ?? null,
      deliveries: group.map(({ id, version }) => ({ id, version })),
    };
  });
}
