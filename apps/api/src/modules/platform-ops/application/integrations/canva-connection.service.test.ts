import { randomBytes } from 'node:crypto';
import { BadRequestException, ServiceUnavailableException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import { canvaConfigProblems } from '@prism/kernel/shared';
import { CanvaApiClient, openSecret } from '../../infrastructure/integrations/canva-api.client';
import { TestimonialCanvaService } from '../../../event-lifecycle/application/closure/testimonial-canva.service';
import { CanvaConnectionService } from './canva-connection.service';

const now = new Date('2026-11-11T09:00:00.000Z');
const pmcm = { id: 'usr_pmcm', role: 'pmcm-admin', name: 'Maxine', explicit: true, verified: true } as never;
const config = { clientId: 'cid', clientSecret: 'secret', redirectUri: 'https://api.test/api/integrations/canva/callback', tokenKey: randomBytes(32), templates: { proposal: 'tmpl_proposal' } };

function store() {
  const states = new Map<string, any>();
  let connection: any = null;
  const prisma: any = {
    opsCanvaOauthState: {
      create: vi.fn(async ({ data }: any) => { states.set(data.stateHash, data); return data; }),
      findUnique: vi.fn(async ({ where }: any) => states.get(where.stateHash) ?? null),
      delete: vi.fn(async ({ where }: any) => { states.delete(where.stateHash); }),
    },
    opsCanvaConnection: {
      findUnique: vi.fn(async () => connection),
      upsert: vi.fn(async ({ create }: any) => { connection = { ...create }; return connection; }),
      update: vi.fn(async ({ data }: any) => Object.assign(connection, data)),
      deleteMany: vi.fn(async () => { connection = null; return { count: 1 }; }),
    },
  };
  return { prisma, states, getConnection: () => connection };
}

function canvaFetch() {
  let tokenCalls = 0;
  return vi.fn(async (url: string, init: { body?: string }) => {
    if (url.endsWith('/oauth/token')) {
      tokenCalls += 1;
      return { ok: true, status: 200, json: async () => ({ access_token: `access_${tokenCalls}`, refresh_token: `refresh_${tokenCalls}`, expires_in: 14_400 }) };
    }
    if (url.endsWith('/autofills')) return { ok: true, status: 200, json: async () => ({ job: { id: 'job_1', status: 'success', result: { design: { id: 'des_1', urls: { edit_url: 'https://canva.test/edit', view_url: 'https://canva.test/view' } } } } }) };
    throw new Error(`unexpected ${url} ${init.body ?? ''}`);
  });
}

const access = { requireActorRole: vi.fn(async () => undefined) };

describe('Canva connection (FR-59, New-P3)', () => {
  it('connects through a single-use PKCE state and stores only sealed tokens', async () => {
    const { prisma, getConnection } = store();
    const fetchImpl = canvaFetch();
    const service = new CanvaConnectionService(prisma, access as never, new CanvaApiClient(config, fetchImpl as never, async () => undefined));

    const { url } = await service.authorizationUrl(pmcm, now);
    const params = new URL(url).searchParams;
    expect(params.get('code_challenge_method')).toBe('s256');
    const state = params.get('state')!;

    await expect(service.completeAuthorization('code_1', 'forged-state', now)).rejects.toBeInstanceOf(BadRequestException);
    await service.completeAuthorization('code_1', state, now);
    const tokenBody = new URLSearchParams((fetchImpl.mock.calls[0] as unknown as [string, { body: string }])[1].body);
    expect(tokenBody.get('grant_type')).toBe('authorization_code');
    expect(tokenBody.get('code_verifier')).toHaveLength(64);
    expect(getConnection().accessTokenSealed).not.toContain('access_1');
    expect(openSecret(config.tokenKey, getConnection().refreshTokenSealed)).toBe('refresh_1');
    await expect(service.completeAuthorization('code_1', state, now)).rejects.toThrow('expired');
    await expect(service.status(pmcm)).resolves.toMatchObject({ configured: true, connected: true, templates: { proposal: true, testimonial: false } });
  });

  it('fills a configured template, refreshing an expired token, and refuses an unset template', async () => {
    const { prisma, getConnection } = store();
    const fetchImpl = canvaFetch();
    const service = new CanvaConnectionService(prisma, access as never, new CanvaApiClient(config, fetchImpl as never, async () => undefined));
    const { url } = await service.authorizationUrl(pmcm, now);
    await service.completeAuthorization('code_1', new URL(url).searchParams.get('state')!, now);
    getConnection().accessExpiresAt = new Date('2026-01-01T00:00:00.000Z');

    await expect(service.fillTemplate('proposal', { title: 'Gala proposal', fields: { title: 'Gala', total: 'PHP 1,000' } })).resolves.toEqual({ designId: 'des_1', editUrl: 'https://canva.test/edit', viewUrl: 'https://canva.test/view' });
    const autofill = fetchImpl.mock.calls.find(([called]) => String(called).endsWith('/autofills')) as unknown as [string, { headers: Record<string, string>; body: string }];
    expect(autofill[1].headers.Authorization).toBe('Bearer access_2');
    expect(JSON.parse(autofill[1].body)).toMatchObject({ brand_template_id: 'tmpl_proposal', data: { title: { type: 'text', text: 'Gala' } } });
    await expect(service.fillTemplate('testimonial', { title: 'x', fields: {} })).rejects.toBeInstanceOf(ServiceUnavailableException);
    expect(canvaConfigProblems((name) => (name === 'CANVA_CLIENT_ID' ? 'cid' : undefined)).map((problem) => problem.name)).toEqual(['CANVA_CLIENT_SECRET', 'CANVA_REDIRECT_URI', 'CANVA_TOKEN_KEY']);
  });

  it('uses only an approved testimonial the client agreed to share', async () => {
    const response = { id: 'cr_1', testimonial: 'Flawless night', testimonialConsent: true, moderationStatus: 'pending', rating: 5 };
    const prisma = { opsEvent: { findUnique: vi.fn(async () => ({ eventName: 'Gala', clientName: 'Acme' })) }, opsClientCloseoutResponse: { findUnique: vi.fn(async () => response) } };
    const canva = { fillTemplate: vi.fn(async () => ({ designId: 'des_2', editUrl: 'https://canva.test/e2', viewUrl: 'https://canva.test/v2' })) };
    const service = new TestimonialCanvaService(prisma as never, access as never, { write: vi.fn(async () => undefined) } as never, canva);

    await expect(service.fill('evt_1', pmcm)).rejects.toBeInstanceOf(BadRequestException);
    response.moderationStatus = 'approved';
    await expect(service.fill('evt_1', pmcm)).resolves.toMatchObject({ editUrl: 'https://canva.test/e2' });
    expect(canva.fillTemplate).toHaveBeenCalledWith('testimonial', expect.objectContaining({ fields: expect.objectContaining({ testimonial: 'Flawless night', client_name: 'Acme', rating: '5 out of 5' }) }));
  });
});
