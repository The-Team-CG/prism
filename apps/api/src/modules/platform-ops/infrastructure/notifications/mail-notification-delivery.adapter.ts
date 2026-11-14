import { Inject, Injectable, Optional } from '@nestjs/common';
import { PRISM_PORTAL_URLS, type PrismPortalUrls } from '@prism/kernel/shared';
import { conversationNoticeUrl } from './conversation-notice-url';
import { ACCOUNT_CONTACT_READ_MODEL, type AccountContactReadModel } from '@prism/contexts/read-models/account-contacts';
import { NotificationChannel } from '@prism/kernel/event-core';
import { MAIL_TRANSPORT, type MailTransport } from '@prism/kernel/mail';
import { resolveNotificationRecipients } from '../../application/notifications/notification-recipient-resolver';
import type { NotificationDeliveryPort, NotificationDeliveryResult } from '../../contracts/notifications/notification-delivery.port';
import { NotificationRecipientDeliveryService } from '../../application/notifications/notification-recipient-delivery.service';

const HTML_ESCAPES: Record<string, string> = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };

function escapeHtml(text: string) {
  return text.replace(/[&<>"']/g, (character) => HTML_ESCAPES[character]!);
}

const SUBJECT_MAX = 72;

/** The first sentence says what happened, so it becomes the subject instead of a generic "update". */
export function notificationSubject(message: string, eventName?: string) {
  const headline = message.split(/(?<=[.;!?])\s/)[0]!.replace(/[.;]$/, "").trim();
  const short = headline.length > SUBJECT_MAX ? `${headline.slice(0, SUBJECT_MAX - 1).trimEnd()}…` : headline;
  const subject = short ? `P.R.I.S.M: ${short}` : "P.R.I.S.M update";
  return eventName && !headline.includes(eventName) ? `${subject} (${eventName})` : subject;
}

export function notificationHtml(message: string, conversationUrl?: string) {
  return [
    '<div style="font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.55;color:#171216;max-width:560px">',
    `<p style="margin:0 0 16px">${escapeHtml(message)}</p>`,
    ...(conversationUrl ? [`<p><a href="${escapeHtml(conversationUrl)}">Open conversation</a></p>`] : []),
    '<p style="margin:24px 0 0;font-size:12px;color:#62535c">P.R.I.S.M by PMCM. This is an automated update about your event.</p>',
    '</div>',
  ].join('');
}

/** Sends email outbox rows through the kernel mail transport. Other channels have no provider yet and fail permanently. */
@Injectable()
export class MailNotificationDeliveryAdapter implements NotificationDeliveryPort {
  constructor(
    @Inject(MAIL_TRANSPORT) private readonly mail: MailTransport,
    @Inject(ACCOUNT_CONTACT_READ_MODEL) private readonly contacts: AccountContactReadModel,
    private readonly recipients: NotificationRecipientDeliveryService,
    @Optional() @Inject(PRISM_PORTAL_URLS) private readonly portals?: PrismPortalUrls,
  ) {}

  async deliver(input: Parameters<NotificationDeliveryPort['deliver']>[0]): Promise<NotificationDeliveryResult> {
    if (input.channel !== NotificationChannel.Email) {
      return { status: 'permanent_failure', reason: `No ${input.channel} delivery provider` };
    }
    const eventName = input.eventId ? (await this.contacts.findEventNotificationContact(input.eventId))?.eventName : undefined;
    const subject = notificationSubject(input.message, eventName);
    const url = conversationNoticeUrl(input.action, this.portals);
    const html = notificationHtml(input.message, url);
    const text = url ? `${input.message}\n\nOpen conversation: ${url}` : input.message;
    return this.recipients.deliver(input.idempotencyKey, () => resolveNotificationRecipients(input.recipient, input.eventId, this.contacts), async (to) => {
      const result = await this.mail.send({ idempotencyKey: `${input.idempotencyKey}:${to}`, to, subject, text, html });
      return result.status === 'permanent_failure' ? { status: 'permanent_failure', reason: 'Mail provider rejected this recipient' } : result;
    });
  }
}
