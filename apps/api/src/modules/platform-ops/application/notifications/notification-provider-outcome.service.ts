import { ConflictException, ForbiddenException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '@prism/kernel/database';
import type { PrismVerifiedEventActor } from '@prism/types';
import { EMAIL_OUTCOME_READER, type EmailOutcomeReader } from '../../contracts/notifications/email-outcome-reader.port';
import type { Prisma } from '@prisma/client';
import { emailOutcomeAdvanceWhere, emailOutcomesBefore, isEmailOutcome, type EmailOutcome } from './email-outcome-order';

export function viberOutcomeWhere(receipt: string, outcome: string): Prisma.OpsNotificationDeliveryWhereInput {
  return { providerReceipt: receipt, notification: { channel: 'viber' },
    ...(outcome === 'failed' ? {} : { OR: [{ providerOutcome: null }, { providerOutcome: { in: outcome === 'seen' ? ['delivered', 'seen'] : ['delivered'] } }] }),
  };
}

@Injectable()
export class NotificationProviderOutcomeService {
  constructor(private readonly prisma: PrismaService, @Inject(EMAIL_OUTCOME_READER) private readonly emailOutcomes: EmailOutcomeReader) {}

  /** Apply any outcome reported before the send was recorded, whichever channel the receipt belongs to. */
  async reconcile(receipt: string) {
    await this.reconcileViber(receipt);
    await this.reconcileEmail(receipt);
  }

  async reconcileViber(receipt: string) {
    if (!/^[0-9]+$/.test(receipt)) return;
    const result = await this.prisma.opsNotificationProviderOutcome.findUnique({ where: { receipt } });
    if (result) await this.prisma.opsNotificationDelivery.updateMany({ where: viberOutcomeWhere(receipt, result.outcome), data: { providerOutcome: result.outcome } });
  }

  async reconcileEmail(receipt: string) {
    if (/^[0-9]+$/.test(receipt)) return;
    const stored = await this.prisma.opsNotificationProviderOutcome.findUnique({ where: { receipt } });
    if (stored && isEmailOutcome(stored.outcome)) await this.prisma.opsNotificationDelivery.updateMany({ where: emailOutcomeAdvanceWhere(receipt, stored.outcome), data: { providerOutcome: stored.outcome } });
  }

  /**
   * Record what the provider reported for an email, pushed (webhook) or pulled (PMCM refresh). The report is kept
   * even when the send is not recorded yet, and only ever moves forward, whatever order reports arrive in.
   */
  async recordEmailOutcome(receipt: string, outcome: EmailOutcome) {
    await this.prisma.opsNotificationProviderOutcome.createMany({ data: [{ receipt, outcome }], skipDuplicates: true });
    await this.prisma.opsNotificationProviderOutcome.updateMany({ where: { receipt, outcome: { in: emailOutcomesBefore(outcome) } }, data: { outcome } });
    const kept = await this.prisma.opsNotificationProviderOutcome.findUniqueOrThrow({ where: { receipt } });
    if (isEmailOutcome(kept.outcome)) await this.prisma.opsNotificationDelivery.updateMany({ where: emailOutcomeAdvanceWhere(receipt, kept.outcome), data: { providerOutcome: kept.outcome } });
  }

  async refreshEmail(notificationId: string, id: string, actor: PrismVerifiedEventActor) {
    if (actor.role !== 'pmcm-admin') throw new ForbiddenException('Only PMCM can inspect provider outcomes');
    const row = await this.prisma.opsNotificationDelivery.findFirst({ where: { id, notificationId, notification: { channel: 'email' } } });
    if (!row) throw new NotFoundException('Email delivery not found');
    if (!row.providerReceipt || row.status !== 'accepted') throw new ConflictException('The email has not been accepted by a provider');
    const outcome = await this.emailOutcomes.retrieve(row.providerReceipt);
    if (isEmailOutcome(outcome)) await this.recordEmailOutcome(row.providerReceipt, outcome);
    const current = await this.prisma.opsNotificationDelivery.findFirst({ where: { id }, select: { providerOutcome: true } });
    return { id, providerOutcome: current?.providerOutcome ?? outcome };
  }
}
