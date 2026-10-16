import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

type DemoPolicyConfigReader = { get(key: string): unknown };

@Injectable()
export class GuestQrDemoPolicyService {
  constructor(@Inject(ConfigService) private readonly config: DemoPolicyConfigReader) {}

  isEnabledForEvent(eventId: string): boolean {
    const environment = this.getString('NODE_ENV')?.trim().toLowerCase();
    if (!environment || environment === 'production') return false;

    if (this.getString('GUEST_QR_DEMO_ENABLED')?.trim().toLowerCase() !== 'true') return false;

    const normalizedEventId = eventId.trim();
    if (!normalizedEventId) return false;
    const allowedEventIds = parseCsv(this.getString('GUEST_QR_DEMO_EVENT_IDS'));
    if (!allowedEventIds?.includes(normalizedEventId)) return false;

    const allowedDatabaseHosts = parseHostAllowlist(this.getString('GUEST_QR_DEMO_DATABASE_HOSTS'));
    if (!allowedDatabaseHosts || allowedDatabaseHosts.size === 0) return false;

    const databaseUrls = this.getConfiguredDatabaseUrls();
    if (!databaseUrls) return false;
    const databaseHosts = databaseUrls.map(databaseHostname);
    return databaseHosts.every((host) => host !== undefined && allowedDatabaseHosts.has(host));
  }

  private getConfiguredDatabaseUrls(): string[] | undefined {
    const configuredRuntimeUrls = ['DATABASE_URL', 'SUPABASE_DB_URL']
      .map((key) => this.getString(key)?.trim())
      .filter((value): value is string => Boolean(value));
    if (configuredRuntimeUrls.length === 0) return undefined;

    const directUrl = this.getString('DIRECT_URL')?.trim();
    const migrationUrl = directUrl || configuredRuntimeUrls[0];
    if (!migrationUrl) return undefined;
    return [...configuredRuntimeUrls, migrationUrl];
  }

  private getString(key: string): string | undefined {
    const value = this.config.get(key);
    return typeof value === 'string' ? value : undefined;
  }
}

function parseCsv(value: string | undefined): string[] | undefined {
  if (!value?.trim()) return undefined;
  const values = value.split(',').map((part) => part.trim());
  if (values.length === 0 || values.some((part) => !part)) return undefined;
  return [...new Set(values)];
}

function parseHostAllowlist(value: string | undefined): Set<string> | undefined {
  const hosts = parseCsv(value);
  if (!hosts) return undefined;

  const normalized = hosts.map(normalizeAllowlistedHostname);
  if (normalized.some((host) => !host)) return undefined;
  return new Set(normalized as string[]);
}

function normalizeAllowlistedHostname(value: string): string | undefined {
  if (value.includes('://') || /[\/?#@]/.test(value)) return undefined;
  try {
    const parsed = new URL(`postgresql://${value}`);
    if (
      parsed.username ||
      parsed.password ||
      (parsed.pathname !== '' && parsed.pathname !== '/') ||
      parsed.search ||
      parsed.hash
    ) return undefined;
    return normalizeHostname(parsed.hostname);
  } catch {
    return undefined;
  }
}

function databaseHostname(value: string): string | undefined {
  try {
    const parsed = new URL(value);
    if (!['postgres:', 'postgresql:'].includes(parsed.protocol)) return undefined;
    return normalizeHostname(parsed.hostname);
  } catch {
    return undefined;
  }
}

function normalizeHostname(value: string): string | undefined {
  const normalized = value.trim().toLowerCase().replace(/\.$/, '');
  return normalized || undefined;
}
