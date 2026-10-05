import type { OpsUser } from '@prisma/client';

export const LOGIN_LOCKOUT_THRESHOLD = 5;
export const LOGIN_LOCKOUT_MINUTES = 10;
export const PERMANENT_LOCKOUT_THRESHOLD = 5;

export type LoginFailureState = {
  nextFailedCount: number;
  shouldLock: boolean;
  nextLockoutCount: number;
  permanentLockout: boolean;
  lockedUntil: Date | null;
};

export function nextLoginFailureState(user: OpsUser, now: Date): LoginFailureState {
  const nextFailedCount = user.failedLoginCount + 1;
  const shouldLock = nextFailedCount >= LOGIN_LOCKOUT_THRESHOLD;
  const nextLockoutCount = shouldLock ? user.lockoutCount + 1 : user.lockoutCount;
  const permanentLockout = nextLockoutCount >= PERMANENT_LOCKOUT_THRESHOLD;

  return {
    nextFailedCount,
    shouldLock,
    nextLockoutCount,
    permanentLockout,
    lockedUntil: shouldLock && !permanentLockout
      ? new Date(now.getTime() + LOGIN_LOCKOUT_MINUTES * 60_000)
      : user.lockedUntil,
  };
}

export function loginFailureUpdate(state: LoginFailureState) {
  return {
    failedLoginCount: state.shouldLock ? 0 : state.nextFailedCount,
    lockoutCount: state.nextLockoutCount,
    lockedUntil: state.lockedUntil,
    permanentLockout: state.permanentLockout,
  };
}
