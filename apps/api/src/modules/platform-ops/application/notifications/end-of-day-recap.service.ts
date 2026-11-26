import { ConflictException, Inject, Injectable } from '@nestjs/common';
import { PrismaService } from '@prism/kernel/database';
import { ACCOUNT_CONTACT_READ_MODEL, type AccountContactReadModel } from '@prism/contexts/read-models/account-contacts';
import { NOTIFICATION_OUTBOX_WRITER } from '../../contracts/notifications/notification-ops.tokens';
import type { NotificationOutboxWriter } from '../../contracts/notifications/notification-outbox-writer.port';

/** UAT 7.5: the recap goes out at 18:00 Philippine time and covers that day from midnight. */
export const END_OF_DAY_RECAP_HOUR = 18;
const MANILA_OFFSET_MS = 8 * 60 * 60 * 1000;
/** The role label the notification resolver expands to every approved, unlocked PMCM admin at send time. */
const PMCM_ADMINS_RECIPIENT = 'PMCM Admin';
const LATEST_ACTIONS = 15;
const MOST_ACTIVE_EVENTS = 5;
/** A day of normal PMCM work is far below this; the cap only bounds a runaway day. */
const MAX_RECAP_ROWS = 5000;

const CATEGORY_LABELS: Record<string, string> = {
  events: 'Events',
  finance: 'Finance',
  suppliers: 'Suppliers',
  access: 'Access',
  documents: 'Documents',
  compliance: 'Compliance',
};

type RecapRow = { eventId: string | null; actor: string; action: string; category: string; createdAt: Date };

export type EndOfDayRecapResult =
  | { status: 'queued'; day: string; actions: number }
  | { status: 'skipped'; day: string; reason: 'before_send_time' | 'no_activity' | 'already_queued' };

/** The Philippine calendar day of an instant, as YYYY-MM-DD. */
export function manilaDayKey(at: Date): string {
  return new Date(at.getTime() + MANILA_OFFSET_MS).toISOString().slice(0, 10);
}

/** The recap window for a Philippine day: midnight to the 18:00 send time, so a re-run reads the same rows. */
export function recapWindow(day: string): { from: Date; to: Date } {
  const midnight = Date.parse(`${day}T00:00:00.000Z`) - MANILA_OFFSET_MS;
  return { from: new Date(midnight), to: new Date(midnight + END_OF_DAY_RECAP_HOUR * 60 * 60 * 1000) };
}

function manilaClock(at: Date): string {
  return new Date(at.getTime() + MANILA_OFFSET_MS).toISOString().slice(11, 16);
}

function plural(count: number, one: string, many: string) {
  return `${count} ${count === 1 ? one : many}`;
}

/** The recap text. The first sentence becomes the email subject, so it names the day. */
export function renderEndOfDayRecap(day: string, rows: RecapRow[], eventNames: Record<string, string>): string {
  const byCategory = new Map<string, number>();
  const byEvent = new Map<string, number>();
  for (const row of rows) {
    byCategory.set(row.category, (byCategory.get(row.category) ?? 0) + 1);
    if (row.eventId) byEvent.set(row.eventId, (byEvent.get(row.eventId) ?? 0) + 1);
  }
  const areas = [...byCategory.entries()]
    .sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]))
    .map(([category, count]) => `${CATEGORY_LABELS[category] ?? category} ${count}`)
    .join(' · ');
  const events = [...byEvent.entries()]
    .sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]))
    .slice(0, MOST_ACTIVE_EVENTS)
    .map(([eventId, count]) => `- ${eventNames[eventId] ?? 'An event'}: ${plural(count, 'update', 'updates')}`);
  const latest = [...rows]
    .sort((left, right) => right.createdAt.getTime() - left.createdAt.getTime())
    .slice(0, LATEST_ACTIONS)
    .map((row) => `- ${manilaClock(row.createdAt)} ${row.actor}: ${row.action}${row.eventId && eventNames[row.eventId] ? ` (${eventNames[row.eventId]})` : ''}`);
  return [
    `End-of-day recap for ${day}.`,
    `${plural(rows.length, 'update', 'updates')} across ${plural(byEvent.size, 'event', 'events')} today.`,
    `By area: ${areas}.`,
    ...(events.length ? ['', 'Most active events:', ...events] : []),
    '',
    'Latest activity:',
    ...latest,
    '',
    'Open the PMCM command inbox for anything that needs you.',
  ].join('\n');
}

/**
 * UAT 7.5: one email to the PMCM admins at the end of each day that recaps the day's recorded activity, read from the
 * audit trail. Queued once per day through the outbox; a day with no activity sends nothing.
 */
@Injectable()
export class EndOfDayRecapService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(ACCOUNT_CONTACT_READ_MODEL) private readonly contacts: AccountContactReadModel,
    @Inject(NOTIFICATION_OUTBOX_WRITER) private readonly outbox: NotificationOutboxWriter,
  ) {}

  async queueRecap(now = new Date()): Promise<EndOfDayRecapResult> {
    const day = manilaDayKey(now);
    const window = recapWindow(day);
    if (now < window.to) return { status: 'skipped', day, reason: 'before_send_time' };
    const rows = await this.prisma.opsAuditLog.findMany({
      where: { createdAt: { gte: window.from, lt: window.to } },
      select: { eventId: true, actor: true, action: true, category: true, createdAt: true },
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
      take: MAX_RECAP_ROWS,
    });
    if (rows.length === 0) return { status: 'skipped', day, reason: 'no_activity' };
    const eventIds = [...new Set(rows.map((row) => row.eventId).filter((id): id is string => Boolean(id)))];
    const eventNames = eventIds.length ? await this.contacts.findEventNames(eventIds) : {};
    const idempotencyKey = `end-of-day-recap:${day}`;
    try {
      await this.outbox.write({
        recipient: PMCM_ADMINS_RECIPIENT,
        message: renderEndOfDayRecap(day, rows, eventNames),
        channel: 'email',
        correlationId: idempotencyKey,
        idempotencyKey,
      });
    } catch (error) {
      // The day's recap is already queued; the window is fixed, so this is a repeat of the same recap.
      if (error instanceof ConflictException) return { status: 'skipped', day, reason: 'already_queued' };
      throw error;
    }
    return { status: 'queued', day, actions: rows.length };
  }
}
