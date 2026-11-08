import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService, toPrismaJson } from '@prism/kernel/database';
import { PRISM_PORTAL_URLS, type PrismPortalUrls } from '@prism/kernel/shared';
import { NOTIFICATION_OUTBOX_WRITER, type NotificationOutboxWriter, writeNotification } from '@prism/contexts/platform-ops';
import { INQUIRY_DRAFT_REMINDER_HOURS, INQUIRY_DRAFT_RETENTION_DAYS, type PrismInquiryDraft, type SaveInquiryDraftInput } from '@prism/types';

const SWEEP_BATCH = 100;

/**
 * FR-50: a public inquiry in progress. The browser keeps it until the visitor accepts the privacy notice; after that it
 * is saved here so the visitor can resume it from another device, with one reminder email. Drafts are purged after 30 days.
 */
@Injectable()
export class InquiryDraftService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(NOTIFICATION_OUTBOX_WRITER) private readonly notifications: NotificationOutboxWriter,
    @Inject(PRISM_PORTAL_URLS) private readonly portals: PrismPortalUrls,
  ) {}

  async save(token: string, input: SaveInquiryDraftInput): Promise<PrismInquiryDraft> {
    const row = await this.prisma.opsInquiryDraft.upsert({
      where: { id: token },
      create: { id: token, email: input.email ?? null, payload: toPrismaJson(input.payload) },
      update: { email: input.email ?? null, payload: toPrismaJson(input.payload) },
    });
    return { payload: input.payload, updatedAt: row.updatedAt.toISOString() };
  }

  async get(token: string): Promise<PrismInquiryDraft> {
    const row = await this.prisma.opsInquiryDraft.findUnique({ where: { id: token } });
    if (!row) throw new NotFoundException('This draft is no longer available');
    return { payload: (row.payload ?? {}) as PrismInquiryDraft['payload'], updatedAt: row.updatedAt.toISOString() };
  }

  /** Called after the inquiry is submitted, so nothing is kept twice. */
  async discard(token: string) {
    await this.prisma.opsInquiryDraft.deleteMany({ where: { id: token } });
  }

  /** One reminder per draft left idle for a day, then purge of drafts older than the retention period. */
  async sweep(now = new Date()) {
    const idleBefore = new Date(now.getTime() - INQUIRY_DRAFT_REMINDER_HOURS * 3_600_000);
    const due = await this.prisma.opsInquiryDraft.findMany({ where: { email: { not: null }, remindedAt: null, updatedAt: { lte: idleBefore } }, take: SWEEP_BATCH, orderBy: { updatedAt: 'asc' } });
    // QUERY_AUDIT_ALLOW_BOUNDED_LOOP: capped by SWEEP_BATCH; each reminder is idempotent per draft.
    for (const draft of due) {
      await writeNotification(this.notifications, undefined, draft.email!, `You started an inquiry with PMCM but did not send it yet. Pick up where you left off: ${this.portals.client}/inquiry?draft=${draft.id}`, 'email', { idempotencyKey: `inquiry-draft-reminder:${draft.id}` });
      await this.prisma.opsInquiryDraft.update({ where: { id: draft.id }, data: { remindedAt: now } });
    }
    const purged = await this.prisma.opsInquiryDraft.deleteMany({ where: { updatedAt: { lte: new Date(now.getTime() - INQUIRY_DRAFT_RETENTION_DAYS * 86_400_000) } } });
    return { reminded: due.length, purged: purged.count };
  }
}
