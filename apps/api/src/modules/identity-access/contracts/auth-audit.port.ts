import type { OpsUser } from '@prisma/client';
import type { AuditWriteInput } from '@prism/kernel/access-control';
import type { PrismTransactionContext } from '@prism/kernel/shared-kernel';

export const AUTH_AUDIT = Symbol('AUTH_AUDIT');

/** Identity's focused trust seam for authentication telemetry and account lockout events. */
export interface AuthAuditPort {
  write(input: AuditWriteInput, context?: PrismTransactionContext): Promise<unknown>;
  /** Known audit-chain integrity conflicts are recorded as incidents without blocking authentication. */
  recordAuthenticationAudit(input: AuditWriteInput): Promise<unknown>;
  recordLoginHistory(user: OpsUser | null, email: string, status: string, failureReason?: string): Promise<unknown>;
  handleFailedLogin(user: OpsUser): Promise<unknown>;
  handleForbiddenAccess(user: OpsUser, email: string, reason: string): Promise<unknown>;
  listLoginHistory(userId: string): Promise<unknown[]>;
}
