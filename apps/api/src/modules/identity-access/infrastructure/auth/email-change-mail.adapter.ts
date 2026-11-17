import { Inject, Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { MAIL_TRANSPORT, type MailTransport } from '@prism/kernel/mail';
import type { EmailChangeDeliveryPort } from '../../contracts/email-change.port';
import { escapeHtml } from './password-reset-mail.adapter';

/** "a***@example.com": enough for the owner to recognise, without spelling out the new address in the notice. */
export function maskEmail(email: string) {
  const [local = '', domain = ''] = email.split('@');
  return `${local.slice(0, 1)}***@${domain}`;
}

export function emailChangeConfirmationEmail(name: string, confirmUrl: string) {
  const lines = [
    `Hi ${name},`,
    'You asked to sign in to P.R.I.S.M with this email address.',
    `Open this link to confirm it: ${confirmUrl}`,
    'The link works for 24 hours. Until you open it, you keep signing in with your current email.',
    "If you didn't ask for this, ignore this email.",
  ];
  const link = escapeHtml(confirmUrl);
  const html = [
    `<p>${escapeHtml(lines[0])}</p>`,
    `<p>${escapeHtml(lines[1])}</p>`,
    `<p><a href="${link}">Confirm my new email</a></p>`,
    `<p>Or open this link: ${link}</p>`,
    `<p>${escapeHtml(lines[3])} ${escapeHtml(lines[4])}</p>`,
  ].join('');
  return { subject: 'Confirm your new P.R.I.S.M sign-in email', text: lines.join('\n\n'), html };
}

export function emailChangeNoticeEmail(name: string, newEmail: string) {
  const lines = [
    `Hi ${name},`,
    `Someone signed in to your P.R.I.S.M account asked to change its sign-in email to ${maskEmail(newEmail)}.`,
    'Nothing changes until the link sent to that address is opened.',
    "If this wasn't you, change your password now and message PMCM.",
  ];
  return {
    subject: 'Your P.R.I.S.M sign-in email is changing',
    text: lines.join('\n\n'),
    html: lines.map((line) => `<p>${escapeHtml(line)}</p>`).join(''),
  };
}

/** Sends both emails of an email change through the kernel mail transport. Failures carry no link or recipient. */
@Injectable()
export class EmailChangeMailAdapter implements EmailChangeDeliveryPort {
  constructor(@Inject(MAIL_TRANSPORT) private readonly transport: MailTransport) {}

  async sendConfirmation({ recipient, name, confirmUrl }: { recipient: string; name: string; confirmUrl: string }) {
    const result = await this.transport.send({ idempotencyKey: randomUUID(), to: recipient, ...emailChangeConfirmationEmail(name, confirmUrl) });
    if (result.status !== 'accepted') throw new Error('Email change confirmation was not accepted by the mail provider');
  }

  async sendNotice({ recipient, name, newEmail }: { recipient: string; name: string; newEmail: string }) {
    const result = await this.transport.send({ idempotencyKey: randomUUID(), to: recipient, ...emailChangeNoticeEmail(name, newEmail) });
    if (result.status !== 'accepted') throw new Error('Email change notice was not accepted by the mail provider');
  }
}
