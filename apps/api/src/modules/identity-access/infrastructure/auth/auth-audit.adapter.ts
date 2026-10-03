import { Injectable } from '@nestjs/common';
import type { OpsUser } from '@prisma/client';
import { AuditService, SecurityOperationsService } from '@prism/contexts/platform-ops';
import type { AuditWriteInput } from '@prism/kernel/access-control';
import type { PrismTransactionContext } from '@prism/kernel/shared-kernel';
import type { AuthAuditPort } from '../../contracts/auth-audit.port';

/** Composition adapter keeps platform trust implementation out of identity application code. */
@Injectable()
export class AuthAuditAdapter implements AuthAuditPort {
  constructor(
    private readonly auditService: AuditService,
    private readonly securityOperationsService: SecurityOperationsService,
  ) {}

  write(input: AuditWriteInput, context?: PrismTransactionContext) {
    const { eventId, actor, action, ...options } = input;
    return this.auditService.audit(eventId, actor, action, options, context);
  }

  recordAuthenticationAudit(input: AuditWriteInput) {
    return this.securityOperationsService.recordAuthenticationAudit(input);
  }

  recordLoginHistory(user: OpsUser | null, email: string, status: string, failureReason?: string) {
    return this.securityOperationsService.recordLoginHistory(user, email, status, failureReason);
  }

  handleFailedLogin(user: OpsUser) {
    return this.securityOperationsService.handleFailedLogin(user);
  }

  handleForbiddenAccess(user: OpsUser, email: string, reason: string) {
    return this.securityOperationsService.handleForbiddenAccess(user, email, reason);
  }

  listLoginHistory(userId: string) {
    return this.securityOperationsService.listLoginHistory(userId);
  }
}
