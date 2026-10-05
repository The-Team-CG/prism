import { createHmac, timingSafeEqual } from 'node:crypto';
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type {
  PrismAuthenticatedSession,
  PrismEventOpsActorRole,
  PrismUser,
  PrismVerifiedEventActor,
} from '@prism/types';
import { PRISM_EVENT_OPS_ACTOR_ROLES } from '@prism/types';

const DEFAULT_SESSION_TTL_SECONDS = 8 * 60 * 60;
const TOKEN_HEADER = { alg: 'HS256', typ: 'JWT' } as const;

type SessionTokenPayload = {
  sub: string;
  name: string;
  email: string;
  role: PrismEventOpsActorRole;
  organization: string;
  sessionVersion?: number;
  iat: number;
  exp: number;
};

export type TwoFactorTokenPurpose = 'setup' | 'challenge';

export type VerifiedTwoFactorToken = {
  userId: string;
  email: string;
  role: 'pmcm-admin';
  purpose: TwoFactorTokenPurpose;
  challengeId: string;
  sessionVersion: number;
};

const TWO_FACTOR_TOKEN_TTL_SECONDS = 10 * 60;
function encodeJson(value: unknown) {
  return Buffer.from(JSON.stringify(value), 'utf8').toString('base64url');
}

function decodeJson<T>(value: string): T {
  return JSON.parse(Buffer.from(value, 'base64url').toString('utf8')) as T;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isEventOpsActorRole(value: unknown): value is PrismEventOpsActorRole {
  return typeof value === 'string' && PRISM_EVENT_OPS_ACTOR_ROLES.includes(value as PrismEventOpsActorRole);
}

@Injectable()
export class AuthSessionService {
  constructor(private readonly configService: ConfigService) {}

  issueSession(user: PrismUser, issuedAt = new Date()): PrismAuthenticatedSession {
    const issuedAtSeconds = Math.floor(issuedAt.getTime() / 1000);
    const ttlSeconds = this.sessionTtlSeconds(user.role);
    const expiresAtSeconds = issuedAtSeconds + ttlSeconds;
    const expiresAt = new Date(expiresAtSeconds * 1000).toISOString();

    return {
      ...user,
      accessToken: this.signPayload({
        sub: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        organization: user.organization,
        sessionVersion: user.sessionVersion ?? 0,
        iat: issuedAtSeconds,
        exp: expiresAtSeconds,
      }),
      expiresAt,
      signedInAt: issuedAt.toISOString(),
      tokenType: 'Bearer',
    };
  }

  verifyAccessToken(token: string): PrismVerifiedEventActor {
    const payload = this.verifyPayload(token);
    const expiresAt = new Date(payload.exp * 1000).toISOString();

    return {
      id: payload.sub,
      actorId: payload.sub,
      role: payload.role,
      actorRole: payload.role,
      email: payload.email,
      actorEmail: payload.email,
      sessionVersion: payload.sessionVersion ?? 0,
      name: payload.name,
      actorName: payload.name,
      expiresAt,
    };
  }

  issueTwoFactorToken(
    input: { userId: string; email: string; role: 'pmcm-admin'; challengeId: string; sessionVersion: number },
    purpose: TwoFactorTokenPurpose,
    issuedAt = new Date(),
  ) {
    const issuedAtSeconds = Math.floor(issuedAt.getTime() / 1000);
    return this.signPayload({
      sub: input.userId,
      email: input.email,
      role: input.role,
      jti: input.challengeId,
      sessionVersion: input.sessionVersion,
      purpose,
      iat: issuedAtSeconds,
      exp: issuedAtSeconds + TWO_FACTOR_TOKEN_TTL_SECONDS,
    });
  }

  twoFactorTokenExpiresAt(issuedAt = new Date()) {
    return new Date((Math.floor(issuedAt.getTime() / 1000) + TWO_FACTOR_TOKEN_TTL_SECONDS) * 1000);
  }

  verifyTwoFactorToken(token: string): VerifiedTwoFactorToken {
    const payload = this.verifySignedPayload(token);
    if (
      !isRecord(payload) ||
      typeof payload.sub !== 'string' ||
      typeof payload.email !== 'string' ||
      payload.role !== 'pmcm-admin' ||
      typeof payload.jti !== 'string' ||
      !/^[A-Za-z0-9_-]{43}$/.test(payload.jti) ||
      (payload.sessionVersion !== undefined &&
        (typeof payload.sessionVersion !== 'number' || !Number.isSafeInteger(payload.sessionVersion) || payload.sessionVersion < 0)) ||
      (payload.purpose !== 'setup' && payload.purpose !== 'challenge')
    ) {
      throw new UnauthorizedException('Invalid two-factor token');
    }
    return {
      userId: payload.sub,
      email: payload.email,
      role: payload.role,
      purpose: payload.purpose,
      challengeId: payload.jti,
      sessionVersion: typeof payload.sessionVersion === 'number' ? payload.sessionVersion : 0,
    };
  }

  private signPayload(payload: Record<string, unknown>) {
    const encodedHeader = encodeJson(TOKEN_HEADER);
    const encodedPayload = encodeJson(payload);
    const signature = this.sign(`${encodedHeader}.${encodedPayload}`);
    return `${encodedHeader}.${encodedPayload}.${signature}`;
  }

  private verifyPayload(token: string): SessionTokenPayload {
    const payload = this.verifySignedPayload(token);
    if (!this.isSessionPayload(payload)) throw new UnauthorizedException('Invalid session token');
    return payload;
  }

  private verifySignedPayload(token: string): unknown {
    const [encodedHeader, encodedPayload, signature, extra] = token.split('.');
    if (!encodedHeader || !encodedPayload || !signature || extra) throw new UnauthorizedException('Invalid session token');
    const expectedSignature = this.sign(`${encodedHeader}.${encodedPayload}`);
    if (!this.equalSignatures(signature, expectedSignature)) throw new UnauthorizedException('Invalid session token');

    let payload: unknown;
    try {
      payload = decodeJson<unknown>(encodedPayload);
    } catch {
      throw new UnauthorizedException('Invalid session token');
    }
    if (!isRecord(payload) || typeof payload.exp !== 'number') throw new UnauthorizedException('Invalid session token');
    if (payload.exp <= Math.floor(Date.now() / 1000)) throw new UnauthorizedException('Session token expired');
    return payload;
  }

  private isSessionPayload(value: unknown): value is SessionTokenPayload {
    return (
      isRecord(value) &&
      typeof value.sub === 'string' &&
      typeof value.name === 'string' &&
      typeof value.email === 'string' &&
      isEventOpsActorRole(value.role) &&
      typeof value.organization === 'string' &&
      typeof value.iat === 'number' &&
      typeof value.exp === 'number'
    );
  }

  private sign(value: string) {
    return createHmac('sha256', this.sessionSecret()).update(value).digest('base64url');
  }

  private equalSignatures(left: string, right: string) {
    const leftBuffer = Buffer.from(left);
    const rightBuffer = Buffer.from(right);
    return leftBuffer.length === rightBuffer.length && timingSafeEqual(leftBuffer, rightBuffer);
  }

  private sessionSecret() {
    const configured = this.configService.get<string>('PRISM_SESSION_SECRET') ?? this.configService.get<string>('JWT_SECRET');
    if (configured && configured.length >= 32) return configured;

    const nodeEnv = this.configService.get<string>('NODE_ENV') ?? process.env.NODE_ENV;
    const allowLocalSecret =
      nodeEnv !== 'production' &&
      (nodeEnv === 'test' ||
        nodeEnv === 'development' ||
        this.configService.get<string>('PRISM_ALLOW_LOCAL_SESSION_SECRET') === '1');
    if (allowLocalSecret) return 'prism-local-sample-auth-session-secret';

    throw new Error('PRISM_SESSION_SECRET or JWT_SECRET must be configured with at least 32 characters');
  }

  private sessionTtlSeconds(role?: PrismEventOpsActorRole) {
    const roleKey = role ? `PRISM_SESSION_TTL_SECONDS_${role.replace(/[^a-z0-9]/gi, '_').toUpperCase()}` : undefined;
    const raw = (roleKey ? this.configService.get<string>(roleKey) : undefined) ?? this.configService.get<string>('PRISM_SESSION_TTL_SECONDS');
    const parsed = raw ? Number(raw) : NaN;
    return Number.isFinite(parsed) && parsed > 0 ? Math.trunc(parsed) : DEFAULT_SESSION_TTL_SECONDS;
  }
}
