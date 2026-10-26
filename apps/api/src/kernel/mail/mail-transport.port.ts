export const MAIL_TRANSPORT = Symbol('MAIL_TRANSPORT');

export interface MailMessage {
  /** Stable per logical message; the provider uses it to collapse retries of the same send. */
  idempotencyKey: string;
  to: string;
  subject: string;
  text: string;
  html: string;
}

export type MailSendResult =
  | { status: 'accepted'; receipt: string }
  | { status: 'retryable_failure' }
  | { status: 'permanent_failure' };

/** Sends one message. Adapters never log message bodies or provider credentials. */
export interface MailTransport {
  send(message: MailMessage): Promise<MailSendResult>;
}
