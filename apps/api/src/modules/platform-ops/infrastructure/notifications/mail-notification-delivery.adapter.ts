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
    const subject = eventName ? `P.R.I.S.M update - ${eventName}` : 'P.R.I.S.M update';
    const html = `<p>${escapeHtml(input.message)}</p>`;
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
