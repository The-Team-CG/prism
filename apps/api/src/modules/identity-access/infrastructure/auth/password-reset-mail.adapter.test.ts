import { describe, expect, it, vi } from 'vitest';
import type { MailTransport } from '@prism/kernel/mail';
import { PasswordResetMailAdapter } from './password-reset-mail.adapter';

const resetUrl = 'https://client.example.test/password-reset?token=abc_DEF-123';

describe('PasswordResetMailAdapter', () => {
  it('sends the reset link with the subject and the expiry notice in both bodies', async () => {
    const transport = { send: vi.fn<MailTransport['send']>(async () => ({ status: 'accepted' as const, receipt: 'email_1' })) };
    const adapter = new PasswordResetMailAdapter(transport);

    await adapter.deliver({ recipient: 'ana@example.test', resetUrl });

    expect(transport.send).toHaveBeenCalledWith(expect.objectContaining({
      to: 'ana@example.test',
      subject: 'Reset your P.R.I.S.M password',
    }));
    const sent = transport.send.mock.calls[0][0];
    const notice = "This link expires in 15 minutes. If you didn't ask for this, ignore this email.";
    expect(sent.text).toContain(resetUrl);
    expect(sent.text).toContain(notice);
    expect(sent.html).toContain('This link expires in 15 minutes.');
    expect(sent.html).toContain('ignore this email.');
    expect(sent.html).toContain('href="https://client.example.test/password-reset?token=abc_DEF-123"');
  });

  it('rejects when the provider does not accept the message, without the URL in the error', async () => {
    const transport = { send: vi.fn<MailTransport['send']>(async () => ({ status: 'permanent_failure' as const })) };
    const adapter = new PasswordResetMailAdapter(transport);

    const error = await adapter.deliver({ recipient: 'ana@example.test', resetUrl }).catch((reason: unknown) => reason);

    expect(error).toBeInstanceOf(Error);
    expect((error as Error).message).not.toContain('token=');
  });
});
