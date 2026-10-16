import { Inject, Injectable } from '@nestjs/common';
import { PrismaService } from '@prism/kernel/database';
import {
  OPERATIONS_EVENT_REFERENCE_READER,
  type OperationsEventReferenceReader,
} from '@prism/contexts/event-lifecycle/operations-reference';
import type { GuestPassDeliveryEligibilityReader } from './guest-pass-delivery-eligibility.port';

@Injectable()
export class GuestPassDeliveryEligibilityService implements GuestPassDeliveryEligibilityReader {
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
    return Boolean(event && !event.archived && event.actualEndedAt === null);
  }
}
