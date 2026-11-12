import { Inject, Injectable, Optional } from '@nestjs/common';
import { ACCOUNT_CONTACT_READ_MODEL, type AccountContactReadModel } from '@prism/contexts/read-models/account-contacts';
import { NotificationChannel } from '@prism/kernel/event-core';
import { resolveNotificationRecipients } from '../../application/notifications/notification-recipient-resolver';
import { NotificationPreferenceService } from '../../application/notifications/notification-preference.service';
import { NotificationRecipientDeliveryService } from '../../application/notifications/notification-recipient-delivery.service';
import type { NotificationDeliveryPort, NotificationDeliveryResult } from '../../contracts/notifications/notification-delivery.port';
import { VIBER_BOT, type ViberBot } from '../../contracts/notifications/viber.port';
import { MailNotificationDeliveryAdapter } from './mail-notification-delivery.adapter';
import { PRISM_PORTAL_URLS, type PrismPortalUrls } from '@prism/kernel/shared';
import { conversationNoticeUrl } from './conversation-notice-url';

/**
 * Routes each outbox row by channel: email through the mail adapter, Viber (FR-25) to the recipients who linked Viber
 * and kept it on. A Viber row whose recipients all use email only is skipped, not failed: the email row reaches them.
 * Without a configured bot every row is skipped the same way: Viber is optional, so its absence is not a delivery fault.
 */
@Injectable()
export class ChannelNotificationDeliveryAdapter implements NotificationDeliveryPort {
  constructor(
    private readonly mail: MailNotificationDeliveryAdapter,
    private readonly preferences: NotificationPreferenceService,
    @Inject(ACCOUNT_CONTACT_READ_MODEL) private readonly contacts: AccountContactReadModel,
    private readonly recipients: NotificationRecipientDeliveryService,
    @Optional() @Inject(VIBER_BOT) private readonly viber?: ViberBot | null,
    @Optional() @Inject(PRISM_PORTAL_URLS) private readonly portals?: PrismPortalUrls,
  ) {}

  deliver(input: Parameters<NotificationDeliveryPort['deliver']>[0]): Promise<NotificationDeliveryResult> {
    if (input.channel === NotificationChannel.Viber) return this.deliverViber(input);
    return this.mail.deliver(input);
  }

  private async deliverViber(input: Parameters<NotificationDeliveryPort['deliver']>[0]): Promise<NotificationDeliveryResult> {
    const viber = this.viber;
    if (!viber) return { status: 'skipped', reason: 'Viber is not configured' };
    return this.recipients.deliver(input.idempotencyKey, () => resolveNotificationRecipients(input.recipient, input.eventId, this.contacts), async (email) => {
      const [recipient] = await this.preferences.findViberRecipients([email]);
      if (!recipient) return { status: 'skipped', reason: 'Recipient has not enabled Viber updates' };
      const url = conversationNoticeUrl(input.action, this.portals);
      const result = await viber.sendText(recipient.viberUserId, url ? `${input.message}\n\nOpen conversation: ${url}` : input.message);
      if (result.status === 'not_subscribed') {
        await this.preferences.clearViberUser(recipient.viberUserId);
        return { status: 'permanent_failure', reason: 'Recipient is not subscribed to the Viber bot' };
      }
      if (result.status === 'accepted') return result.messageToken ? { status: 'accepted', receipt: result.messageToken }
        : { status: 'permanent_failure', reason: 'Viber acceptance has no receipt; operator review required before retry' };
      return { status: result.status, reason: 'Viber provider could not accept this recipient' };
    });
  }
}
