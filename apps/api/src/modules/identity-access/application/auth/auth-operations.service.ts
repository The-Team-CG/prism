import { Inject, Injectable } from '@nestjs/common';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { createHash, randomBytes } from 'node:crypto';
import { Prisma } from '@prisma/client';
import type { OpsApprovalRequest, OpsUser } from '@prisma/client';
import {
  PRISM_PRIVACY_NOTICE_VERSION,
  type PrismApprovalRequestReceipt,
  type PrismCurrentUser,
  type PrismIdentityAccountSummary,
  type PrismUser,
  type PrismVerifiedEventActor,
  type RequestApprovalInput,
} from '@prism/types';
import { PrismaService } from '@prism/kernel/database';
import type { PrismTransactionContext } from '@prism/kernel/shared-kernel';
import { AuditActionType, AuditCategory, OpsUserRole } from '@prism/kernel/event-core';
import { writeAudit, type ResolvedEventOpsActor } from '@prism/kernel/access-control';
import { AuthSessionService, type VerifiedTwoFactorToken } from '@prism/kernel/event-session';
import type { AuthenticationFailureDetails } from '@prism/contexts/platform-ops';
import { AuthSecurityService } from './auth-security.service';
import { TotpService } from './totp.service';
import { LOGIN_LOCKOUT_THRESHOLD, loginFailureUpdate, nextLoginFailureState } from './login-lockout.policy';
import { canonicalAccountEmail } from './account-email';
import { INQUIRY_COMMANDS } from '../../../event-lifecycle/contracts/inquiry-onboarding.tokens';
import type { InquiryCommands } from '../../../event-lifecycle/contracts/inquiry-commands.port';
import { AUTH_AUDIT, type AuthAuditPort } from '../../contracts/auth-audit.port';

const INVALID_CREDENTIALS = 'Invalid email or password';
const APPROVAL_REQUEST_RECEIVED_MESSAGE = 'If an account exists for this email, PMCM will review the request.';
// Fixed hash, never a real credential, verified against when the email is unknown.
const UNKNOWN_ACCOUNT_PASSWORD_HASH = 'scrypt$N=16384,r=8,p=5$30682f972917c5edd26dd7ffa09a889f$2c8426bd4d95f3db93469835fa24b81e8b7e90cfec405aee66d74dc8e6f97338c42462cb7ef67fab5417043759938bffeb348ea970c11ddc66219acb8d0afc03';

type VerifiedIdentityAdmin = ResolvedEventOpsActor & {
  id: string;
  verified: true;
  role: typeof OpsUserRole.PmcmAdmin | typeof OpsUserRole.System;
};

function timestamp(value: Date) {
  return value.toISOString();
}

function isPrismaSerializationFailure(error: unknown) {
  return typeof error === 'object' && error !== null && 'code' in error && error.code === 'P2034';
}

