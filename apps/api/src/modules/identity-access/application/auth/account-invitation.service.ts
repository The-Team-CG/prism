import { ConflictException, Inject, Injectable, Logger, ForbiddenException, NotFoundException } from '@nestjs/common';
import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { PrismaService } from '@prism/kernel/database';
import { AccountApprovalStatus, AuditActionType, AuditCategory, OpsUserRole } from '@prism/kernel/event-core';
import { AUDIT_WRITER, type AuditWriter, writeAudit, type ResolvedEventOpsActor } from '@prism/kernel/access-control';
import { PRISM_PORTAL_URLS, type PrismPortalUrls } from '@prism/kernel/shared';
import type { CreateAccountInvitationInput, PrismAccountInvitationOutcome } from '@prism/types';
import { canonicalAccountEmail } from './account-email';
import { portalForAccountRole } from './password-reset.service';
import {
  ACCOUNT_INVITATION_DELIVERY,
  ACCOUNT_INVITATION_TTL_MS,
  type AccountInvitationActor,
  type AccountInvitationDeliveryPort,
  type AccountInvitationSource,
  type AccountProvisioningPort,
  type InvitableAccountRole,
  type ProvisionAccountInput,
} from '../../contracts/account-invitation.port';

const INVITABLE_ROLES: ReadonlySet<string> = new Set<InvitableAccountRole>(['client', 'supplier', 'pmcm-admin', 'coordinator']);

export function invitableAccountRole(role: string): InvitableAccountRole | null {
  return INVITABLE_ROLES.has(role) ? (role as InvitableAccountRole) : null;
}

function tokenHash(token: string) {
  return createHash('sha256').update(token, 'utf8').digest('hex');
}

type Decision =
  | { outcome: 'role_conflict' | 'existing_account' | 'account_not_active'; userId: string }
  | { outcome: 'issued'; userId: string; token: string; expiresAt: Date };

/**
 * Creates account logins and their single-use activation links. It exposes no HTTP surface: identity's
 * controller calls the staff invite and resend methods, and other contexts call `provision` through the
 * reference module. Only activation sets a password, so an invited account cannot sign in before it.
 */
@Injectable()
export class AccountInvitationService implements AccountProvisioningPort {
  private readonly logger = new Logger(AccountInvitationService.name);

  constructor(
    private readonly prisma: PrismaService,
    @Inject(AUDIT_WRITER) private readonly auditWriter: AuditWriter,
    @Inject(ACCOUNT_INVITATION_DELIVERY) private readonly delivery: AccountInvitationDeliveryPort,
    @Inject(PRISM_PORTAL_URLS) private readonly portalUrls: PrismPortalUrls,
  ) {}

  async provision(input: ProvisionAccountInput): Promise<PrismAccountInvitationOutcome> {
    const email = canonicalAccountEmail(input.email);
    const now = new Date();
    const decision = await this.decide(email, input, now);
    if (decision.outcome !== 'issued') {
      await this.audit(input, email, decision.userId, decision.outcome, decision.outcome === 'existing_account' ? 'info' : 'warning');
      return { outcome: decision.outcome };
    }

    try {
      await this.delivery.deliver({
        recipient: email,
        name: input.name,
        role: input.role,
        activationUrl: this.activationUrlFor(input.role, decision.token),
      });
    } catch {
      // The reason is not logged: provider detail can be sensitive, and the activation URL must never reach a log.
      this.logger.warn('Account invitation email was not delivered; the link stays open until it is resent or expires');
      await this.audit(input, email, decision.userId, 'delivery_failed', 'warning');
      return { outcome: 'delivery_failed' };
    }

    await this.audit(input, email, decision.userId, 'invited', 'info', decision.expiresAt);
    return { outcome: 'invited', sentAt: now.toISOString(), expiresAt: decision.expiresAt.toISOString() };
  }

  /** PMCM admins invite staff. Client and supplier logins come from the conforme and supplier approval flows. */
  async inviteStaff(input: CreateAccountInvitationInput, actor: ResolvedEventOpsActor): Promise<PrismAccountInvitationOutcome> {
    const verified = this.requirePmcmAdmin(actor);
    return this.provision({
      email: input.email,
      name: input.name,
      role: input.role,
      organization: input.organization,
      source: 'admin',
      sourceId: null,
      actor: verified,
    });
  }

