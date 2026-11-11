import { describe, expect, it } from 'vitest';
import { emailOutcomeAdvanceWhere, emailOutcomesBefore, isEmailOutcome } from './email-outcome-order';

describe('email outcome order', () => {
  it('lets an outcome replace only earlier ones, with complaints and bounces outranking delivery', () => {
    expect(emailOutcomesBefore('sent')).toEqual([]);
    expect(emailOutcomesBefore('delivered')).toEqual(['sent', 'delivery_delayed']);
    // Equal ranks never replace each other, so the first report stands.
    expect(emailOutcomesBefore('bounced')).not.toContain('failed');
    expect(emailOutcomesBefore('bounced')).toEqual(expect.arrayContaining(['delivered', 'opened', 'clicked']));
    expect(emailOutcomesBefore('complained')).toEqual(expect.arrayContaining(['bounced', 'delivered', 'clicked']));
    expect(emailOutcomesBefore('delivered')).not.toContain('bounced');
  });

  it('recognises only the outcomes Resend reports and scopes advances to email deliveries with a lower outcome', () => {
    expect(isEmailOutcome('bounced')).toBe(true);
    expect(isEmailOutcome('seen')).toBe(false);
    expect(isEmailOutcome('constructor')).toBe(false);
    expect(emailOutcomeAdvanceWhere('rcpt', 'delivered')).toEqual({
      providerReceipt: 'rcpt', notification: { channel: 'email' },
      OR: [{ providerOutcome: null }, { providerOutcome: { in: ['sent', 'delivery_delayed'] } }],
    });
  });
});
