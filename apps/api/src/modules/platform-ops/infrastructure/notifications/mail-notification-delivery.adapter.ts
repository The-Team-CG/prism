import { Inject, Injectable } from '@nestjs/common';
import { ACCOUNT_CONTACT_READ_MODEL, type AccountContactReadModel } from '@prism/contexts/read-models/account-contacts';
import { NotificationChannel } from '@prism/kernel/event-core';
import { MAIL_TRANSPORT, type MailTransport } from '@prism/kernel/mail';
import { resolveNotificationRecipients } from '../../application/notifications/notification-recipient-resolver';
import type { NotificationDeliveryPort, NotificationDeliveryResult } from '../../contracts/notifications/notification-delivery.port';

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

export function notificationHtml(message: string) {
  return [
    '<div style="font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.55;color:#171216;max-width:560px">',
    `<p style="margin:0 0 16px">${escapeHtml(message)}</p>`,
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
  ) {}

  async deliver(input: Parameters<NotificationDeliveryPort['deliver']>[0]): Promise<NotificationDeliveryResult> {
    if (input.channel !== NotificationChannel.Email) {
      return { status: 'permanent_failure', reason: `No ${input.channel} delivery provider` };
    }
    const resolved = await resolveNotificationRecipients(input.recipient, input.eventId, this.contacts);
    if (resolved.status === 'failed') return { status: 'permanent_failure', reason: resolved.reason };

    const eventName = input.eventId ? (await this.contacts.findEventNotificationContact(input.eventId))?.eventName : undefined;
    const subject = notificationSubject(input.message, eventName);
    const html = notificationHtml(input.message);
    // One send per address; the per-address key lets a retry of a partly accepted row skip the addresses already sent.
    const sends = await Promise.all(resolved.addresses.map((to) => this.mail.send({
      idempotencyKey: `${input.idempotencyKey}:${to}`,
      to,
      subject,
      text: input.message,
      html,
    })));

    const total = sends.length;
    const rejected = sends.filter((send) => send.status === 'permanent_failure').length;
    if (rejected > 0) return { status: 'permanent_failure', reason: `Mail provider rejected ${rejected} of ${total} addresses` };
    const retryable = sends.filter((send) => send.status === 'retryable_failure').length;
    if (retryable > 0) {
      return { status: 'retryable_failure', reason: `Mail was not accepted for ${retryable} of ${total} addresses; retry scheduled` };
    }
    return { status: 'accepted', receipt: sends.flatMap((send) => (send.status === 'accepted' ? [send.receipt] : [])).join(',') };
  }
}
