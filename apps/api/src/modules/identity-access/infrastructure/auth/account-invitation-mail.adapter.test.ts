import { describe, expect, it, vi } from 'vitest';
import type { MailTransport } from '@prism/kernel/mail';
import { AccountInvitationMailAdapter } from './account-invitation-mail.adapter';

const activationUrl = 'https://client.example.test/activate?token=abc_DEF-123';
const AUTHENTICATOR_NOTICE = 'authenticator app';

describe('AccountInvitationMailAdapter', () => {
  it('sends the activation link with the 7-day copy, and mentions the authenticator set-up only for PMCM admins', async () => {
    const transport = { send: vi.fn<MailTransport['send']>(async () => ({ status: 'accepted' as const, receipt: 'email_1' })) };
    const adapter = new AccountInvitationMailAdapter(transport);

    await adapter.deliver({ recipient: 'ana@example.test', name: 'Ana Reyes', role: 'client', activationUrl });
    await adapter.deliver({ recipient: 'maxine@pmcm.test', name: 'Maxine', role: 'pmcm-admin', activationUrl });

    const [client, admin] = transport.send.mock.calls.map(([message]) => message);
    expect(client).toMatchObject({ to: 'ana@example.test', subject: 'Set up your P.R.I.S.M account' });
    expect(client.text).toContain('PMCM created your account. Set a password within 7 days.');
    expect(client.text).toContain(activationUrl);
    expect(client.html).toContain('href="https://client.example.test/activate?token=abc_DEF-123"');
    expect(client.text).not.toContain(AUTHENTICATOR_NOTICE);
    expect(admin.text).toContain(AUTHENTICATOR_NOTICE);
    expect(admin.html).toContain(AUTHENTICATOR_NOTICE);
  });

  it('rejects when the provider does not accept the message, without the link in the error', async () => {
    const transport = { send: vi.fn<MailTransport['send']>(async () => ({ status: 'permanent_failure' as const })) };
    const adapter = new AccountInvitationMailAdapter(transport);

    const error = await adapter.deliver({ recipient: 'ana@example.test', name: 'Ana', role: 'client', activationUrl }).catch((reason: unknown) => reason);

    expect(error).toBeInstanceOf(Error);
    expect((error as Error).message).not.toContain('token=');
  });
});
