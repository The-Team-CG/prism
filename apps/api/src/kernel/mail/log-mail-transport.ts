import { Logger } from '@nestjs/common';
import type { MailMessage, MailSendResult, MailTransport } from './mail-transport.port';

/**
 * Local development only (PRISM_MAIL_TRANSPORT=log, rejected under NODE_ENV=production).
 * Writes the whole message, links included, to the API log so a developer can open it.
 */
export class LogMailTransport implements MailTransport {
  private readonly logger = new Logger('LogMailTransport');

  async send(message: MailMessage): Promise<MailSendResult> {
    this.logger.log(`Mail to ${message.to} (key ${message.idempotencyKey})\nSubject: ${message.subject}\n\n${message.text}`);
    return { status: 'accepted', receipt: `log:${message.idempotencyKey}` };
  }
}
