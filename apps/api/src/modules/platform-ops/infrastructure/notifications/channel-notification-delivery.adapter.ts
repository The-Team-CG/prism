import { Inject, Injectable, Optional } from '@nestjs/common';
import { ACCOUNT_CONTACT_READ_MODEL, type AccountContactReadModel } from '@prism/contexts/read-models/account-contacts';
import { NotificationChannel } from '@prism/kernel/event-core';
import { resolveNotificationRecipients } from '../../application/notifications/notification-recipient-resolver';
import { NotificationPreferenceService } from '../../application/notifications/notification-preference.service';
import type { NotificationDeliveryPort, NotificationDeliveryResult } from '../../contracts/notifications/notification-delivery.port';
import { VIBER_BOT, type ViberBot } from '../../contracts/notifications/viber.port';
import { MailNotificationDeliveryAdapter } from './mail-notification-delivery.adapter';

/**
 * Routes each outbox row by channel: email through the mail adapter, Viber (FR-25) to the recipients who linked Viber
 * and kept it on. A Viber row whose recipients all use email only is skipped, not failed: the email row reaches them.
 */
@Injectable()
export class ChannelNotificationDeliveryAdapter implements NotificationDeliveryPort {
  constructor(
    private readonly mail: MailNotificationDeliveryAdapter,
    private readonly preferences: NotificationPreferenceService,
    @Inject(ACCOUNT_CONTACT_READ_MODEL) private readonly contacts: AccountContactReadModel,
    @Optional() @Inject(VIBER_BOT) private readonly viber?: ViberBot | null,
  ) {}

  deliver(input: Parameters<NotificationDeliveryPort['deliver']>[0]): Promise<NotificationDeliveryResult> {
    if (input.channel === NotificationChannel.Viber) return this.deliverViber(input);
    return this.mail.deliver(input);
  }

  private async deliverViber(input: Parameters<NotificationDeliveryPort['deliver']>[0]): Promise<NotificationDeliveryResult> {
    const viber = this.viber;
    if (!viber) return { status: 'permanent_failure', reason: 'No viber delivery provider' };
    const resolved = await resolveNotificationRecipients(input.recipient, input.eventId, this.contacts);
    if (resolved.status === 'failed') return { status: 'permanent_failure', reason: resolved.reason };
    const recipients = await this.preferences.findViberRecipients(resolved.addresses);
    if (recipients.length === 0) return { status: 'skipped', reason: 'No recipient has Viber updates on' };
    const results = await Promise.all(recipients.map(async (recipient) => {
      const result = await viber.sendText(recipient.viberUserId, input.message);
      if (result.status === 'not_subscribed') await this.preferences.clearViberUser(recipient.viberUserId);
      return result;
    }));
    if (results.some((result) => result.status === 'retryable_failure')) return { status: 'retryable_failure', reason: 'Viber did not accept every message; retry scheduled' };
    const accepted = results.flatMap((result) => (result.status === 'accepted' ? [result.messageToken || 'accepted'] : []));
    if (accepted.length === 0) return { status: 'permanent_failure', reason: `Viber refused all ${results.length} messages` };
    return { status: 'accepted', receipt: accepted.join(',') };
  }
}
