import { ServiceUnavailableException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import { resolveZoomConfig } from '@prism/kernel/shared';
import { ZoomMeetingsClient } from './zoom-meetings.client';

type Call = { url: string; method: string; headers: Record<string, string>; body?: string };

function fakeZoom(responses: Array<{ status: number; body: unknown }>) {
  const calls: Call[] = [];
  const fetchImpl = vi.fn(async (url: string, init: { method: string; headers: Record<string, string>; body?: string }) => {
    calls.push({ url, method: init.method, headers: init.headers, body: init.body });
    const next = responses.shift() ?? { status: 500, body: {} };
    return { ok: next.status >= 200 && next.status < 300, status: next.status, json: async () => next.body };
  });
  return { calls, fetchImpl };
}

const env = (values: Record<string, string>) => (name: string) => values[name];
const config = resolveZoomConfig(env({ ZOOM_ACCOUNT_ID: 'acct_1', ZOOM_CLIENT_ID: 'client_1', ZOOM_CLIENT_SECRET: 'secret_1' }))!;

describe('ZoomMeetingsClient (FR-61, UAT 7.6)', () => {
  it('turns on with exactly the three Zoom variables, and hosts as the app owner unless a host user is set', () => {
    expect(resolveZoomConfig(env({}))).toBeNull();
    expect(config).toEqual({ accountId: 'acct_1', clientId: 'client_1', clientSecret: 'secret_1', hostUser: 'me' });
    expect(() => resolveZoomConfig(env({ ZOOM_ACCOUNT_ID: 'acct_1' }))).toThrow('ZOOM_CLIENT_ID is required');
    expect(resolveZoomConfig(env({ ZOOM_ACCOUNT_ID: 'a', ZOOM_CLIENT_ID: 'b', ZOOM_CLIENT_SECRET: 'c', ZOOM_HOST_USER: 'events@pmcm.test' }))?.hostUser).toBe('events@pmcm.test');
  });

  it('signs in with the account credentials, creates the meeting in Manila time, and reuses the token', async () => {
    const { calls, fetchImpl } = fakeZoom([
      { status: 200, body: { access_token: 'tok_1', expires_in: 3600 } },
      { status: 201, body: { id: 81234567890, join_url: 'https://us02web.zoom.us/j/81234567890' } },
      { status: 204, body: {} },
    ]);
    const client = new ZoomMeetingsClient(config, fetchImpl, () => 0);

    await expect(client.create({ topic: 'Proposal presentation', startsAt: new Date('2027-01-10T02:00:00.000Z'), durationMinutes: 60 }))
      .resolves.toEqual({ meetingId: '81234567890', joinUrl: 'https://us02web.zoom.us/j/81234567890' });
    await client.remove('81234567890');

    expect(calls[0]).toMatchObject({ url: 'https://zoom.us/oauth/token?grant_type=account_credentials&account_id=acct_1', method: 'POST' });
    expect(calls[0]!.headers.Authorization).toBe(`Basic ${Buffer.from('client_1:secret_1').toString('base64')}`);
    expect(calls[1]).toMatchObject({ url: 'https://api.zoom.us/v2/users/me/meetings', method: 'POST' });
    expect(calls[1]!.headers.Authorization).toBe('Bearer tok_1');
    expect(JSON.parse(calls[1]!.body!)).toMatchObject({ topic: 'Proposal presentation', type: 2, start_time: '2027-01-10T02:00:00Z', duration: 60, timezone: 'Asia/Manila', settings: { waiting_room: true } });
    // One sign-in serves both calls.
    expect(calls[2]).toMatchObject({ url: 'https://api.zoom.us/v2/meetings/81234567890', method: 'DELETE' });
    expect(calls).toHaveLength(3);
  });

  it('says what went wrong when Zoom refuses the credentials or the meeting', async () => {
    const badSecret = fakeZoom([{ status: 401, body: {} }]);
    await expect(new ZoomMeetingsClient(config, badSecret.fetchImpl).create({ topic: 'x', startsAt: new Date(), durationMinutes: 30 }))
      .rejects.toThrow(new ServiceUnavailableException('Zoom sign-in failed with HTTP 401'));

    const missingScope = fakeZoom([{ status: 200, body: { access_token: 'tok' } }, { status: 400, body: { message: 'Invalid access token, does not contain scopes' } }]);
    await expect(new ZoomMeetingsClient(config, missingScope.fetchImpl).create({ topic: 'x', startsAt: new Date(), durationMinutes: 30 }))
      .rejects.toThrow('Zoom returned HTTP 400');

    // A meeting already deleted in Zoom is not an error.
    const gone = fakeZoom([{ status: 200, body: { access_token: 'tok' } }, { status: 404, body: {} }]);
    await expect(new ZoomMeetingsClient(config, gone.fetchImpl).remove('1')).resolves.toBeUndefined();
  });
});
