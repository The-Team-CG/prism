import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { timingSafeEqual } from 'node:crypto';
import { OpsUserRole } from '@prism/kernel/event-core';
import type { EventSessionRequest } from '@prism/kernel/event-session';
import type { PrismEventOpsActorRole, PrismVerifiedEventActor } from '@prism/types';

export const DEV_RESET_KEY_HEADER = 'x-prism-dev-reset-key';
export const DEV_RESET_KEY_ENV = 'PRISM_DEV_RESET_KEY';
export const SAMPLE_DISPOSABLE_DATABASE = 'prism_sample_disposable';

const RUNTIME_DATABASE_URL_ENV_NAMES = [
  'SUPABASE_DB_URL',
  'DATABASE_URL',
  'PRISMA_DATABASE_URL',
  'DIRECT_URL',
] as const;

function isLoopbackHost(hostname: string) {
  // This early target check is mirrored by the fixture CLI; this server check is authoritative.
  const normalized = hostname.toLowerCase().replace(/^\[|\]$/g, '');
  if (normalized === 'localhost' || normalized === '::1') return true;

  const octets = normalized.split('.').map(Number);
  return octets.length === 4 && octets[0] === 127 && octets.every((octet) => Number.isInteger(octet) && octet >= 0 && octet <= 255);
}

function isDisposableLocalDatabaseConfigured() {
  const connectionString = RUNTIME_DATABASE_URL_ENV_NAMES
    .map((name) => process.env[name]?.trim())
    .find((value) => Boolean(value));
  if (!connectionString) return false;

  try {
    const database = new URL(connectionString);
    const databaseName = decodeURIComponent(database.pathname.replace(/^\/+/, ''));
    return (
      ['postgres:', 'postgresql:'].includes(database.protocol) &&
      isLoopbackHost(database.hostname) &&
      databaseName === SAMPLE_DISPOSABLE_DATABASE
    );
  } catch {
    return false;
  }
}

/**
 * POST /sample/reset is reserved for the explicit local fixture command. It
 * requires a matching reset key and refuses every production or non-disposable
 * database target, even if the caller presents a normal PMCM session.
 */
@Injectable()
export class SampleResetGuard implements CanActivate {
  private readonly logger = new Logger(SampleResetGuard.name);

  canActivate(context: ExecutionContext) {
    const request = context.switchToHttp().getRequest<EventSessionRequest>();

    if (process.env.NODE_ENV === 'production' || !isDisposableLocalDatabaseConfigured()) {
      throw new ForbiddenException(
        `Sample reset is restricted to a local ${SAMPLE_DISPOSABLE_DATABASE} database outside production.`,
      );
    }

    if (!this.hasValidDevResetKey(request)) {
      throw new UnauthorizedException(`A matching ${DEV_RESET_KEY_HEADER} is required for local sample reset.`);
    }

    this.logger.warn(
      `Sample reset authorised via ${DEV_RESET_KEY_HEADER}; the API verified a local ${SAMPLE_DISPOSABLE_DATABASE} target.`,
    );
    request.prismActor = this.devResetActor();
    return true;
  }

  private hasValidDevResetKey(request: EventSessionRequest) {
    const expected = process.env[DEV_RESET_KEY_ENV]?.trim();
    if (!expected) return false;

    const provided = request.headers[DEV_RESET_KEY_HEADER];
    if (typeof provided !== 'string' || !provided) return false;

    const expectedBuffer = Buffer.from(expected, 'utf8');
    const providedBuffer = Buffer.from(provided, 'utf8');
    // timingSafeEqual throws on length mismatch, so compare lengths first. The
    // length of a rejected guess leaks, which is immaterial for a local-only key.
    if (expectedBuffer.length !== providedBuffer.length) return false;
    return timingSafeEqual(expectedBuffer, providedBuffer);
  }

  private devResetActor(): PrismVerifiedEventActor {
    const role = OpsUserRole.System as PrismEventOpsActorRole;
    return {
      id: 'system_dev_reset',
      actorId: 'system_dev_reset',
      role,
      actorRole: role,
      email: 'dev-reset@pmcm.test',
      actorEmail: 'dev-reset@pmcm.test',
      name: 'Local Dev Reset',
      actorName: 'Local Dev Reset',
      expiresAt: new Date(Date.now() + 60_000).toISOString(),
    };
  }
}
