import { Inject, Injectable } from '@nestjs/common';
import { PrismaService } from '@prism/kernel/database';
import { NOTIFICATION_OUTBOX_WRITER, type NotificationOutboxWriter, writeNotification } from '@prism/contexts/platform-ops';
import { isReadinessRequestDue, READINESS_REQUEST_DAYS_BEFORE_EVENT } from './supplier-readiness-request-policy';

const DAY_MS = 24 * 60 * 60 * 1000;
const MAX_EVENTS_PER_RUN = 200;
const MAX_REQUESTS_PER_EVENT = 500;

/**
 * New-SUP2: queues one readiness-confirmation request per selected booking once its event is within the
 * request window. The outbox idempotency key makes repeated sweeps converge on a single notification.
 */
@Injectable()
export class SupplierReadinessRequestService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(NOTIFICATION_OUTBOX_WRITER) private readonly notificationOutboxWriter: NotificationOutboxWriter,
  ) {}

  async queueDueReadinessRequests(now = new Date()) {
    // Candidate events are bounded by the window; the policy re-checks each exact boundary.
    const events = await this.prisma.opsEvent.findMany({
      where: {
        archived: false,
        eventDate: { gte: new Date(now.getTime() - DAY_MS), lte: new Date(now.getTime() + (READINESS_REQUEST_DAYS_BEFORE_EVENT + 1) * DAY_MS) },
      },
      select: { id: true, eventName: true, eventDate: true },
      orderBy: { id: 'asc' },
      take: MAX_EVENTS_PER_RUN,
    });

    let queued = 0;
    for (const event of events.filter((candidate) => isReadinessRequestDue(candidate.eventDate, now))) { // QUERY_AUDIT_ALLOW_BOUNDED_LOOP: at most MAX_EVENTS_PER_RUN events, each with one capped request page.
      const requests = await this.prisma.opsSupplierQuoteRequest.findMany({
        where: {
          eventId: event.id,
          status: 'selected',
          assignmentStatus: 'confirmed',
          readinessStatus: { not: 'confirmed' },
        },
        select: { id: true, category: true, supplier: { select: { email: true } } },
        orderBy: { id: 'asc' },
        take: MAX_REQUESTS_PER_EVENT,
      });
      const dateKey = event.eventDate.toISOString().slice(0, 10);
      for (const request of requests) {
        const recipient = request.supplier?.email.trim();
        if (!recipient) continue;
        const key = `supplier-readiness-request:${request.id}`;
        await writeNotification(
          this.notificationOutboxWriter,
          event.id,
          recipient,
          `Please confirm your readiness for ${event.eventName} (${request.category}) on ${dateKey} in your P.R.I.S.M supplier portal, and flag any concern in the event thread.`,
          'email',
          { idempotencyKey: key, correlationId: key },
        );
        queued += 1;
      }
    }
    return { queued };
  }
}
