import { Inject, Injectable, Optional, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash } from 'node:crypto';
import { PrismTransactionRunner, type PrismTransactionContext } from '@prism/kernel/shared-kernel';
import { GAME_ACTION_CLOCK } from '../contracts/game-action-store.port';
import type { GameRateLimitRequest, GameRateLimiterPort } from '../contracts/game-rate-limiter.port';

interface RateLimitBucket {
  key: string;
  maxRequests: number;
}

interface RateLimitCounterRow {
  request_count: number;
}

const WINDOW_MS = 60_000;
const RETENTION_MS = 3 * 60 * 60 * 1000;
const CLEANUP_INTERVAL_MS = 30_000;
const CLEANUP_BATCH_SIZE = 20_000;

@Injectable()
export class EventGamesPostgresRateLimiter implements GameRateLimiterPort {
  private lastCleanupAt = 0;

  constructor(
    private readonly transactions: PrismTransactionRunner,
    private readonly config: ConfigService,
    @Optional() @Inject(GAME_ACTION_CLOCK) private readonly now: () => Date = () => new Date(),
  ) {}

  async consume(input: GameRateLimitRequest): Promise<{ allowed: boolean; retryAfterSeconds?: number }> {
    const now = this.now();
    if (!Number.isFinite(now.getTime())) {
      throw new ServiceUnavailableException('Event game rate limiting is unavailable');
    }
    const bucketStartedAt = new Date(Math.floor(now.getTime() / WINDOW_MS) * WINDOW_MS);
    const expiresAt = new Date(bucketStartedAt.getTime() + RETENTION_MS);
    const buckets = this.bucketsFor(input);
    const failurePreflight = input.action === 'pin_failure_check';

    try {
      return await this.transactions.run(async ({ prisma }) => {
        await this.cleanupExpiredBuckets(prisma, now);
        for (const bucket of buckets) {
          if (failurePreflight) {
            const rows = await prisma.$queryRaw<RateLimitCounterRow[]>`
              SELECT "request_count"
              FROM "event_games"."rate_limit_buckets"
              WHERE "bucket_key" = ${bucket.key} AND "bucket_started_at" = ${bucketStartedAt}
              LIMIT 1
            `;
            if ((rows[0]?.request_count ?? 0) >= bucket.maxRequests) {
              return {
                allowed: false,
                retryAfterSeconds: Math.max(1, Math.ceil((bucketStartedAt.getTime() + WINDOW_MS - now.getTime()) / 1000)),
              };
            }
            continue;
          }
          const rows = await prisma.$queryRaw<RateLimitCounterRow[]>`
            INSERT INTO "event_games"."rate_limit_buckets" AS current_bucket
              ("bucket_key", "bucket_started_at", "request_count", "expires_at")
            VALUES (${bucket.key}, ${bucketStartedAt}, 1, ${expiresAt})
            ON CONFLICT ("bucket_key", "bucket_started_at")
            DO UPDATE SET "request_count" = LEAST(
              current_bucket."request_count" + 1,
              EXCLUDED."request_count" + ${bucket.maxRequests}
            ), "expires_at" = EXCLUDED."expires_at"
            RETURNING "request_count"
          `;
          if (!rows[0] || rows[0].request_count > bucket.maxRequests) {
            return {
              allowed: false,
              retryAfterSeconds: Math.max(1, Math.ceil((bucketStartedAt.getTime() + WINDOW_MS - now.getTime()) / 1000)),
            };
          }
        }

        return { allowed: true };
      }, { actorId: 'event-game-rate-limiter' });
    } catch {
      throw new ServiceUnavailableException('Event game rate limiting is unavailable');
    }
  }

