import { Inject, Injectable } from '@nestjs/common';
import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import type { OpsApprovalRequest, OpsUser } from '@prisma/client';
import { PRISM_PRIVACY_NOTICE_VERSION, type PrismUser, type RequestApprovalInput } from '@prism/types';
import { PrismaService } from '@prism/kernel/database';
import { AuditActionType, AuditCategory, OpsUserRole } from '@prism/kernel/event-core';
import { writeAudit, type ResolvedEventOpsActor } from '@prism/kernel/access-control';
import { AuthSessionService } from '@prism/kernel/event-session';
import { AuthSecurityService } from './auth-security.service';
import { TotpService } from './totp.service';
import { INQUIRY_COMMANDS } from '../../../event-lifecycle/contracts/inquiry-onboarding.tokens';
import type { InquiryCommands } from '../../../event-lifecycle/contracts/inquiry-commands.port';
import { AUTH_AUDIT, type AuthActorEvidence, type AuthAuditPort, type FailedLoginEvidence } from '../../contracts/auth-audit.port';

const LOGIN_LOCKOUT_THRESHOLD = 5;
const LOGIN_LOCKOUT_MINUTES = 10;
const PERMANENT_LOCKOUT_THRESHOLD = 5;

type LockedIdentityRow = {
  id: string;
  name: string;
  email: string;
  role: string;
  failedLoginCount: number;
  lockoutCount: number;
  lockedUntil: Date | null;
  permanentLockout: boolean;
};

function addMinutes(value: Date, minutes: number) {
  const next = new Date(value);
  next.setMinutes(next.getMinutes() + minutes);
  return next;
}

function actorEvidence(user: Pick<OpsUser, 'id' | 'name' | 'email' | 'role'>): AuthActorEvidence {
  return { id: user.id, name: user.name, email: user.email, role: user.role };
}

type VerifiedIdentityAdmin = ResolvedEventOpsActor & {
  id: string;
  verified: true;
  role: typeof OpsUserRole.PmcmAdmin | typeof OpsUserRole.System;
};

function timestamp(value: Date) {
  return value.toISOString();
}