  /** Re-sends the open invitation of an account that has not been activated. The previous link stops working. */
  async resendInvitation(userId: string, actor: ResolvedEventOpsActor): Promise<PrismAccountInvitationOutcome> {
    const verified = this.requirePmcmAdmin(actor);
    const user = await this.prisma.opsUser.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('Account not found');
    if (user.approvalStatus !== AccountApprovalStatus.Invited) {
      throw new ConflictException('Only accounts that have not been activated can receive a new invitation');
    }
    const role = invitableAccountRole(user.role);
    if (!role) throw new ConflictException('This account role cannot receive an invitation');
    const latest = await this.prisma.opsAccountInvitation.findFirst({ where: { userId }, orderBy: { createdAt: 'desc' } });
    if (!latest) throw new ConflictException('This account has no invitation to resend');

    return this.provision({
      email: user.email,
      name: user.name,
      role,
      organization: user.organization,
      source: latest.source as AccountInvitationSource,
      sourceId: latest.sourceId,
      actor: verified,
    });
  }

  private async decide(email: string, input: ProvisionAccountInput, now: Date): Promise<Decision> {
    return this.prisma.$transaction(async (tx) => {
      // QUERY_AUDIT_RAW_SQL: serialize provisioning per email so two concurrent triggers cannot create two accounts.
      await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext(${email}))`;
      const existing = await tx.opsUser.findUnique({ where: { email } });
      if (existing && existing.role !== input.role) return { outcome: 'role_conflict', userId: existing.id };
      // Only an approved account with a password already signs in. A pending or declined one is refused, not re-invited.
      if (existing && existing.approvalStatus !== AccountApprovalStatus.Invited) {
        const signsIn = existing.approvalStatus === AccountApprovalStatus.Approved && existing.password !== null;
        return { outcome: signsIn ? 'existing_account' : 'account_not_active', userId: existing.id };
      }

      const user = existing ?? await tx.opsUser.create({
        data: {
          id: `usr_${randomUUID()}`,
          name: input.name,
          email,
          password: null,
          role: input.role,
          organization: input.organization,
          approvalStatus: AccountApprovalStatus.Invited,
        },
      });
      if (existing) {
        await tx.opsAccountInvitation.updateMany({
          where: { userId: user.id, consumedAt: null, revokedAt: null },
          data: { revokedAt: now },
        });
      }

      const token = randomBytes(32).toString('base64url');
      const expiresAt = new Date(now.getTime() + ACCOUNT_INVITATION_TTL_MS);
      await tx.opsAccountInvitation.create({
        data: {
          id: `inv_${randomUUID()}`,
          userId: user.id,
          tokenHash: tokenHash(token),
          expiresAt,
          source: input.source,
          sourceId: input.sourceId,
          createdBy: input.actor.id,
          createdAt: now,
        },
      });
      return { outcome: 'issued', userId: user.id, token, expiresAt };
    });
  }

  private activationUrlFor(role: InvitableAccountRole, token: string) {
    const portal = portalForAccountRole(role);
    // Every invitable role has a portal sign-in; a null here means the role map and the invitable set have drifted.
    if (portal === null) throw new Error(`No portal sign-in is defined for invitable role ${role}`);
    const link = new URL(`${this.portalUrls[portal]}/activate`);
    link.searchParams.set('token', token);
    return link.toString();
  }

  private requirePmcmAdmin(actor: ResolvedEventOpsActor): AccountInvitationActor {
    const id = actor.id?.trim();
    const name = actor.name?.trim();
    if (actor.verified !== true || actor.role !== OpsUserRole.PmcmAdmin || !id || !name) {
      throw new ForbiddenException('A verified PMCM admin is required to manage account invitations');
    }
    return { id, name, role: actor.role };
  }

  private async audit(
    input: ProvisionAccountInput,
    email: string,
    userId: string,
    outcome: 'invited' | 'existing_account' | 'account_not_active' | 'role_conflict' | 'delivery_failed',
    severity: 'info' | 'warning',
    expiresAt?: Date,
  ) {
    const actions: Record<typeof outcome, string> = {
      invited: `Account invitation sent to ${email}`,
      existing_account: `Account invitation skipped for ${email}: the account already has a login`,
      account_not_active: `Account invitation refused for ${email}: the account is not approved for sign-in`,
      role_conflict: `Account invitation refused for ${email}: the email belongs to a different role`,
      delivery_failed: `Account invitation for ${email} was not delivered`,
    };
    await writeAudit(this.auditWriter, undefined, input.actor.name, actions[outcome], {
      actorRole: input.actor.role,
      actionType: outcome === 'invited' ? AuditActionType.Create : AuditActionType.General,
      category: AuditCategory.Access,
      affectedType: 'account',
      affectedId: userId,
      affectedLabel: email,
      severity,
      metadata: {
        outcome,
        role: input.role,
        source: input.source,
        sourceId: input.sourceId,
        actorId: input.actor.id,
        ...(expiresAt ? { expiresAt: expiresAt.toISOString() } : {}),
      },
    });
  }
}
