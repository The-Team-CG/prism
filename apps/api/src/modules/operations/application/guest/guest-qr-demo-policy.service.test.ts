import { ConfigService } from '@nestjs/config';
import { describe, expect, it } from 'vitest';
import { GuestQrDemoPolicyService } from './guest-qr-demo-policy.service.js';

const configuredDemo = {
  NODE_ENV: 'test',
  GUEST_QR_DEMO_ENABLED: 'true',
  GUEST_QR_DEMO_EVENT_IDS: 'evt_synthetic',
  GUEST_QR_DEMO_DATABASE_HOSTS: 'demo-db.internal',
  DATABASE_URL: 'postgresql://demo_user:secret@demo-db.internal:5432/prism',
  DIRECT_URL: 'postgresql://migration_user:secret@demo-db.internal:6543/prism',
};

function createPolicy(config: Record<string, string | undefined> = configuredDemo) {
  return new GuestQrDemoPolicyService(new ConfigService(config));
}

describe('GuestQrDemoPolicyService', () => {
  it('allows only an explicitly enabled synthetic event on allowlisted database hosts', () => {
    expect(createPolicy().isEnabledForEvent('evt_synthetic')).toBe(true);
  });

  it.each([
    ['default-off flag', { GUEST_QR_DEMO_ENABLED: undefined }],
    ['missing event allowlist', { GUEST_QR_DEMO_EVENT_IDS: undefined }],
    ['missing database host allowlist', { GUEST_QR_DEMO_DATABASE_HOSTS: undefined }],
    ['malformed runtime database URL', { DATABASE_URL: 'not a database url' }],
    ['mismatched runtime database host', { DATABASE_URL: 'postgresql://user:secret@prod-db.internal/prism' }],
    ['mismatched migration database host', { DIRECT_URL: 'postgresql://user:secret@prod-db.internal/prism' }],
  ])('fails closed for %s', (_label, overrides) => {
    expect(createPolicy({ ...configuredDemo, ...overrides }).isEnabledForEvent('evt_synthetic')).toBe(false);
  });

  it('fails closed in production even when every demo setting is enabled', () => {
    expect(createPolicy({ ...configuredDemo, NODE_ENV: 'production' }).isEnabledForEvent('evt_synthetic')).toBe(false);
  });

  it('fails closed for an event outside the synthetic event allowlist', () => {
    expect(createPolicy().isEnabledForEvent('evt_real')).toBe(false);
  });

  it('does not allow a request-supplied override to enable the demo', () => {
    expect(createPolicy({
      ...configuredDemo,
      GUEST_QR_DEMO_ENABLED: 'false',
      GUEST_QR_DEMO_REQUEST_OVERRIDE: 'true',
    }).isEnabledForEvent('evt_synthetic')).toBe(false);
  });

  it('checks every configured runtime database URL and the migration URL', () => {
    expect(createPolicy({
      ...configuredDemo,
      SUPABASE_DB_URL: 'postgresql://supabase_user:secret@demo-db.internal:5432/prism',
      GUEST_QR_DEMO_DATABASE_HOSTS: 'demo-db.internal',
    }).isEnabledForEvent('evt_synthetic')).toBe(true);
    expect(createPolicy({
      ...configuredDemo,
      SUPABASE_DB_URL: 'postgresql://supabase_user:secret@prod-db.internal:5432/prism',
      GUEST_QR_DEMO_DATABASE_HOSTS: 'demo-db.internal',
    }).isEnabledForEvent('evt_synthetic')).toBe(false);
  });
});
