import { z } from 'zod';
import type { MailMessage, MailSendResult, MailTransport } from './mail-transport.port';

export const RESEND_EMAILS_URL = 'https://api.resend.com/emails';
const REQUEST_TIMEOUT_MS = 10_000;

const resendAcceptedSchema = z.object({ id: z.string().trim().min(1) });

/**
 * Resend over its HTTP API (no SDK). The Idempotency-Key header carries the message key, so a retry
 * after an uncertain timeout cannot send twice. Errors never include the key, the body or the recipient.
 */
export class ResendMailTransport implements MailTransport {
  constructor(private readonly options: { apiKey: string; from: string }) {}

  async send(message: MailMessage): Promise<MailSendResult> {
    let response: Response;
    try {
      response = await fetch(RESEND_EMAILS_URL, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.options.apiKey}`,
          'Content-Type': 'application/json',
          'Idempotency-Key': message.idempotencyKey,
        },
        body: JSON.stringify({
          from: this.options.from,
          to: [message.to],
          subject: message.subject,
          text: message.text,
          html: message.html,
        }),
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      });
    } catch {
      return { status: 'retryable_failure' };
    }

    if (response.ok) {
      try {
        const accepted = resendAcceptedSchema.safeParse(await response.json());
        return accepted.success
          ? { status: 'accepted', receipt: accepted.data.id }
          : { status: 'retryable_failure' };
      } catch {
        return { status: 'retryable_failure' };
      }
    }
    if (response.status === 408 || response.status === 429 || response.status >= 500) {
      return { status: 'retryable_failure' };
    }
    return { status: 'permanent_failure' };
  }
}
