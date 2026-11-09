import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';
import { ServiceUnavailableException } from '@nestjs/common';
import type { CanvaConfig } from '@prism/kernel/shared';

const API = 'https://api.canva.com/rest/v1';
export const CANVA_AUTHORIZE_URL = 'https://www.canva.com/api/oauth/authorize';
export const CANVA_SCOPES = 'design:content:write design:meta:read brandtemplate:content:read brandtemplate:meta:read';
const REQUEST_TIMEOUT_MS = 15_000;
const POLL_ATTEMPTS = 20;
const POLL_INTERVAL_MS = 1_000;

type FetchLike = (url: string, init: { method: string; headers: Record<string, string>; body?: string; signal: AbortSignal }) => Promise<{ ok: boolean; status: number; json(): Promise<unknown> }>;
export type CanvaTokens = { accessToken: string; refreshToken: string; expiresAt: Date };

/** AES-256-GCM for tokens at rest: "iv.tag.ciphertext" in base64. */
export function sealSecret(key: Buffer, plaintext: string) {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const sealed = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  return [iv, cipher.getAuthTag(), sealed].map((part) => part.toString('base64')).join('.');
}

export function openSecret(key: Buffer, value: string) {
  const [iv, tag, sealed] = value.split('.').map((part) => Buffer.from(part, 'base64'));
  if (!iv || !tag || !sealed) throw new Error('Malformed sealed secret');
  const decipher = createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(sealed), decipher.final()]).toString('utf8');
}

/** Canva Connect REST client: OAuth token exchange and refresh, and brand-template autofill jobs. */
export class CanvaApiClient {
  constructor(
    readonly config: CanvaConfig,
    private readonly fetchImpl: FetchLike = fetch as unknown as FetchLike,
    private readonly sleep: (ms: number) => Promise<void> = (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
  ) {}

  exchangeCode(code: string, codeVerifier: string, now = new Date()) {
    return this.token({ grant_type: 'authorization_code', code, code_verifier: codeVerifier, redirect_uri: this.config.redirectUri }, now);
  }

  refresh(refreshToken: string, now = new Date()) {
    return this.token({ grant_type: 'refresh_token', refresh_token: refreshToken }, now);
  }

  async autofill(accessToken: string, brandTemplateId: string, title: string, fields: Record<string, string>) {
    const data = Object.fromEntries(Object.entries(fields).map(([name, text]) => [name, { type: 'text', text: text.slice(0, 2_000) }]));
    const created = await this.call('POST', `${API}/autofills`, accessToken, { brand_template_id: brandTemplateId, title: title.slice(0, 255), data });
    let job = (created as { job?: CanvaJob }).job;
    for (let attempt = 0; job?.status === 'in_progress' && attempt < POLL_ATTEMPTS; attempt += 1) { // QUERY_AUDIT_ALLOW_BOUNDED_LOOP: provider polling only, at most 20 tries.
      await this.sleep(POLL_INTERVAL_MS);
      job = ((await this.call('GET', `${API}/autofills/${encodeURIComponent(job.id)}`, accessToken)) as { job?: CanvaJob }).job;
    }
    const design = job?.status === 'success' ? job.result?.design : undefined;
    if (!design?.id || !design.urls?.edit_url) throw new ServiceUnavailableException(job?.status === 'in_progress' ? 'Canva is still making the design; try again shortly' : 'Canva could not fill the template');
    return { designId: design.id, editUrl: design.urls.edit_url, viewUrl: design.urls.view_url ?? design.urls.edit_url };
  }

  private async token(params: Record<string, string>, now: Date): Promise<CanvaTokens> {
    const basic = Buffer.from(`${this.config.clientId}:${this.config.clientSecret}`).toString('base64');
    const response = await this.send(`${API}/oauth/token`, { method: 'POST', headers: { Authorization: `Basic ${basic}`, 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams(params).toString() });
    if (!response.ok) throw new ServiceUnavailableException(`Canva sign-in failed with HTTP ${response.status}`);
    const body = (await response.json()) as { access_token?: string; refresh_token?: string; expires_in?: number };
    if (!body.access_token || !body.refresh_token) throw new ServiceUnavailableException('Canva sign-in returned no token');
    return { accessToken: body.access_token, refreshToken: body.refresh_token, expiresAt: new Date(now.getTime() + Math.max(0, (body.expires_in ?? 14_400) - 60) * 1000) };
  }

  private async call(method: string, url: string, accessToken: string, body?: unknown) {
    const response = await this.send(url, { method, headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' }, ...(body ? { body: JSON.stringify(body) } : {}) });
    if (!response.ok) throw new ServiceUnavailableException(`Canva returned HTTP ${response.status}`);
    return response.json();
  }

  private async send(url: string, init: { method: string; headers: Record<string, string>; body?: string }) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    try {
      return await this.fetchImpl(url, { ...init, signal: controller.signal });
    } catch {
      throw new ServiceUnavailableException('Canva could not be reached');
    } finally {
      clearTimeout(timer);
    }
  }
}

type CanvaJob = { id: string; status: 'in_progress' | 'success' | 'failed'; result?: { design?: { id?: string; urls?: { edit_url?: string; view_url?: string } } } };
