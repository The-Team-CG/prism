export { MAIL_TRANSPORT, type MailMessage, type MailSendResult, type MailTransport } from './mail-transport.port';
export { MailModule } from './mail.module';
export { MAIL_FROM_ENV, MAIL_TRANSPORT_ENV, RESEND_API_KEY_ENV, mailTransportProblems, resolveMailTransportConfig, type EnvReader, type EnvProblem } from './mail-config';
