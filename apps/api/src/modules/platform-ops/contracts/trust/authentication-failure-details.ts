export type AuthenticationFailureDetails = {
  failureReason: string;
  failedAttempt: number;
  lockoutCount: number;
  lockoutTriggered: boolean;
  permanentLockout: boolean;
};