@Injectable()
export class AuthOperationsService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(AUTH_AUDIT) private readonly authAudit: AuthAuditPort,
    @Inject(INQUIRY_COMMANDS) private readonly inquiryCommands: InquiryCommands,
    private readonly authSessionService: AuthSessionService,
    private readonly totpService: TotpService,
  ) {}

  async login(email: string, password: string) {
    const normalizedEmail = email.trim().toLowerCase();
    const user = await this.prisma.opsUser.findUnique({ where: { email: normalizedEmail } });

    if (!user) {
      await this.rejectUnknownLogin(normalizedEmail);
      throw new UnauthorizedException('Invalid email or password');
    }

    await this.assertLoginAllowed(user, normalizedEmail, password);
    const updated = await this.recordSuccessfulLogin(user, normalizedEmail, password);
    return this.issueLoginSession(updated);
  }

  private async rejectUnknownLogin(normalizedEmail: string) {
    await this.authAudit.recordLoginHistory(null, normalizedEmail, 'failed', 'Unknown email');
    await this.authAudit.recordAuthenticationAudit({
      actor: 'Unknown user',
      action: `Failed login attempt for ${normalizedEmail}`,
      actorRole: OpsUserRole.Unknown,
      actorEmail: normalizedEmail,
      actionType: AuditActionType.LoginFailed,
      category: AuditCategory.Access,
      affectedType: 'account',
      affectedLabel: normalizedEmail,
      severity: 'warning',
    });
  }

  private async assertLoginAllowed(user: OpsUser, normalizedEmail: string, password: string) {
    const now = new Date();
    if (user.permanentLockout) {
      await this.authAudit.handleForbiddenAccess(actorEvidence(user), normalizedEmail, 'Permanent lockout');
      throw new ForbiddenException('This account is permanently locked and requires PMCM Admin intervention');
    }

    if (user.lockedUntil && user.lockedUntil > now) {
      await this.authAudit.handleForbiddenAccess(actorEvidence(user), normalizedEmail, 'Temporary lockout');
      throw new ForbiddenException('This account is temporarily locked after repeated failed login attempts');
    }

    if (!AuthSecurityService.verifyPassword(user.password, password)) {
      await this.recordFailedLogin(user);
    }

    if (user.approvalStatus !== 'approved') {
      await this.authAudit.handleForbiddenAccess(actorEvidence(user), normalizedEmail, 'Account waiting for approval');
      throw new ForbiddenException('This account is waiting for admin approval');
    }
  }

  private async recordSuccessfulLogin(user: OpsUser, normalizedEmail: string, password: string) {
    const updated = await this.prisma.opsUser.update({
      where: { id: user.id },
      data: {
        ...(!AuthSecurityService.isHashedPassword(user.password)
          ? { password: AuthSecurityService.hashPassword(password) }
          : {}),
        failedLoginCount: 0,
        lockedUntil: null,
        lastLoginAt: new Date(),
      },
    });

    await Promise.all([
      this.authAudit.recordLoginHistory(actorEvidence(updated), normalizedEmail, 'success'),
      this.authAudit.recordAuthenticationAudit({
        actor: updated.name,
        action: `Signed in to ${updated.role} portal`,
        actorRole: updated.role,
        actorEmail: updated.email,
        actionType: AuditActionType.Login,
        category: AuditCategory.Access,
        affectedType: 'account',
        affectedId: updated.id,
        affectedLabel: updated.email,
      }),
    ]);

    return updated;
  }

  private async recordFailedLogin(user: OpsUser, failureMessage = 'Invalid email or password'): Promise<never> {
    const now = new Date();
    const decision = await this.prisma.$transaction(async (tx) => {
      // QUERY_AUDIT_RAW_SQL: serialize failed-login threshold changes on the Identity-owned user row.
      const [current] = await tx.$queryRaw<LockedIdentityRow[]>`
        SELECT id, name, email, role,
               failed_login_count AS "failedLoginCount",
               lockout_count AS "lockoutCount",
               locked_until AS "lockedUntil",
               permanent_lockout AS "permanentLockout"
        FROM identity.users
        WHERE id = ${user.id}
        FOR UPDATE
      `;
      if (!current) return null;

      const actor = actorEvidence(current);
      if (current.permanentLockout) return { kind: 'blocked' as const, actor, reason: 'Permanent lockout' };
      if (current.lockedUntil && current.lockedUntil > now) {
        return { kind: 'blocked' as const, actor, reason: 'Temporary lockout' };
      }

      const failedAttempt = current.failedLoginCount + 1;
      const locked = failedAttempt >= LOGIN_LOCKOUT_THRESHOLD;
      const lockoutCount = locked ? current.lockoutCount + 1 : current.lockoutCount;
      const permanentLockout = lockoutCount >= PERMANENT_LOCKOUT_THRESHOLD;
      await tx.opsUser.update({
        where: { id: current.id },
        data: {
          failedLoginCount: locked ? 0 : failedAttempt,
          lockoutCount,
          lockedUntil: locked && !permanentLockout ? addMinutes(now, LOGIN_LOCKOUT_MINUTES) : current.lockedUntil,
          permanentLockout,
        },
      });
      return {
        kind: 'failed' as const,
        evidence: { ...actor, failedAttempt, lockoutCount, locked, permanentLockout } satisfies FailedLoginEvidence,
      };
    });

    if (!decision) throw new UnauthorizedException(failureMessage);
    if (decision.kind === 'blocked') {
      await this.authAudit.handleForbiddenAccess(decision.actor, decision.actor.email, decision.reason);
      throw new ForbiddenException(decision.reason === 'Permanent lockout'
        ? 'This account is permanently locked and requires PMCM Admin intervention'
        : 'This account is temporarily locked after repeated failed login attempts');
    }
    await this.authAudit.handleFailedLogin(decision.evidence);
    throw new UnauthorizedException(failureMessage);
  }

  private async issueLoginSession(updated: OpsUser) {
    if (updated.role === OpsUserRole.Client) {
      await this.inquiryCommands.markPortalInvitationOpenedByEmail(updated.email);
    }

    if (updated.role === OpsUserRole.PmcmAdmin) {
      return {
        kind: updated.twoFactorSecret ? 'two_factor_required' : 'two_factor_setup_required',
        token: this.authSessionService.issueTwoFactorToken(
          { userId: updated.id, email: updated.email, role: 'pmcm-admin' },
          updated.twoFactorSecret ? 'challenge' : 'setup',
        ),
      };
    }

    return this.authSessionService.issueSession(this.mapUser(updated), new Date());
  }

  async setupTwoFactor(token: string) {
    const verifiedToken = this.authSessionService.verifyTwoFactorToken(token);
    if (verifiedToken.purpose !== 'setup') throw new ForbiddenException('Two-factor setup is not available for this token');
    const user = await this.findTwoFactorUser(verifiedToken);
    const secret = this.totpService.generateSecret();
    await this.prisma.opsUser.update({
      where: { id: user.id },
      data: { twoFactorSecret: this.totpService.encryptSecret(secret) },
    });
    return {
      kind: 'two_factor_setup' as const,
      token,
      secret,
      otpauthUri: this.totpService.otpauthUri(secret, user.email),
    };
  }

  async verifyTwoFactor(token: string, code: string) {
    const verifiedToken = this.authSessionService.verifyTwoFactorToken(token);
    const user = await this.findTwoFactorUser(verifiedToken);
    if (!user.twoFactorSecret) throw new ForbiddenException('Two-factor setup is required before sign-in');
    let secret: string;
    try {
      secret = this.totpService.decryptSecret(user.twoFactorSecret);
    } catch {
      throw new UnauthorizedException('Two-factor authentication is unavailable for this account');
    }
    if (!this.totpService.verifyCode(secret, code)) {
      await this.recordFailedLogin(user, 'Invalid two-factor code');
    }

    const updated = await this.prisma.opsUser.update({
      where: { id: user.id },
      data: { failedLoginCount: 0, lockedUntil: null, lastLoginAt: new Date() },
    });
    await Promise.all([
      this.authAudit.recordLoginHistory(actorEvidence(updated), user.email, 'success'),
      this.authAudit.recordAuthenticationAudit({
        actor: updated.name,
        action: `Signed in to ${updated.role} portal`,
        actorRole: updated.role,
        actorEmail: updated.email,
        actionType: AuditActionType.Login,
        category: AuditCategory.Access,
        affectedType: 'account',
        affectedId: updated.id,
        affectedLabel: updated.email,
      }),
    ]);
    return this.authSessionService.issueSession(this.mapUser(updated), new Date());
  }

  private async findTwoFactorUser(verifiedToken: { userId: string; email: string; role: 'pmcm-admin' }) {
    const user = await this.prisma.opsUser.findUnique({ where: { id: verifiedToken.userId } });
    if (!user || user.email !== verifiedToken.email || user.role !== OpsUserRole.PmcmAdmin) {
      throw new UnauthorizedException('Invalid two-factor token');
    }
    return user as OpsUser & { twoFactorSecret?: string | null };
  }

  async requestApproval(input: string | RequestApprovalInput) {
    if (typeof input === 'string' || input.privacyConsentAccepted !== true) {
      throw new BadRequestException('Privacy consent is required before requesting account approval');
    }
    const approvalInput = input;
    const user = await this.prisma.opsUser.findUnique({
      where: { email: approvalInput.email.trim().toLowerCase() },
    });

    if (!user) throw new NotFoundException('User not found');

    const request = await this.prisma.opsApprovalRequest.upsert({
      where: { id: `approval_${user.id}` },
      create: {
        id: `approval_${user.id}`,
        userId: user.id,
        name: user.name,
        email: user.email,
        role: user.role as PrismUser['role'],
        organization: user.organization,
        status: 'pending',
        privacyConsentAccepted: approvalInput.privacyConsentAccepted,
        privacyNoticeVersion: approvalInput.privacyNoticeVersion ?? PRISM_PRIVACY_NOTICE_VERSION,
        marketingConsentAccepted: Boolean(approvalInput.marketingConsentAccepted),
      },
      update: {
        status: 'pending',
        privacyConsentAccepted: approvalInput.privacyConsentAccepted,
        privacyNoticeVersion: approvalInput.privacyNoticeVersion ?? PRISM_PRIVACY_NOTICE_VERSION,
        marketingConsentAccepted: Boolean(approvalInput.marketingConsentAccepted),
        requestedAt: new Date(),
      },
    });

    return this.mapApprovalRequest(request);
  }

  async listApprovalRequests() {
    const requests = await this.prisma.opsApprovalRequest.findMany({
      take: 100,
      orderBy: [{ status: 'asc' }, { requestedAt: 'desc' }],
    });

    return requests.map((request: OpsApprovalRequest) => this.mapApprovalRequest(request));
  }

  async listLoginHistory(userId: string) {
    return this.authAudit.listLoginHistory(userId);
  }

  async approveApprovalRequest(requestId: string, actor: ResolvedEventOpsActor) {
    return this.updateApprovalRequest(requestId, 'approved', this.requireVerifiedIdentityAdmin(actor));
  }

  async declineApprovalRequest(requestId: string, actor: ResolvedEventOpsActor) {
    return this.updateApprovalRequest(requestId, 'declined', this.requireVerifiedIdentityAdmin(actor));
  }

  private async updateApprovalRequest(requestId: string, status: 'approved' | 'declined', actor: VerifiedIdentityAdmin) {
    const request = await this.prisma.opsApprovalRequest.findUnique({ where: { id: requestId } });
    if (!request) throw new NotFoundException('Approval request not found');

    await this.prisma.opsUser.update({
      where: { id: request.userId },
      data: { approvalStatus: status },
    });

    const saved = await this.prisma.opsApprovalRequest.update({
      where: { id: requestId },
      data: { status },
    });

    await writeAudit(this.authAudit, undefined, actor.name, `${status === 'approved' ? 'Approved' : 'Declined'} account access for ${request.email}`, {
      actorRole: actor.role,
      actorEmail: actor.email,
      actionType: status === 'approved' ? AuditActionType.Approve : AuditActionType.Decline,
      category: AuditCategory.Access,
      affectedType: 'approval_request',
      affectedId: request.id,
      affectedLabel: request.email,
      metadata: { actorId: actor.id },
    });

    return this.mapApprovalRequest(saved);
  }

  private requireVerifiedIdentityAdmin(actor: ResolvedEventOpsActor | undefined): VerifiedIdentityAdmin {
    const id = actor?.id?.trim();
    const name = actor?.name?.trim();
    const role = actor?.role;
    if (
      !actor ||
      actor.verified !== true ||
      !id ||
      !name ||
      (role !== OpsUserRole.PmcmAdmin && role !== OpsUserRole.System)
    ) {
      throw new ForbiddenException('A verified identity administrator is required to update approval requests');
    }
    return { ...actor, id, name, role, verified: true };
  }

  private mapUser(user: OpsUser): PrismUser {
    return {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role as PrismUser['role'],
      organization: user.organization,
      approvalStatus: user.approvalStatus,
      lastLoginAt: user.lastLoginAt ? timestamp(user.lastLoginAt) : null,
      lockedUntil: user.lockedUntil ? timestamp(user.lockedUntil) : null,
      permanentLockout: user.permanentLockout,
      sessionVersion: user.sessionVersion,
    };
  }

  private mapApprovalRequest(request: OpsApprovalRequest) {
    return {
      id: request.id,
      userId: request.userId,
      name: request.name,
      email: request.email,
      role: request.role,
      organization: request.organization,
      status: request.status,
      privacyConsentAccepted: (request as OpsApprovalRequest & { privacyConsentAccepted?: boolean }).privacyConsentAccepted ?? false,
      privacyNoticeVersion: (request as OpsApprovalRequest & { privacyNoticeVersion?: string }).privacyNoticeVersion ?? '',
      marketingConsentAccepted: (request as OpsApprovalRequest & { marketingConsentAccepted?: boolean }).marketingConsentAccepted ?? false,
      requestedAt: timestamp(request.requestedAt),
    };
  }
}
