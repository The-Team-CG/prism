import { BadRequestException, Injectable, ServiceUnavailableException, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { resendWebhookEventSchema } from '@prism/types';
import { verifyResendWebhook, type ResendWebhookHeaders } from '../../infrastructure/notifications/resend-webhook-signature';
import { NotificationProviderOutcomeService } from './notification-provider-outcome.service';
import { isEmailOutcome } from './email-outcome-order';

/** Resend event types this service records; everything else is acknowledged and ignored. */
const EVENT_PREFIX = 'email.';

@Injectable()
export class ResendWebhookService {
  constructor(private readonly config: ConfigService, private readonly outcomes: NotificationProviderOutcomeService) {}

  async handle(rawBody: Buffer | undefined, headers: ResendWebhookHeaders, now = new Date()) {
    const secret = this.config.get<string>('RESEND_WEBHOOK_SECRET')?.trim();
    if (!secret) throw new ServiceUnavailableException('Resend delivery webhooks are not configured');
    if (!rawBody || !verifyResendWebhook(secret, rawBody, headers, now)) throw new UnauthorizedException('Invalid Resend signature');
    let json: unknown;
    try { json = JSON.parse(rawBody.toString('utf8')); } catch { throw new BadRequestException('Invalid Resend webhook'); }
    const event = resendWebhookEventSchema.safeParse(json);
    if (!event.success) throw new BadRequestException('Invalid Resend webhook');
    const outcome = event.data.type.startsWith(EVENT_PREFIX) ? event.data.type.slice(EVENT_PREFIX.length) : '';
    if (isEmailOutcome(outcome)) await this.outcomes.recordEmailOutcome(event.data.data.email_id, outcome);
    return {};
  }
}
