export type GuestAccessDecision = { allowed: true } | { allowed: false; retryAfterSeconds: number };

type Window = { count: number; resetAt: number };

const MAX_TRACKED_KEYS = 5000;

/**
 * Fixed-window attempt counter for the unauthenticated guest endpoints. It is per API instance and bounded in
 * memory: when too many keys are tracked it drops expired windows first and then the oldest ones. A key that stays
 * under its limit is never affected, so ordinary check-in and feedback traffic is not slowed down.
 */
export class GuestAccessLimiter {
  private readonly windows = new Map<string, Window>();

  consume(key: string, max: number, windowMs: number, now: number = Date.now()): GuestAccessDecision {
    const current = this.windows.get(key);
    if (!current || current.resetAt <= now) {
      this.remember(key, { count: 1, resetAt: now + windowMs }, now);
      return { allowed: true };
    }
    if (current.count >= max) {
      return { allowed: false, retryAfterSeconds: Math.max(1, Math.ceil((current.resetAt - now) / 1000)) };
    }
    current.count += 1;
    return { allowed: true };
  }

  private remember(key: string, window: Window, now: number) {
    if (this.windows.size >= MAX_TRACKED_KEYS) {
      for (const [existing, value] of this.windows) {
        if (value.resetAt <= now) this.windows.delete(existing);
      }
      while (this.windows.size >= MAX_TRACKED_KEYS) {
        const oldest = this.windows.keys().next().value;
        if (oldest === undefined) break;
        this.windows.delete(oldest);
      }
    }
    this.windows.set(key, window);
  }
}
