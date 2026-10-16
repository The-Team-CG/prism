import { Inject, Injectable } from '@nestjs/common';
import { PrismaService } from '@prism/kernel/database';
import {
  OPERATIONS_EVENT_REFERENCE_READER,
  type OperationsEventReferenceReader,
} from '@prism/contexts/event-lifecycle/operations-reference';
import type {
  GuestPassDeliveryEligibilityReader,
  GuestPassDeliveryStatusReader,
} from './guest-pass-delivery-eligibility.port';

@Injectable()
export class GuestPassDeliveryEligibilityService implements GuestPassDeliveryEligibilityReader, GuestPassDeliveryStatusReader {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(OPERATIONS_EVENT_REFERENCE_READER)
    private readonly eventReferences: OperationsEventReferenceReader,
  ) {}

  async canDeliverGuestPass(passId: string, eventId: string): Promise<boolean> {
    if (!passId.trim() || !eventId.trim()) return false;

    const pass = await this.prisma.opsGuestQrPass.findUnique({
      where: { id: passId },
      select: { eventId: true, status: true },
    });
    if (!pass || pass.eventId !== eventId || pass.status !== 'active') return false;

    const event = await this.eventReferences.findOperationsEvent(eventId);
    return Boolean(event && !event.archived && event.status !== 'archived' && event.actualEndedAt === null);
  }

  async getGuestPassDeliveryStatuses(eventId: string, passIds: readonly string[]) {
    if (!eventId.trim() || passIds.length === 0) return new Map();
    const passes = await this.prisma.opsGuestQrPass.findMany({
      where: { eventId, id: { in: [...new Set(passIds)] } },
      select: { id: true, status: true, deliveryStatus: true, notificationId: true },
    });
    const notificationIds = passes.flatMap((pass) => pass.notificationId ? [pass.notificationId] : []);
    const notifications = notificationIds.length > 0
      ? await this.prisma.opsNotificationLog.findMany({
          where: { id: { in: notificationIds } },
          select: { id: true, status: true },
        })
      : [];
    const statusByNotificationId = new Map(notifications.map((notification) => [notification.id, notification.status]));

    return new Map(passes.map((pass) => [pass.id, deliveryStatus(pass.status, pass.deliveryStatus, statusByNotificationId.get(pass.notificationId ?? ''))]));
  }
}

function deliveryStatus(passStatus: string, fallbackStatus: string, notificationStatus?: string) {
  if (passStatus !== 'active' || notificationStatus === 'cancelled') return 'revoked' as const;
  if (notificationStatus === 'captured') return 'captured' as const;
  if (notificationStatus === 'failed' || notificationStatus === 'sent' || notificationStatus === 'acknowledged') return 'failed' as const;
  if (notificationStatus === 'queued') return 'queued' as const;
  if (fallbackStatus === 'captured' || fallbackStatus === 'failed') return fallbackStatus;
  return 'queued' as const;
}