  private bucketsFor(input: GameRateLimitRequest): RateLimitBucket[] {
    if (input.action === 'pin_attempt' || input.action === 'join') {
      return [
        // This is a coarse pre-lookup guard. Successful attendees often share a venue IP and PIN,
        // so the tighter source and PIN-digest limits apply only after a failed lookup below.
        this.sourceBucket(input.action, 'pin-join-source', input.sourceFingerprint, this.limit('EVENT_GAME_PIN_ATTEMPTS_PER_SOURCE_PER_MINUTE', 1_000), input.eventId),
        this.globalBucket(input.action, 'pin-join-global', input.globalBudgetKey, this.limit('EVENT_GAME_PIN_ATTEMPTS_GLOBAL_PER_MINUTE', 10_000)),
      ];
    }
    if (input.action === 'failed_pin_attempt' || input.action === 'pin_failure_check') {
      return [
        {
          key: this.bucketKey('pin-failure-digest', input.submittedPinDigest),
          maxRequests: this.limit('EVENT_GAME_PIN_FAILURES_PER_DIGEST_PER_MINUTE', 20),
        },
        this.sourceBucket(input.action, 'pin-failure-source', input.sourceFingerprint, this.limit('EVENT_GAME_PIN_FAILURES_PER_SOURCE_PER_MINUTE', 60), input.eventId),
        this.globalBucket(input.action, 'pin-failure-global', input.globalBudgetKey, this.limit('EVENT_GAME_PIN_FAILURES_GLOBAL_PER_MINUTE', 1_000)),
      ];
    }
    if (input.action === 'lobby_read') {
      return [
        this.sourceBucket(input.action, 'lobby-read-source', input.sourceFingerprint, this.limit('EVENT_GAME_LOBBY_READS_PER_SOURCE_PER_MINUTE', 10_000), this.optionalEventId(input)),
        this.globalBucket(input.action, 'lobby-read-global', input.globalBudgetKey, this.limit('EVENT_GAME_LOBBY_READS_GLOBAL_PER_MINUTE', 20_000)),
      ];
    }
    if (input.action === 'lobby_start') {
      return [
        this.sourceBucket(input.action, 'lobby-start-source', input.sourceFingerprint, this.limit('EVENT_GAME_LOBBY_STARTS_PER_SOURCE_PER_MINUTE', 5_000), this.optionalEventId(input)),
        this.globalBucket(input.action, 'lobby-start-global', input.globalBudgetKey, this.limit('EVENT_GAME_LOBBY_STARTS_GLOBAL_PER_MINUTE', 5_000)),
      ];
    }
    if (!('participantTokenId' in input)) throw new Error('Unsupported event-game rate-limit action');
    return [{
      key: this.bucketKey('participant-action', input.eventId, input.action, input.participantTokenId),
      maxRequests: this.limit('EVENT_GAME_SUBMISSIONS_PER_PARTICIPANT_PER_MINUTE', 120),
    }];
  }

  private globalBucket(action: GameRateLimitRequest['action'], purpose: string, globalBudgetKey: string, maxRequests: number): RateLimitBucket {
    const bucketAction = action === 'pin_failure_check' ? 'failed_pin_attempt' : action;
    return { key: this.bucketKey('global', purpose, bucketAction, globalBudgetKey), maxRequests };
  }

  private sourceBucket(
    action: GameRateLimitRequest['action'],
    purpose: string,
    sourceFingerprint: string,
    maxRequests: number,
    eventId?: string,
  ): RateLimitBucket {
    const bucketAction = action === 'pin_failure_check' ? 'failed_pin_attempt' : action;
    return {
      key: this.bucketKey('source', purpose, bucketAction, eventId ?? 'global', sourceFingerprint),
      maxRequests,
    };
  }

  private optionalEventId(input: GameRateLimitRequest): string | undefined {
    return 'eventId' in input ? input.eventId : undefined;
  }

  private bucketKey(...components: string[]): string {
    return createHash('sha256').update(['prism', 'event-games', 'rate-limit', 'v1', ...components].join('\0')).digest('hex');
  }

  private limit(name: string, fallback: number): number {
    const value = this.config.get<string>(name);
    if (!value || !/^\d+$/.test(value)) return fallback;
    const parsed = Number(value);
    return Number.isSafeInteger(parsed) && parsed >= 1 && parsed <= 1_000_000 ? parsed : fallback;
  }

  private async cleanupExpiredBuckets(prisma: PrismTransactionContext['prisma'], now: Date) {
    if (now.getTime() - this.lastCleanupAt < CLEANUP_INTERVAL_MS) return;
    this.lastCleanupAt = now.getTime();
    const expiresBefore = now;
    await prisma.$executeRaw`
      WITH expired AS (
        SELECT "bucket_key", "bucket_started_at"
        FROM "event_games"."rate_limit_buckets"
        WHERE "expires_at" < ${expiresBefore}
        ORDER BY "expires_at"
        LIMIT ${CLEANUP_BATCH_SIZE}
        FOR UPDATE SKIP LOCKED
      )
      DELETE FROM "event_games"."rate_limit_buckets" AS bucket
      USING expired
      WHERE bucket."bucket_key" = expired."bucket_key"
        AND bucket."bucket_started_at" = expired."bucket_started_at"
    `;
  }
}
