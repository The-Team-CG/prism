import { ConflictException, ForbiddenException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '@prism/kernel/database';
import type { PrismVerifiedEventActor } from '@prism/types';
import { EMAIL_OUTCOME_READER, type EmailOutcomeReader } from '../../contracts/notifications/email-outcome-reader.port';
import type { Prisma } from '@prisma/client';

export function viberOutcomeWhere(receipt: string, outcome: string): Prisma.OpsNotificationDeliveryWhereInput {
  return { providerReceipt: receipt, notification: { channel: 'viber' },
    ...(outcome === 'failed' ? {} : { OR: [{ providerOutcome: null }, { providerOutcome: { in: outcome === 'seen' ? ['delivered', 'seen'] : ['delivered'] } }] }),
  };
}

@Injectable()
export class NotificationProviderOutcomeService {
  constructor(private readonly prisma: PrismaService, @Inject(EMAIL_OUTCOME_READER) private readonly emailOutcomes: EmailOutcomeReader) {}

  async reconcileViber(receipt: string) {
    if (!/^[0-9]+$/.test(receipt)) return;
    const result = await this.prisma.opsNotificationProviderOutcome.findUnique({ where: { receipt } });
    if (result) await this.prisma.opsNotificationDelivery.updateMany({ where: viberOutcomeWhere(receipt, result.outcome), data: { providerOutcome: result.outcome } });
  }

  async refreshEmail(notificationId: string, id: string, actor: PrismVerifiedEventActor) {
    if (actor.role !== 'pmcm-admin') throw new ForbiddenException('Only PMCM can inspect provider outcomes');
    const row = await this.prisma.opsNotificationDelivery.findFirst({ where: { id, notificationId, notification: { channel: 'email' } } });
    if (!row) throw new NotFoundException('Email delivery not found');
    if (!row.providerReceipt || row.status !== 'accepted') throw new ConflictException('The email has not been accepted by a provider');
    const outcome = await this.emailOutcomes.retrieve(row.providerReceipt);
    await this.prisma.opsNotificationDelivery.updateMany({ where: { id, providerReceipt: row.providerReceipt }, data: { providerOutcome: outcome } });
    return { id, providerOutcome: outcome };
  }
}
