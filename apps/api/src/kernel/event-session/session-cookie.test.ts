import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { clearSessionCookie, resetSessionCookiePortalUrls, sessionPortalForOrigin, sessionTokenFromCookie, setSessionCookie } from './session-cookie';

const urls = { client: 'http://localhost:3001', supplier: 'http://localhost:3002', event: 'http://localhost:3004' };
const cookies = 'prism_api_client=client-token; prism_api_event=event-token; other=1';

beforeEach(() => {
  vi.stubEnv('PRISM_CLIENT_PORTAL_URL', urls.client);
  vi.stubEnv('PRISM_SUPPLIER_PORTAL_URL', urls.supplier);
  vi.stubEnv('PRISM_EVENT_PORTAL_URL', urls.event);
  resetSessionCookiePortalUrls();
});
afterEach(() => {
  vi.unstubAllEnvs();
  resetSessionCookiePortalUrls();
});

describe('per-portal session cookies (sign-in redesign)', () => {
  it('uses the cookie of the portal the request comes from, so two people can be signed in to two portals', () => {
    expect(sessionPortalForOrigin('http://localhost:3004', urls)).toBe('event');
    expect(sessionTokenFromCookie({ method: 'POST', headers: { origin: urls.client, cookie: cookies } })).toBe('client-token');
    expect(sessionTokenFromCookie({ method: 'GET', headers: { origin: urls.event, cookie: cookies } })).toBe('event-token');
    // The supplier portal has no cookie here, so a supplier request is not signed in by someone else's cookie.
    expect(sessionTokenFromCookie({ method: 'GET', headers: { origin: urls.supplier, cookie: cookies } })).toBeNull();
  });

  it('refuses the cookie for a state change from an unknown site, and allows a same-site GET by its Referer', () => {
    expect(sessionTokenFromCookie({ method: 'POST', headers: { origin: 'https://evil.example', cookie: cookies } })).toBeNull();
    expect(sessionTokenFromCookie({ method: 'POST', headers: { referer: `${urls.event}/dashboard`, cookie: cookies } })).toBeNull();
    expect(sessionTokenFromCookie({ method: 'GET', headers: { referer: `${urls.event}/dashboard`, cookie: cookies } })).toBe('event-token');
  });

  it('sets an HttpOnly, SameSite=Lax cookie for the account\'s own portal, Secure only over HTTPS, and clears it on sign-out', () => {
    const cookie = vi.fn();
    setSessionCookie({ secure: false, headers: { origin: urls.event } }, { cookie } as never, { accessToken: 'tok', role: 'coordinator', expiresAt: '2026-12-02T00:00:00.000Z' });
    expect(cookie).toHaveBeenCalledWith('prism_api_event', 'tok', expect.objectContaining({ httpOnly: true, sameSite: 'lax', secure: false, path: '/', expires: new Date('2026-12-02T00:00:00.000Z') }));

    vi.stubEnv('PRISM_SESSION_COOKIE_DOMAIN', '.prism.example');
    setSessionCookie({ secure: true, headers: { origin: urls.client } }, { cookie } as never, { accessToken: 'tok', role: 'client', expiresAt: '2026-12-02T00:00:00.000Z' });
    expect(cookie).toHaveBeenLastCalledWith('prism_api_client', 'tok', expect.objectContaining({ secure: true, domain: '.prism.example' }));

    // The shared sign-in page on the client portal signs a supplier in to the supplier portal.
    setSessionCookie({ secure: false, headers: { origin: urls.client } }, { cookie } as never, { accessToken: 'sup', role: 'supplier', expiresAt: '2026-12-02T00:00:00.000Z' });
    expect(cookie).toHaveBeenLastCalledWith('prism_api_supplier', 'sup', expect.anything());

    // A client turned away by the event portal keeps their live client-portal session; guests get no cookie at all.
    cookie.mockClear();
    setSessionCookie({ secure: false, headers: { origin: urls.event } }, { cookie } as never, { accessToken: 'tok', role: 'client', expiresAt: '2026-12-02T00:00:00.000Z' });
    expect(cookie).not.toHaveBeenCalled();
    setSessionCookie({ secure: false, headers: { origin: urls.client } }, { cookie } as never, { accessToken: 'tok', role: 'guest', expiresAt: '2026-12-02T00:00:00.000Z' });
    expect(cookie).not.toHaveBeenCalled();

    const clearCookie = vi.fn();
    clearSessionCookie({ secure: false, headers: { origin: urls.supplier } } as never, { clearCookie } as never);
    expect(clearCookie).toHaveBeenCalledWith('prism_api_supplier', expect.objectContaining({ httpOnly: true }));
  });
});
