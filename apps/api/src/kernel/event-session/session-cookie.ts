import type { Request, Response } from 'express';
import { PRISM_API_SESSION_COOKIE_NAMES, type PrismApiSessionPortal } from '@prism/types';
import { resolvePortalUrls, type PrismPortalUrls } from '../shared/portal-urls';

/**
 * Sign-in redesign, step 5: the session lives in an HttpOnly cookie the API sets, one per portal, so page scripts
 * never hold the token. A request uses the cookie of the portal it comes from (its Origin), so different people can
 * stay signed in to different portals in one browser. Portals and the API must share a site (same registrable domain;
 * any localhost port counts) so the browser sends these cookies; PRISM_SESSION_COOKIE_DOMAIN widens them to a parent
 * domain when the API and portals are on different subdomains.
 */

export const SESSION_COOKIE_DOMAIN_ENV = 'PRISM_SESSION_COOKIE_DOMAIN';

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

/** Which portal an account signs in to. Guests use event access codes, not these cookies. */
export function sessionPortalForRole(role: string): PrismApiSessionPortal | null {
  if (role === 'client') return 'client';
  if (role === 'supplier') return 'supplier';
  if (role === 'pmcm-admin' || role === 'coordinator') return 'event';
  return null;
}

let cachedUrls: PrismPortalUrls | null = null;
function portalUrls(): PrismPortalUrls | null {
  if (cachedUrls) return cachedUrls;
  try {
    cachedUrls = resolvePortalUrls((name) => process.env[name]);
  } catch {
    return null;
  }
  return cachedUrls;
}

function originOf(value: string | undefined): string | null {
  if (!value) return null;
  try {
    return new URL(value).origin;
  } catch {
    return null;
  }
}

/** The portal a request comes from, by its Origin header (sent on every cross-origin fetch). */
export function sessionPortalForOrigin(origin: string | undefined, urls: PrismPortalUrls | null = portalUrls()): PrismApiSessionPortal | null {
  const from = originOf(origin);
  if (!from || !urls) return null;
  for (const portal of Object.keys(PRISM_API_SESSION_COOKIE_NAMES) as PrismApiSessionPortal[]) {
    if (originOf(urls[portal]) === from) return portal;
  }
  return null;
}

export function readCookie(request: Pick<Request, 'headers'>, name: string): string | null {
  const header = request.headers.cookie;
  if (typeof header !== 'string') return null;
  for (const part of header.split(';')) {
    const index = part.indexOf('=');
    if (index < 0) continue;
    if (part.slice(0, index).trim() === name) {
      const value = part.slice(index + 1).trim();
      try {
        return decodeURIComponent(value) || null;
      } catch {
        return null;
      }
    }
  }
  return null;
}

/**
 * The session token from the requesting portal's cookie, or null. A state-changing request must carry the Origin it
 * was matched by, so a page on another site cannot ride the cookie (SameSite=Lax already blocks most of that).
 */
export function sessionTokenFromCookie(request: Pick<Request, 'headers' | 'method'>): string | null {
  if (!request.headers) return null;
  const origin = typeof request.headers.origin === 'string' ? request.headers.origin : undefined;
  const portal = sessionPortalForOrigin(origin);
  if (!portal) {
    // Same-origin GETs (a link to a PDF opened in a new tab) carry no Origin; they may use the Referer's portal.
    if (!SAFE_METHODS.has((request.method ?? 'GET').toUpperCase())) return null;
    const referer = typeof request.headers.referer === 'string' ? request.headers.referer : undefined;
    const fromReferer = sessionPortalForOrigin(referer);
    return fromReferer ? readCookie(request, PRISM_API_SESSION_COOKIE_NAMES[fromReferer]) : null;
  }
  return readCookie(request, PRISM_API_SESSION_COOKIE_NAMES[portal]);
}

function cookieOptions(request: Pick<Request, 'secure'>, expires?: Date) {
  const domain = process.env[SESSION_COOKIE_DOMAIN_ENV]?.trim() || undefined;
  return {
    httpOnly: true,
    // Secure whenever the request reached the API over HTTPS (behind the trusted proxy too), so http://localhost works.
    secure: Boolean(request.secure),
    sameSite: 'lax' as const,
    path: '/',
    ...(domain ? { domain } : {}),
    ...(expires ? { expires } : {}),
  };
}

/**
 * Sets the session cookie for the portal the account belongs to; a role without a portal gets none. Only a sign-in
 * from that portal, or from the shared "Sign in to P.R.I.S.M." page on the client portal, sets it: a sign-in the
 * wrong portal turns away must not replace the person's live session in their own portal.
 */
export function setSessionCookie(request: Pick<Request, 'secure' | 'headers'>, response: Pick<Response, 'cookie'>, session: { accessToken: string; role: string; expiresAt: string }) {
  const portal = sessionPortalForRole(session.role);
  if (!portal) return;
  const origin = typeof request.headers?.origin === 'string' ? request.headers.origin : undefined;
  const from = sessionPortalForOrigin(origin);
  if (from !== portal && from !== 'client') return;
  response.cookie(PRISM_API_SESSION_COOKIE_NAMES[portal], session.accessToken, cookieOptions(request, new Date(session.expiresAt)));
}

/** Clears the requesting portal's session cookie (sign-out). */
export function clearSessionCookie(request: Pick<Request, 'secure' | 'headers'>, response: Pick<Response, 'clearCookie'>) {
  const origin = typeof request.headers.origin === 'string' ? request.headers.origin : undefined;
  const portal = sessionPortalForOrigin(origin);
  if (!portal) return;
  response.clearCookie(PRISM_API_SESSION_COOKIE_NAMES[portal], cookieOptions(request));
}

/** Test seam: forget the portal URLs read from the environment. */
export function resetSessionCookiePortalUrls() {
  cachedUrls = null;
}
