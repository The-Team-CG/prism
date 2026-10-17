export const GAME_RATE_LIMITER = Symbol('GAME_RATE_LIMITER');

export type GameRateLimitAction = 'lobby_read' | 'pin_attempt' | 'pin_failure_check' | 'failed_pin_attempt' | 'lobby_start' | 'join' | 'submit_answer' | 'submit_vote';

export type GameRateLimitRequest =
  | {
      /** Coarse lobby budget keyed by a server-derived request-source digest. */
      action: 'lobby_read';
      sourceFingerprint: string;
      globalBudgetKey: string;
    }
  | {
      /** Apply a second bucket after opaque slug resolution, scoped to its event. */
      eventId: string;
      action: 'lobby_read';
      sourceFingerprint: string;
      globalBudgetKey: string;
    }
  | {
      eventId?: string;
      action: 'pin_attempt' | 'join';
      /** One-way source digest; never a raw IP address or forwarded header. */
      sourceFingerprint: string;
      globalBudgetKey: string;
    }
  | {
      eventId?: string;
      action: 'failed_pin_attempt';
      /** One-way source digest; never a raw IP address or forwarded header. */
      sourceFingerprint: string;
      /** Digest of the submitted PIN; never the PIN itself. */
      submittedPinDigest: string;
      globalBudgetKey: string;
    }
  | {
      eventId?: string;
      /** Read the failure buckets before a PIN lookup without incrementing them. */
      action: 'pin_failure_check';
      sourceFingerprint: string;
      submittedPinDigest: string;
      globalBudgetKey: string;
    }
  | {
      /** Coarse start budget applied before resolving a public lobby slug. */
      action: 'lobby_start';
      sourceFingerprint: string;
      globalBudgetKey: string;
    }
  | {
      eventId: string;
      action: 'lobby_start';
      /** Event-scoped HMAC of the trusted request source; never caller supplied. */
      sourceFingerprint: string;
      globalBudgetKey: string;
    }
  | {
      eventId: string;
      action: 'submit_answer' | 'submit_vote';
      participantTokenId: string;
      sourceFingerprint?: string;
      globalBudgetKey?: string;
    };

export interface GameRateLimiterPort {
  consume(input: GameRateLimitRequest): Promise<{ allowed: boolean; retryAfterSeconds?: number }>;
}
