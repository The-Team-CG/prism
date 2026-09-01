import type { OpsUser } from '@prisma/client';
import type { AuditWriteInput } from '@prism/kernel/access-control';

export const AUTH_AUDIT = Symbol('AUTH_AUDIT');

/** Identity's focused trust seam for login history and account lockout events. */
export interface AuthAuditPort {
  write(input: AuditWriteInput): Promise<unknown>;
  recordLoginHistory(user: OpsUser | null, email: string, status: string, failureReason?: string): Promise<unknown>;
  handleFailedLogin(user: OpsUser): Promise<unknown>;
  handleForbiddenAccess(user: OpsUser, email: string, reason: string): Promise<unknown>;
  listLoginHistory(userId: string): Promise<unknown[]>;
}
