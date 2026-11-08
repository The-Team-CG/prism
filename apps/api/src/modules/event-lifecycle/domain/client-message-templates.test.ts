import { describe, expect, it } from 'vitest';
import { conformeReminderText, inquiryAcceptedText, inquiryDeclinedText, inquiryReceivedText } from './client-message-templates';

describe('FR-55 bilingual client messages', () => {
  it('writes every key message in the chosen language and keeps the same disclosure rules', () => {
    expect(inquiryReceivedText('en', 'Gala')).toBe('We received your inquiry for Gala. PMCM will review it and reply by email.');
    expect(inquiryReceivedText('fil', 'Gala', { hours: 24, link: 'https://x.test/e' })).toMatch(/^Natanggap namin.*24 oras.*https:\/\/x\.test\/e$/);
    expect(inquiryAcceptedText('fil', 'Gala', 'existing_account')).toContain('Mag-sign in');
    expect(inquiryAcceptedText('en', 'Gala', null)).toContain('PMCM will send you a link');
    expect(conformeReminderText('fil')).toContain('conforme');

    expect(inquiryDeclinedText('fil', 'Gala', 'Date Unavailable')).toContain('Hindi kami available');
    // Internal reasons are never disclosed, in either language.
    for (const language of ['en', 'fil'] as const) {
      expect(inquiryDeclinedText(language, 'Gala', 'Budget too low')).not.toMatch(/budget/i);
      expect(inquiryDeclinedText(language, 'Gala').split('. ')[0]).toContain('Gala');
    }
  });
});
