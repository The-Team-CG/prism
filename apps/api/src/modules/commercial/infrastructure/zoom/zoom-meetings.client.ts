import { ServiceUnavailableException } from '@nestjs/common';
import type { ZoomConfig } from '@prism/kernel/shared';
import type { ZoomMeetings } from '../../contracts/zoom-meetings.port';

const TOKEN_URL = 'https://zoom.us/oauth/token';
const API_URL = 'https://api.zoom.us/v2';
const REQUEST_TIMEOUT_MS = 15_000;

type FetchLike = (url: string, init: { method: string; headers: Record<string, string>; body?: string; signal: AbortSignal }) => Promise<{ ok: boolean; status: number; json(): Promise<unknown> }>;

/** Zoom REST client: account-credentials token (cached until a minute before expiry) and meeting create/delete. */
export class ZoomMeetingsClient implements ZoomMeetings {
  private token: { value: string; expiresAt: number } | null = null;

  constructor(private readonly config: ZoomConfig, private readonly fetchImpl: FetchLike = fetch as unknown as FetchLike, private readonly now: () => number = Date.now) {}

  async create(input: { topic: string; startsAt: Date; durationMinutes: number }) {
    const response = await this.request('POST', '/users/me/meetings', {
      topic: input.topic.slice(0, 200), type: 2, start_time: input.startsAt.toISOString().replace(/\.\d{3}Z$/, 'Z'),
      duration: input.durationMinutes, timezone: 'Asia/Manila', settings: { join_before_host: false, waiting_room: true },
    });
    const body = (await response.json()) as { id?: number | string; join_url?: string };
    if (!body.id || !body.join_url) throw new ServiceUnavailableException('Zoom did not return a meeting');
    return { meetingId: String(body.id), joinUrl: body.join_url };
  }

  async remove(meetingId: string) {
    await this.request('DELETE', `/meetings/${encodeURIComponent(meetingId)}`, undefined, [404]);
  }

  private async request(method: string, path: string, body?: unknown, acceptable: number[] = []) {
    const response = await this.send(`${API_URL}${path}`, { method, headers: { Authorization: `Bearer ${await this.accessToken()}`, 'Content-Type': 'application/json' }, ...(body ? { body: JSON.stringify(body) } : {}) });
    if (!response.ok && !acceptable.includes(response.status)) throw new ServiceUnavailableException(`Zoom returned HTTP ${response.status}`);
    return response;
  }

  private async accessToken() {
    if (this.token && this.token.expiresAt > this.now()) return this.token.value;
    const basic = Buffer.from(`${this.config.clientId}:${this.config.clientSecret}`).toString('base64');
    const response = await this.send(`${TOKEN_URL}?grant_type=account_credentials&account_id=${encodeURIComponent(this.config.accountId)}`, { method: 'POST', headers: { Authorization: `Basic ${basic}` } });
    if (!response.ok) throw new ServiceUnavailableException(`Zoom sign-in failed with HTTP ${response.status}`);
    const token = (await response.json()) as { access_token?: string; expires_in?: number };
    if (!token.access_token) throw new ServiceUnavailableException('Zoom sign-in returned no token');
    this.token = { value: token.access_token, expiresAt: this.now() + Math.max(0, (token.expires_in ?? 3600) - 60) * 1000 };
    return this.token.value;
  }

  private async send(url: string, init: { method: string; headers: Record<string, string>; body?: string }) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    try {
      return await this.fetchImpl(url, { ...init, signal: controller.signal });
    } catch {
      throw new ServiceUnavailableException('Zoom could not be reached');
    } finally {
      clearTimeout(timer);
    }
  }
}
