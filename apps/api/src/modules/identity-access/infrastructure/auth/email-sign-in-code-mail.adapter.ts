import { Inject, Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { MAIL_TRANSPORT, type MailTransport } from '@prism/kernel/mail';
import { EMAIL_SIGN_IN_CODE_TTL_MINUTES } from '@prism/types';
import type { EmailSignInCodeDeliveryPort } from '../../contracts/email-sign-in-code-delivery.port';
import { escapeHtml } from './password-reset-mail.adapter';

/** The subject leads with the code so it shows in the inbox list and phone notifications. */
export function emailSignInCodeEmail(code: string, portalName: string) {
  const subject = `${code} is your P.R.I.S.M sign-in code`;
  const expiry = `It works for ${EMAIL_SIGN_IN_CODE_TTL_MINUTES} minutes and only once. If you didn't try to sign in, ignore this email; your account stays safe.`;
  const text = [`Your P.R.I.S.M ${portalName} sign-in code is ${code}.`, '', expiry].join('\n');
  const html = [
    `<p>Your P.R.I.S.M ${escapeHtml(portalName)} sign-in code is:</p>`,
    `<p style="font-size:28px;font-weight:700;letter-spacing:6px">${escapeHtml(code)}</p>`,
    `<p>${escapeHtml(expiry)}</p>`,
  ].join('');
  return { subject, text, html };
}

@Injectable()
export class EmailSignInCodeMailAdapter implements EmailSignInCodeDeliveryPort {
  constructor(@Inject(MAIL_TRANSPORT) private readonly transport: MailTransport) {}

  async deliver({ recipient, code, portalName }: { recipient: string; code: string; portalName: string }): Promise<void> {
    const result = await this.transport.send({ idempotencyKey: randomUUID(), to: recipient, ...emailSignInCodeEmail(code, portalName) });
    if (result.status !== 'accepted') throw new Error('Sign-in code email was not accepted by the mail provider');
  }
}
