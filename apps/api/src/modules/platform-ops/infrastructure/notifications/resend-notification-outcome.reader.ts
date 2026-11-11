import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { resendDeliveryStatusSchema } from '@prism/types';
import type { EmailOutcomeReader } from '../../contracts/notifications/email-outcome-reader.port';

@Injectable()
export class ResendNotificationOutcomeReader implements EmailOutcomeReader {
  constructor(private readonly config: ConfigService) {}
  async retrieve(receipt: string) {
    const key = this.config.get<string>('RESEND_API_KEY')?.trim();
    if (this.config.get<string>('PRISM_MAIL_TRANSPORT') !== 'resend' || !key) throw new ServiceUnavailableException('External email outcome reporting is not configured');
    try {
      const response = await fetch(`https://api.resend.com/emails/${encodeURIComponent(receipt)}`, { headers: { Authorization: `Bearer ${key}` }, signal: AbortSignal.timeout(10_000) });
      if (!response.ok) throw new Error('Provider unavailable');
      const parsed = resendDeliveryStatusSchema.safeParse(await response.json());
      if (!parsed.success || parsed.data.id !== receipt) throw new Error('Invalid provider status');
      return parsed.data.last_event;
    } catch { throw new ServiceUnavailableException('Unable to retrieve the email provider outcome'); }
  }
}
