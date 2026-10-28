import { z } from 'zod';
import type { MailMessage, MailSendResult, MailTransport } from './mail-transport.port';

const acceptedSchema = z.object({ ID: z.string().min(1) });

export class MailpitMailTransport implements MailTransport {
  constructor(private readonly url: string) {}

  async send(message: MailMessage): Promise<MailSendResult> {
    try {
      const response = await fetch(`${this.url}/api/v1/send`, {
        method: 'POST', redirect: 'error', signal: AbortSignal.timeout(10_000),
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ From: { Email: 'no-reply@prism.test', Name: 'P.R.I.S.M' }, To: [{ Email: message.to }], Subject: message.subject,
          Text: message.text, HTML: message.html, Headers: { 'X-Prism-Idempotency-Key': message.idempotencyKey } }),
      });
      if (!response.ok) return { status: response.status === 408 || response.status === 429 || response.status >= 500 ? 'retryable_failure' : 'permanent_failure' };
      const accepted = acceptedSchema.safeParse(await response.json());
      return accepted.success ? { status: 'accepted', receipt: `mailpit:${accepted.data.ID}` } : { status: 'retryable_failure' };
    } catch { return { status: 'retryable_failure' }; }
  }
}
