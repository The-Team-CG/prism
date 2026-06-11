import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import type { OpsApprovalRequest, OpsUser } from '@prisma/client';
import type { PrismaService } from '@prism/database';
import { AuditActionType, AuditCategory, OpsUserRole } from '../ops.constants';
import { AuditService } from './audit.service';
import { AuthSecurityService } from './auth-security.service';
import { InquiriesService } from './inquiries.service';

type RequestApprovalInput = {
  email: string;
  privacyConsentAccepted?: boolean;
  privacyNoticeVersion?: string;
  marketingConsentAccepted?: boolean;
};

function timestamp(value: Date) {
  return value.toISOString();
}

export class AuthOperationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
    private readonly inquiriesService: InquiriesService,
  ) {}

  async login(email: string, password: string) {
    const normalizedEmail = email.trim().toLowerCase();
    const user = await this.prisma.opsUser.findUnique({ where: { email: normalizedEmail } });

    if (!user) {
      await this.auditService.recordLoginHistory(null, normalizedEmail, 'failed', 'Unknown email');
      await this.auditService.audit(undefined, 'Unknown user', `Failed login attempt for ${normalizedEmail}`, {
        actorRole: OpsUserRole.Unknown,
        actorEmail: normalizedEmail,
        actionType: AuditActionType.LoginFailed,
        category: AuditCategory.Access,
        affectedType: 'account',
        affectedLabel: normalizedEmail,
        severity: 'warning',
      });
      throw new UnauthorizedException('Invalid mock credentials');
    }

    const now = new Date();
    if (user.permanentLockout) {
      await this.auditService.handleForbiddenAccess(user, normalizedEmail, 'Permanent lockout');
      throw new ForbiddenException('This account is permanently locked and requires PMCM Admin intervention');
    }

    if (user.lockedUntil && user.lockedUntil > now) {
      await this.auditService.handleForbiddenAccess(user, normalizedEmail, 'Temporary lockout');
      throw new ForbiddenException('This account is temporarily locked after repeated failed login attempts');
    }

    const passwordMatches = AuthSecurityService.verifyPassword(user.password, password);
    if (!passwordMatches) {
      await this.auditService.handleFailedLogin(user);
      throw new UnauthorizedException('Invalid mock credentials');
    }

    if (user.approvalStatus !== 'approved') {
      await this.auditService.handleForbiddenAccess(user, normalizedEmail, 'Account waiting for approval');
      throw new ForbiddenException('This account is waiting for admin approval');
    }

    const updated = await this.prisma.opsUser.update({
      where: { id: user.id },
      data: {
        ...(!AuthSecurityService.isHashedPassword(user.password)
          ? { password: AuthSecurityService.hashPassword(password) }
          : {}),
        failedLoginCount: 0,
        lockedUntil: null,
        lastLoginAt: now,
      },
    });

    await Promise.all([
      this.auditService.recordLoginHistory(updated, normalizedEmail, 'success'),
      this.auditService.audit(undefined, updated.name, `Signed in to ${updated.role} portal`, {
        actorRole: updated.role,
        actorEmail: updated.email,
        actionType: AuditActionType.Login,
        category: AuditCategory.Access,
        affectedType: 'account',
        affectedId: updated.id,
        affectedLabel: updated.email,
      }),
    ]);

    if (updated.role === OpsUserRole.Client) {
      await this.inquiriesService.markPortalInvitationOpenedByEmail(updated.email);
    }

    return {
      ...this.mapUser(updated),
      signedInAt: new Date().toISOString(),
    };
  }

  async requestApproval(input: string | RequestApprovalInput) {
    const approvalInput = typeof input === 'string' ? { email: input } : input;
    if (!approvalInput.privacyConsentAccepted) {
      throw new BadRequestException('Privacy consent is required before requesting account approval');
    }
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
        role: user.role,
        organization: user.organization,
        status: 'pending',
        privacyConsentAccepted: true,
        privacyNoticeVersion: approvalInput.privacyNoticeVersion ?? '2026-05-01',
        marketingConsentAccepted: Boolean(approvalInput.marketingConsentAccepted),
      },
      update: {
        status: 'pending',
        privacyConsentAccepted: true,
        privacyNoticeVersion: approvalInput.privacyNoticeVersion ?? '2026-05-01',
        marketingConsentAccepted: Boolean(approvalInput.marketingConsentAccepted),
        requestedAt: new Date(),
      },
    });

    return this.mapApprovalRequest(request);
  }

  async listApprovalRequests() {
    const requests = await this.prisma.opsApprovalRequest.findMany({
      orderBy: [{ status: 'asc' }, { requestedAt: 'desc' }],
    });

    return requests.map((request: OpsApprovalRequest) => this.mapApprovalRequest(request));
  }

  async listLoginHistory(userId: string) {
    return this.auditService.listLoginHistory(userId);
  }

  async approveApprovalRequest(requestId: string) {
    return this.updateApprovalRequest(requestId, 'approved');
  }

  async declineApprovalRequest(requestId: string) {
    return this.updateApprovalRequest(requestId, 'declined');
  }

  private async updateApprovalRequest(requestId: string, status: 'approved' | 'declined') {
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

    await this.auditService.audit(undefined, 'PMCM Admin', `${status === 'approved' ? 'Approved' : 'Declined'} account access for ${request.email}`, {
      actorRole: OpsUserRole.PmcmAdmin,
      actionType: status === 'approved' ? AuditActionType.Approve : AuditActionType.Decline,
      category: AuditCategory.Access,
      affectedType: 'approval_request',
      affectedId: request.id,
      affectedLabel: request.email,
    });

    return this.mapApprovalRequest(saved);
  }

  private mapUser(user: OpsUser) {
    return {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      organization: user.organization,
      approvalStatus: user.approvalStatus,
      lastLoginAt: user.lastLoginAt ? timestamp(user.lastLoginAt) : null,
      lockedUntil: user.lockedUntil ? timestamp(user.lockedUntil) : null,
      permanentLockout: user.permanentLockout,
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
