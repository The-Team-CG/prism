import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { MAIL_TRANSPORT, type MailTransport } from './mail-transport.port';
import { LogMailTransport } from './log-mail-transport';
import { ResendMailTransport } from './resend-mail-transport';
import { MailpitMailTransport } from './mailpit-mail-transport';
import { type MailTransportConfig, resolveMailTransportConfig } from './mail-config';

function createMailTransport(config: MailTransportConfig): MailTransport {
  if (config.kind === 'resend') return new ResendMailTransport({ apiKey: config.apiKey, from: config.from });
  if (config.kind === 'mailpit') return new MailpitMailTransport(config.url);
  return new LogMailTransport();
}

/** Resolves the one mail transport from validated configuration; a missing variable fails module creation. */
@Module({
  imports: [ConfigModule],
  providers: [
    {
      provide: MAIL_TRANSPORT,
      inject: [ConfigService],
      useFactory: (config: ConfigService): MailTransport =>
        createMailTransport(resolveMailTransportConfig((name) => config.get<string>(name))),
    },
  ],
  exports: [MAIL_TRANSPORT],
})
export class MailModule {}
