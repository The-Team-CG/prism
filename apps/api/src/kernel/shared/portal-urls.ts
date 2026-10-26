import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import type { PrismPortalApp } from '@prism/types';

/** Portals the API sends people to: password reset, account invitations and supplier status. Guests sign in with event codes, so they have no API link. */
export type ApiLinkedPortalApp = Extract<PrismPortalApp, 'client' | 'supplier' | 'event'>;

export type PrismPortalUrls = Record<ApiLinkedPortalApp, string>;

export const PRISM_PORTAL_URLS = Symbol('PRISM_PORTAL_URLS');

export const PORTAL_URL_ENV: Record<ApiLinkedPortalApp, string> = {
  client: 'PRISM_CLIENT_PORTAL_URL',
  supplier: 'PRISM_SUPPLIER_PORTAL_URL',
  event: 'PRISM_EVENT_PORTAL_URL',
};

const PORTAL_APPS = Object.keys(PORTAL_URL_ENV) as ApiLinkedPortalApp[];

/** https everywhere, or http on loopback only; no credentials and no fragment. */
export function isTrustedPortalUrl(url: URL): boolean {
  if (url.username || url.password || url.hash) return false;
  if (url.protocol === 'https:') return true;
  return url.protocol === 'http:' && ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname);
}

function isTrustedPortalValue(raw: string): boolean {
  try {
    return isTrustedPortalUrl(new URL(raw));
  } catch {
    return false;
  }
}

/** Returns the problems with the four portal URL variables. Values are never echoed. */
export function portalUrlProblems(read: (name: string) => string | undefined): Array<{ name: string; message: string }> {
  return PORTAL_APPS.flatMap((app) => {
    const name = PORTAL_URL_ENV[app];
    const raw = read(name)?.trim() ?? '';
    if (!raw) return [{ name, message: 'is required and must be the portal origin (https, or http on localhost)' }];
    return isTrustedPortalValue(raw)
      ? []
      : [{ name, message: 'must be the portal origin (https, or http on localhost) without credentials or a fragment' }];
  });
}

/** Resolves validated portal origins without a trailing slash. Throws when any value is missing or untrusted. */
export function resolvePortalUrls(read: (name: string) => string | undefined): PrismPortalUrls {
  const problems = portalUrlProblems(read);
  if (problems.length > 0) throw new Error(problems.map((problem) => `${problem.name} ${problem.message}`).join('; '));
  return Object.fromEntries(PORTAL_APPS.map((app) => [
    app,
    (read(PORTAL_URL_ENV[app]) ?? '').trim().replace(/\/+$/, ''),
  ])) as PrismPortalUrls;
}

@Module({
  imports: [ConfigModule],
  providers: [
    {
      provide: PRISM_PORTAL_URLS,
      inject: [ConfigService],
      useFactory: (config: ConfigService): PrismPortalUrls => resolvePortalUrls((name) => config.get<string>(name)),
    },
  ],
  exports: [PRISM_PORTAL_URLS],
})
export class PortalUrlsModule {}
