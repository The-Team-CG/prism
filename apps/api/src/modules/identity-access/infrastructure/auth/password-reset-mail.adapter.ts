import { Inject, Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { MAIL_TRANSPORT, type MailTransport } from '@prism/kernel/mail';
import { PASSWORD_RESET_TTL_MS, type PasswordResetDeliveryPort } from '../../contracts/password-reset-delivery.port';

const SUBJECT = 'Reset your P.R.I.S.M password';
const EXPIRY_MINUTES = PASSWORD_RESET_TTL_MS / 60_000;
const IGNORE_NOTICE = "If you didn't ask for this, ignore this email.";

export function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function passwordResetEmail(resetUrl: string) {
  const expiry = `This link expires in ${EXPIRY_MINUTES} minutes. ${IGNORE_NOTICE}`;
  const text = [
    'Reset your P.R.I.S.M password.',
    '',
    `Open this link to choose a new password: ${resetUrl}`,
    '',
    expiry,
  ].join('\n');
  const link = escapeHtml(resetUrl);
  const html = [
    '<p>Reset your P.R.I.S.M password.</p>',
    `<p><a href="${link}">Choose a new password</a></p>`,
    `<p>Or open this link: ${link}</p>`,
    `<p>${escapeHtml(expiry)}</p>`,
  ].join('');
  return { subject: SUBJECT, text, html };
}

/** Sends the reset link through the kernel mail transport. Failures carry no URL, recipient or provider detail. */
@Injectable()
export class PasswordResetMailAdapter implements PasswordResetDeliveryPort {
  constructor(@Inject(MAIL_TRANSPORT) private readonly transport: MailTransport) {}

  async deliver({ recipient, resetUrl }: { recipient: string; resetUrl: string }): Promise<void> {
    const result = await this.transport.send({
      idempotencyKey: randomUUID(),
      to: recipient,
      ...passwordResetEmail(resetUrl),
    });
    if (result.status !== 'accepted') throw new Error('Password reset email was not accepted by the mail provider');
  }
}
