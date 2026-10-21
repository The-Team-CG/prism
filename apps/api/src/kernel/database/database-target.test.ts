import { describe, expect, it } from 'vitest';
import { resolveDatabaseUrl } from './database-target';

const local = 'postgresql://postgres:postgres@127.0.0.1:54322/postgres';
const remote = 'postgresql://postgres:secret@db.example.com:5432/postgres';
const env = { DATABASE_URL: local, PRISM_LOCAL_DEV: '1', PRISM_LOCAL_DATABASE_HOST: '127.0.0.1', PRISM_LOCAL_DATABASE_PORT: '54322' };

describe('database target selection', () => {
  it('uses one canonical URL despite stale legacy runtime and Prisma aliases', () => {
    const configured = { ...env, SUPABASE_DB_URL: remote, PRISMA_DATABASE_URL: remote };
    expect(resolveDatabaseUrl(configured)).toBe(local);
    expect(resolveDatabaseUrl(configured, 'migration')).toBe(local);
  });
  it('supports a migration-only override for deployments and legacy installations', () => {
    expect(resolveDatabaseUrl({ DATABASE_URL: local, DIRECT_URL: remote })).toBe(local);
    expect(resolveDatabaseUrl({ DATABASE_URL: local, DIRECT_URL: remote }, 'migration')).toBe(remote);
    expect(resolveDatabaseUrl({ SUPABASE_DB_URL: remote })).toBe(remote);
  });
  it.each([remote, '', local.replace('54322', '54323'), local.replace(':54322/postgres', ':54322/other'), `${local}?host=db.example.com`])('rejects an unexpected local target before connection: %s', (DATABASE_URL) => {
    expect(() => resolveDatabaseUrl({ ...env, DATABASE_URL })).toThrow();
  });
  it('rejects remote or divergent migration and shadow overrides', () => {
    expect(() => resolveDatabaseUrl({ ...env, DIRECT_URL: remote }, 'migration')).toThrow();
    expect(() => resolveDatabaseUrl({ ...env, SHADOW_DATABASE_URL: remote }, 'migration')).toThrow();
  });
  it('supports Docker host access only at the generated database port', () => {
    const configured = { ...env, DATABASE_URL: local.replace('127.0.0.1', 'host.docker.internal'), PRISM_LOCAL_DATABASE_HOST: 'host.docker.internal' };
    expect(resolveDatabaseUrl(configured)).toContain('host.docker.internal:54322');
    expect(() => resolveDatabaseUrl({ ...configured, PRISM_LOCAL_DATABASE_HOST: 'db.example.com', DATABASE_URL: remote })).toThrow();
  });
});
