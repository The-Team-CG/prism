import { Inject, Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { MAIL_TRANSPORT, type MailTransport } from '@prism/kernel/mail';
import { ACCOUNT_INVITATION_TTL_MS, type AccountInvitationDeliveryPort, type InvitableAccountRole } from '../../contracts/account-invitation.port';
import { escapeHtml } from './password-reset-mail.adapter';

const SUBJECT = 'Set up your P.R.I.S.M account';
const EXPIRY_DAYS = ACCOUNT_INVITATION_TTL_MS / 86_400_000;
const AUTHENTICATOR_NOTICE = 'When you first sign in, you will set up an authenticator app for two-factor sign-in.';

export function accountInvitationEmail({ name, role, activationUrl }: { name: string; role: InvitableAccountRole; activationUrl: string }) {
  const notices = [
    `PMCM created your account. Set a password within ${EXPIRY_DAYS} days.`,
    ...(role === 'pmcm-admin' ? [AUTHENTICATOR_NOTICE] : []),
  ];
  const text = [
    `Hello ${name},`,
    '',
    ...notices,
    '',
    `Open this link to set your password: ${activationUrl}`,
  ].join('\n');
  const link = escapeHtml(activationUrl);
  const html = [
    `<p>Hello ${escapeHtml(name)},</p>`,
    ...notices.map((notice) => `<p>${escapeHtml(notice)}</p>`),
    `<p><a href="${link}">Set your password</a></p>`,
    `<p>Or open this link: ${link}</p>`,
  ].join('');
  return { subject: SUBJECT, text, html };
}

/** Sends the activation link through the kernel mail transport. Failures carry no URL, recipient or provider detail. */
@Injectable()
export class AccountInvitationMailAdapter implements AccountInvitationDeliveryPort {
  constructor(@Inject(MAIL_TRANSPORT) private readonly transport: MailTransport) {}

  async deliver({ recipient, name, role, activationUrl }: { recipient: string; name: string; role: InvitableAccountRole; activationUrl: string }): Promise<void> {
    const result = await this.transport.send({
      idempotencyKey: randomUUID(),
      to: recipient,
      ...accountInvitationEmail({ name, role, activationUrl }),
    });
    if (result.status !== 'accepted') throw new Error('Account invitation email was not accepted by the mail provider');
  }
}
