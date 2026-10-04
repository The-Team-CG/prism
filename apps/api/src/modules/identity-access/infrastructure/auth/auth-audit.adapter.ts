import { Injectable } from '@nestjs/common';
import { AuditService, SecurityOperationsService } from '@prism/contexts/platform-ops';
import type { AuditWriteInput } from '@prism/kernel/access-control';
import type { AuthActorEvidence, AuthAuditPort, FailedLoginEvidence } from '../../contracts/auth-audit.port';

/** Composition adapter keeps platform trust implementation out of identity application code. */
@Injectable()
export class AuthAuditAdapter implements AuthAuditPort {
  constructor(
    private readonly auditService: AuditService,
    private readonly securityOperationsService: SecurityOperationsService,
  ) {}

  write(input: AuditWriteInput) {
    const { eventId, actor, action, ...options } = input;
    return this.auditService.audit(eventId, actor, action, options);
  }

  recordAuthenticationAudit(input: AuditWriteInput) {
    return this.securityOperationsService.recordAuthenticationAudit(input);
  }

  recordLoginHistory(user: AuthActorEvidence | null, email: string, status: string, failureReason?: string) {
    return this.securityOperationsService.recordLoginHistory(user, email, status, failureReason);
  }

  handleFailedLogin(input: FailedLoginEvidence) {
    return this.securityOperationsService.handleFailedLogin(input);
  }

  handleForbiddenAccess(user: AuthActorEvidence, email: string, reason: string) {
    return this.securityOperationsService.handleForbiddenAccess(user, email, reason);
  }

  listLoginHistory(userId: string) {
    return this.securityOperationsService.listLoginHistory(userId);
  }
}
