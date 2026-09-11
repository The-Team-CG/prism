import { Injectable } from '@nestjs/common';
import type { OpsUser } from '@prisma/client';
import { AuditService } from '@prism/contexts/platform-ops';
import type { AuditWriteInput } from '@prism/kernel/access-control';
import type { AuthAuditPort } from '../../contracts/auth-audit.port';

/** Composition adapter keeps platform trust implementation out of identity application code. */
@Injectable()
export class AuthAuditAdapter implements AuthAuditPort {
  constructor(private readonly auditService: AuditService) {}

  write(input: AuditWriteInput) {
    const { eventId, actor, action, ...options } = input;
    return this.auditService.audit(eventId, actor, action, options);
  }

  recordAuthenticationAudit(input: AuditWriteInput) {
    return this.auditService.recordAuthenticationAudit(input);
  }

  recordLoginHistory(user: OpsUser | null, email: string, status: string, failureReason?: string) {
    return this.auditService.recordLoginHistory(user, email, status, failureReason);
  }

  handleFailedLogin(user: OpsUser) {
    return this.auditService.handleFailedLogin(user);
  }

  handleForbiddenAccess(user: OpsUser, email: string, reason: string) {
    return this.auditService.handleForbiddenAccess(user, email, reason);
  }

  listLoginHistory(userId: string) {
    return this.auditService.listLoginHistory(userId);
  }
}