function hashTwoFactorChallenge(challengeId: string) {
  return createHash('sha256').update(challengeId, 'utf8').digest('hex');
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
    const normalizedEmail = canonicalAccountEmail(email);
    const user = await this.prisma.opsUser.findUnique({ where: { email: normalizedEmail } });

    if (!user) {
      // Same hashing work as a known account, so response time does not reveal which emails exist.
      await AuthSecurityService.verifyPassword(UNKNOWN_ACCOUNT_PASSWORD_HASH, password);
      await this.rejectUnknownLogin(normalizedEmail);
      throw new UnauthorizedException(INVALID_CREDENTIALS);
    }

    await this.assertLoginAllowed(user, normalizedEmail, password);
    const updated = await this.recordPasswordVerified(user, normalizedEmail, password);
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
    const locked = user.permanentLockout || Boolean(user.lockedUntil && user.lockedUntil > now);

    // The password is checked before any lock is disclosed. A locked account never gets
    // a counter increment from a wrong password, so an attacker cannot extend a lock.
    if (!(await AuthSecurityService.verifyPassword(user.password, password))) {
      if (!locked) await this.recordFailedLoginAttempt(user.id, 'Invalid password');
      throw new UnauthorizedException(INVALID_CREDENTIALS);
    }

    if (user.permanentLockout) {
      await this.authAudit.handleForbiddenAccess(user, normalizedEmail, 'Permanent lockout');
      throw new ForbiddenException('This account is permanently locked and requires PMCM Admin intervention');
    }

    if (user.lockedUntil && user.lockedUntil > now) {
      await this.authAudit.handleForbiddenAccess(user, normalizedEmail, 'Temporary lockout');
      throw new ForbiddenException('This account is temporarily locked after repeated failed login attempts');
    }

    if (user.approvalStatus !== 'approved') {
      await this.authAudit.handleForbiddenAccess(user, normalizedEmail, 'Account waiting for approval');
      throw new ForbiddenException('This account is waiting for admin approval');
    }
  }

  private async recordPasswordVerified(user: OpsUser, normalizedEmail: string, password: string) {
    // PMCM admins still need a second factor, so their lock counters reset only when a session is issued
    // (see verifyTwoFactor). Everyone else's counters reset here.
    const requiresTwoFactor = user.role === OpsUserRole.PmcmAdmin;
    const updated = await this.prisma.opsUser.update({
      where: { id: user.id },
      data: {
        ...(AuthSecurityService.needsRehash(user.password)
          ? { password: await AuthSecurityService.hashPassword(password) }
          : {}),
        ...(requiresTwoFactor
          ? {}
          : { failedLoginCount: 0, lockoutCount: 0, lockedUntil: null, lastLoginAt: new Date() }),
      },
    });

    if (!requiresTwoFactor) {
      await Promise.all([
        this.authAudit.recordLoginHistory(updated, normalizedEmail, 'success'),
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
    }

    return updated;
  }

  private async issueLoginSession(updated: OpsUser) {
    if (updated.role === OpsUserRole.Client) {
      await this.inquiryCommands.markPortalInvitationOpenedByEmail(updated.email);
    }

    if (updated.role === OpsUserRole.PmcmAdmin) {
      const challengeId = randomBytes(32).toString('base64url');
      const issuedAt = new Date();
      const expiresAt = this.authSessionService.twoFactorTokenExpiresAt(issuedAt);
      const purpose = updated.twoFactorSecret ? 'challenge' : 'setup';
      const token = this.authSessionService.issueTwoFactorToken(
        {
          userId: updated.id,
          email: updated.email,
          role: 'pmcm-admin',
          challengeId,
          sessionVersion: updated.sessionVersion,
        },
        purpose,
        issuedAt,
      );
      const saved = await this.prisma.opsUser.updateMany({
        where: {
          id: updated.id,
          email: updated.email,
          role: OpsUserRole.PmcmAdmin,
          approvalStatus: 'approved',
          sessionVersion: updated.sessionVersion,
          permanentLockout: false,
          OR: [{ lockedUntil: null }, { lockedUntil: { lte: issuedAt } }],
        },
        data: {
          twoFactorChallengeHash: hashTwoFactorChallenge(challengeId),
          twoFactorChallengeExpiresAt: expiresAt,
          twoFactorChallengeAttempts: 0,
          twoFactorChallengeConsumedAt: null,
        },
      });
      if (saved.count !== 1) throw new UnauthorizedException('Account access changed during sign-in; sign in again');
      return {
        kind: purpose === 'challenge' ? 'two_factor_required' as const : 'two_factor_setup_required' as const,
        token,
      };
    }

    return this.authSessionService.issueSession(this.mapUser(updated), new Date());
  }

  async setupTwoFactor(token: string) {
    const verifiedToken = this.authSessionService.verifyTwoFactorToken(token);
    if (verifiedToken.purpose !== 'setup') throw new ForbiddenException('Two-factor setup is not available for this token');
    const user = await this.findTwoFactorUser(verifiedToken);
    if (user.twoFactorSecret) throw new ForbiddenException('Two-factor setup has already started for this challenge');
    const secret = this.totpService.generateSecret();
    const saved = await this.prisma.opsUser.updateMany({
      where: {
        ...this.twoFactorChallengeWhere(verifiedToken, new Date()),
        twoFactorSecret: null,
      },
      data: { twoFactorSecret: this.totpService.encryptSecret(secret) },
    });
    if (saved.count !== 1) throw new UnauthorizedException('Two-factor setup challenge is no longer active');
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
      await this.recordFailedLoginAttempt(user.id, 'Invalid two-factor code', verifiedToken);
      throw new UnauthorizedException('Invalid two-factor code');
    }

    let updated: OpsUser | undefined;
    for (let attempt = 0; attempt < 3; attempt += 1) {
      try {
        updated = await this.prisma.$transaction(async (tx) => {
          const now = new Date();
          const current = this.assertTwoFactorUser(
            await tx.opsUser.findUnique({ where: { id: user.id } }),
            verifiedToken,
            now,
          );
          if (!current.twoFactorSecret || current.twoFactorSecret !== user.twoFactorSecret) {
            throw new UnauthorizedException('Two-factor challenge is no longer valid');
          }
          const consumed = await tx.opsUser.updateMany({
            where: {
              ...this.twoFactorChallengeWhere(verifiedToken, now),
              twoFactorSecret: current.twoFactorSecret,
            },
            data: {
              twoFactorChallengeConsumedAt: now,
              failedLoginCount: 0,
              lockoutCount: 0,
              lockedUntil: null,
              lastLoginAt: now,
            },
          });
          if (consumed.count !== 1) throw new UnauthorizedException('Two-factor challenge has already been used or expired');
          return tx.opsUser.findUniqueOrThrow({ where: { id: user.id } });
        }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
        break;
      } catch (error) {
        if (!isPrismaSerializationFailure(error)) throw error;
        if (attempt === 2) throw new ConflictException('Two-factor challenge changed concurrently; sign in again');
      }
    }
    if (!updated) throw new ConflictException('Two-factor challenge could not be completed; sign in again');
    await Promise.all([
      this.authAudit.recordLoginHistory(updated, user.email, 'success'),
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

  private async findTwoFactorUser(verifiedToken: VerifiedTwoFactorToken) {
    const user = await this.prisma.opsUser.findUnique({ where: { id: verifiedToken.userId } });
    return this.assertTwoFactorUser(user, verifiedToken, new Date());
  }

  private assertTwoFactorUser(user: OpsUser | null, verifiedToken: VerifiedTwoFactorToken, now: Date) {
    if (!user || !this.matchesTwoFactorIdentity(user, verifiedToken) || !this.isTwoFactorChallengeLive(user, verifiedToken, now)) {
      throw new UnauthorizedException('Invalid, expired, or already-used two-factor token');
    }
    if (
      user.approvalStatus !== 'approved' ||
      user.permanentLockout ||
      Boolean(user.lockedUntil && user.lockedUntil > now)
    ) {
      throw new ForbiddenException('This account is not eligible to complete two-factor authentication');
    }
    return user;
  }

  private matchesTwoFactorIdentity(user: OpsUser, verifiedToken: VerifiedTwoFactorToken): boolean {
    return canonicalAccountEmail(user.email) === canonicalAccountEmail(verifiedToken.email)
      && user.role === OpsUserRole.PmcmAdmin
      && user.sessionVersion === verifiedToken.sessionVersion;
  }

  private isTwoFactorChallengeLive(user: OpsUser, verifiedToken: VerifiedTwoFactorToken, now: Date): boolean {
    return user.twoFactorChallengeHash === hashTwoFactorChallenge(verifiedToken.challengeId)
      && Boolean(user.twoFactorChallengeExpiresAt)
      && user.twoFactorChallengeExpiresAt! > now
      && user.twoFactorChallengeConsumedAt === null
      && user.twoFactorChallengeAttempts < LOGIN_LOCKOUT_THRESHOLD;
  }

  private twoFactorChallengeWhere(verifiedToken: VerifiedTwoFactorToken, now: Date): Prisma.OpsUserWhereInput {
    return {
      id: verifiedToken.userId,
      email: verifiedToken.email,
      role: OpsUserRole.PmcmAdmin,
      approvalStatus: 'approved',
      sessionVersion: verifiedToken.sessionVersion,
      permanentLockout: false,
      OR: [{ lockedUntil: null }, { lockedUntil: { lte: now } }],
      twoFactorChallengeHash: hashTwoFactorChallenge(verifiedToken.challengeId),
      twoFactorChallengeExpiresAt: { gt: now },
      twoFactorChallengeAttempts: { lt: LOGIN_LOCKOUT_THRESHOLD },
      twoFactorChallengeConsumedAt: null,
    };
  }

  private async recordFailedLoginAttempt(userId: string, failureReason: string, verifiedToken?: VerifiedTwoFactorToken) {
    let result: { user: OpsUser; details: AuthenticationFailureDetails } | undefined;
    for (let attempt = 0; attempt < 3; attempt += 1) {
      try {
        result = await this.prisma.$transaction(async (tx) => {
          const now = new Date();
          const user = await tx.opsUser.findUnique({ where: { id: userId } });
          if (!user) throw new UnauthorizedException('Account is no longer available');
          if (verifiedToken) {
            this.assertTwoFactorUser(user, verifiedToken, now);
          } else if (user.permanentLockout || Boolean(user.lockedUntil && user.lockedUntil > now)) {
            throw new ForbiddenException('This account is currently locked');
          }

          const state = nextLoginFailureState(user, now);
          const updated = await tx.opsUser.update({
            where: { id: userId },
            data: {
              ...loginFailureUpdate(state),
              ...(verifiedToken ? { twoFactorChallengeAttempts: { increment: 1 } } : {}),
            },
          });
          return {
            user: updated,
            details: {
              failureReason,
              failedAttempt: state.nextFailedCount,
              lockoutCount: state.nextLockoutCount,
              lockoutTriggered: state.shouldLock,
              permanentLockout: state.permanentLockout,
            },
          };
        }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
        break;
      } catch (error) {
        if (!isPrismaSerializationFailure(error)) throw error;
        if (attempt === 2) throw new ConflictException('Authentication failure was recorded concurrently; retry sign-in');
      }
    }
    if (!result) throw new ConflictException('Authentication failure could not be recorded; retry sign-in');
    await this.authAudit.handleFailedLogin(result.user, result.details);
    return result.user;
  }

  async requestApproval(input: string | RequestApprovalInput): Promise<PrismApprovalRequestReceipt> {
    if (typeof input === 'string' || input.privacyConsentAccepted !== true) {
      throw new BadRequestException('Privacy consent is required before requesting account approval');
    }
    const approvalInput = input;
    const normalizedEmail = canonicalAccountEmail(approvalInput.email);
    const user = await this.prisma.opsUser.findUnique({ where: { email: normalizedEmail } });

    // An existing request (pending, approved or declined) is never rewritten by a new request.
    // A declined request therefore stays declined until a PMCM admin acts on it.
    if (user) {
      await this.prisma.opsApprovalRequest.upsert({
        where: { id: `approval_${user.id}` },
        create: {
          id: `approval_${user.id}`,
          userId: user.id,
          name: user.name,
          email: canonicalAccountEmail(user.email),
          role: user.role as PrismUser['role'],
          organization: user.organization,
          status: 'pending',
          privacyConsentAccepted: approvalInput.privacyConsentAccepted,
          privacyNoticeVersion: approvalInput.privacyNoticeVersion ?? PRISM_PRIVACY_NOTICE_VERSION,
          marketingConsentAccepted: Boolean(approvalInput.marketingConsentAccepted),
        },
        update: {},
      });
    }

    await this.authAudit.write({
      actor: user?.name ?? 'Unknown user',
      action: `Account approval requested for ${normalizedEmail}`,
      actorRole: user?.role ?? OpsUserRole.Unknown,
      actorEmail: normalizedEmail,
      actionType: AuditActionType.General,
      category: AuditCategory.Access,
      affectedType: 'account',
      affectedId: user?.id,
      affectedLabel: normalizedEmail,
      metadata: { accountFound: Boolean(user) },
    });

    return { message: APPROVAL_REQUEST_RECEIVED_MESSAGE };
  }

  async logout(actor: PrismVerifiedEventActor) {
    await this.prisma.$transaction(async (tx) => {
      const revoked = await tx.opsUser.updateMany({
        where: { id: actor.id, sessionVersion: actor.sessionVersion },
        data: { sessionVersion: { increment: 1 } },
      });
      if (revoked.count !== 1) throw new UnauthorizedException('Session has already been revoked');
      await writeAudit(
        this.authAudit,
        undefined,
        actor.name,
        'Signed out and revoked open sessions',
        {
          actorRole: actor.role,
          actorEmail: actor.email,
          actionType: AuditActionType.General,
          category: AuditCategory.Access,
          affectedType: 'account',
          affectedId: actor.id,
          affectedLabel: actor.email,
        },
        { prisma: tx, correlationId: actor.id, actorId: actor.id },
      );
    });
  }

  async currentUser(actor: PrismVerifiedEventActor): Promise<PrismCurrentUser> {
    const user = await this.prisma.opsUser.findUnique({ where: { id: actor.id } });
    if (!user) throw new UnauthorizedException('Session has been revoked or account access is no longer eligible');
    return this.mapCurrentUser(user, actor.expiresAt);
  }

  async unlockUser(userId: string, actor: ResolvedEventOpsActor): Promise<PrismIdentityAccountSummary> {
    const admin = this.requireVerifiedIdentityAdmin(actor);
    return this.prisma.$transaction(async (tx) => {
      const user = await tx.opsUser.findUnique({ where: { id: userId } });
      if (!user) throw new NotFoundException('Account not found');
      const saved = await tx.opsUser.update({
        where: { id: user.id },
        data: { lockedUntil: null, failedLoginCount: 0, lockoutCount: 0, permanentLockout: false },
      });
      await this.writeIdentityAdminAudit(tx, admin, saved, 'Unlocked account', { previousLockedUntil: user.lockedUntil?.toISOString() ?? null, previousPermanentLockout: user.permanentLockout });
      return this.mapAccountSummary(saved);
    });
  }

  async resetUserTwoFactor(userId: string, actor: ResolvedEventOpsActor): Promise<PrismIdentityAccountSummary> {
    const admin = this.requireVerifiedIdentityAdmin(actor);
    return this.prisma.$transaction(async (tx) => {
      const user = await tx.opsUser.findUnique({ where: { id: userId } });
      if (!user) throw new NotFoundException('Account not found');
      if (user.role !== OpsUserRole.PmcmAdmin) throw new BadRequestException('Two-factor reset applies only to PMCM admin accounts');
      // Bumping sessionVersion revokes every open session; the next sign-in starts two-factor setup again.
      const saved = await tx.opsUser.update({
        where: { id: user.id },
        data: {
          twoFactorSecret: null,
          twoFactorChallengeHash: null,
          twoFactorChallengeExpiresAt: null,
          twoFactorChallengeAttempts: 0,
          twoFactorChallengeConsumedAt: null,
          sessionVersion: { increment: 1 },
        },
      });
      await this.writeIdentityAdminAudit(tx, admin, saved, 'Reset two-factor enrolment and revoked open sessions', { previousSessionVersion: user.sessionVersion });
      return this.mapAccountSummary(saved);
    });
  }

  private writeIdentityAdminAudit(
    tx: PrismTransactionContext['prisma'],
    admin: VerifiedIdentityAdmin,
    target: OpsUser,
    action: string,
    metadata: Record<string, unknown>,
  ) {
    return writeAudit(
      this.authAudit,
      undefined,
      admin.name,
      `${action} for ${target.email}`,
      {
        actorRole: admin.role,
        actorEmail: admin.email,
        actionType: AuditActionType.Update,
        category: AuditCategory.Access,
        affectedType: 'account',
        affectedId: target.id,
        affectedLabel: target.email,
        metadata: { actorId: admin.id, ...metadata },
      },
      { prisma: tx, correlationId: target.id, actorId: admin.id },
    );
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
    for (let attempt = 0; attempt < 3; attempt += 1) {
      try {
        return await this.prisma.$transaction(async (tx) => {
          const request = await tx.opsApprovalRequest.findUnique({ where: { id: requestId } });
          if (!request) throw new NotFoundException('Approval request not found');

          const user = await tx.opsUser.findUnique({ where: { id: request.userId } });
          if (!user) throw new NotFoundException('Approval request account not found');

          const authorityChanged = user.approvalStatus !== status;
          if (!authorityChanged && request.status === status) return this.mapApprovalRequest(request);

          const savedUser = authorityChanged
            ? await tx.opsUser.update({
                where: { id: user.id },
                data: {
                  approvalStatus: status,
                  sessionVersion: { increment: 1 },
                  twoFactorChallengeHash: null,
                  twoFactorChallengeExpiresAt: null,
                  twoFactorChallengeAttempts: 0,
                  twoFactorChallengeConsumedAt: null,
                },
              })
            : user;
          const saved = request.status === status
            ? request
            : await tx.opsApprovalRequest.update({ where: { id: requestId }, data: { status } });

          await writeAudit(
            this.authAudit,
            undefined,
            actor.name,
            `${status === 'approved' ? 'Approved' : 'Declined'} account access for ${request.email}`,
            {
              actorRole: actor.role,
              actorEmail: actor.email,
              actionType: status === 'approved' ? AuditActionType.Approve : AuditActionType.Decline,
              category: AuditCategory.Access,
              affectedType: 'approval_request',
              affectedId: request.id,
              affectedLabel: request.email,
              metadata: {
                actorId: actor.id,
                previousApprovalStatus: user.approvalStatus,
                approvalStatus: status,
                sessionVersion: savedUser.sessionVersion,
                sessionVersionIncremented: authorityChanged,
              },
            },
            { prisma: tx, correlationId: request.id, actorId: actor.id },
          );

          return this.mapApprovalRequest(saved);
        }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
      } catch (error) {
        if (!isPrismaSerializationFailure(error)) throw error;
        if (attempt === 2) {
          throw new ConflictException('Account approval changed concurrently; reload before retrying');
        }
      }
    }

    throw new ConflictException('Account approval could not be completed; reload before retrying');
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

  private mapCurrentUser(user: OpsUser, expiresAt: string): PrismCurrentUser {
    return {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role as PrismUser['role'],
      organization: user.organization,
      twoFactorEnabled: Boolean(user.twoFactorSecret),
      expiresAt,
    };
  }

  private mapAccountSummary(user: OpsUser): PrismIdentityAccountSummary {
    return {
      id: user.id,
      email: user.email,
      role: user.role as PrismUser['role'],
      approvalStatus: user.approvalStatus,
      lockedUntil: user.lockedUntil ? timestamp(user.lockedUntil) : null,
      permanentLockout: user.permanentLockout,
      failedLoginCount: user.failedLoginCount,
      lockoutCount: user.lockoutCount,
      twoFactorEnabled: Boolean(user.twoFactorSecret),
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
