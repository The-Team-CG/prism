import { describe, expect, it, vi } from 'vitest';
import type { MailTransport } from '@prism/kernel/mail';
import { AccountInvitationMailAdapter } from './account-invitation-mail.adapter';

const activationUrl = 'https://client.example.test/activate?token=abc_DEF-123';
const AUTHENTICATOR_NOTICE = 'authenticator app';

describe('AccountInvitationMailAdapter', () => {
  it('sends a staff invite with the 7-day copy, and mentions the authenticator set-up only for PMCM admins', async () => {
    const transport = { send: vi.fn<MailTransport['send']>(async () => ({ status: 'accepted' as const, receipt: 'email_1' })) };
    const adapter = new AccountInvitationMailAdapter(transport);

    await adapter.deliver({ recipient: 'ana@example.test', name: 'Ana Reyes', role: 'coordinator', source: 'admin', activationUrl });
    await adapter.deliver({ recipient: 'maxine@pmcm.test', name: 'Maxine', role: 'pmcm-admin', source: 'admin', activationUrl });

    const [coordinator, admin] = transport.send.mock.calls.map(([message]) => message);
    expect(coordinator).toMatchObject({ to: 'ana@example.test', subject: 'Set up your P.R.I.S.M account' });
    expect(coordinator.text).toContain('PMCM created your account. Set a password within 7 days.');
    expect(coordinator.text).toContain(activationUrl);
    expect(coordinator.html).toContain('href="https://client.example.test/activate?token=abc_DEF-123"');
    expect(coordinator.text).not.toContain(AUTHENTICATOR_NOTICE);
    expect(admin.text).toContain(AUTHENTICATOR_NOTICE);
    expect(admin.html).toContain(AUTHENTICATOR_NOTICE);
  });

  it('tells an accepted client to set a password to review and sign the conforme', async () => {
    const transport = { send: vi.fn<MailTransport['send']>(async () => ({ status: 'accepted' as const, receipt: 'email_2' })) };
    const adapter = new AccountInvitationMailAdapter(transport);

    await adapter.deliver({ recipient: 'ana@example.test', name: 'Ana Reyes', role: 'client', source: 'inquiry_acceptance', activationUrl });

    const [sent] = transport.send.mock.calls.map(([message]) => message);
    expect(sent.text).toContain('PMCM accepted your inquiry. Set a password to review and sign your conforme.');
    expect(sent.text).toContain('Set a password within 7 days.');
    expect(sent.text).not.toContain('PMCM created your account');
    expect(sent.html).toContain('PMCM accepted your inquiry.');
  });

  it('rejects when the provider does not accept the message, without the link in the error', async () => {
    const transport = { send: vi.fn<MailTransport['send']>(async () => ({ status: 'permanent_failure' as const })) };
    const adapter = new AccountInvitationMailAdapter(transport);

    const error = await adapter.deliver({ recipient: 'ana@example.test', name: 'Ana', role: 'client', source: 'inquiry_acceptance', activationUrl }).catch((reason: unknown) => reason);

    expect(error).toBeInstanceOf(Error);
    expect((error as Error).message).not.toContain('token=');
  });
});
