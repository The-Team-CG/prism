import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '@prism/kernel/database';
import type { CreateSupplierApplicationInput, ReviewSupplierApplicationInput, SupplierApplicationStatusQuery } from '@prism/types';
import type { Prisma } from '@prisma/client';
import { randomUUID } from 'node:crypto';
import { createHash } from 'node:crypto';
import { EventAccessPolicyService, type ResolvedEventOpsActor } from '@prism/kernel/access-control';
import { OpsUserRole } from '@prism/kernel/event-core';
import { AUDIT_WRITER, type AuditWriter, writeAudit } from '@prism/kernel/access-control';
import { Inject, Logger } from '@nestjs/common';
import type { PrismTransactionContext } from '@prism/kernel/shared-kernel';
import { NOTIFICATION_OUTBOX_WRITER, type NotificationOutboxWriter, writeNotification } from '@prism/contexts/platform-ops';
import { PRISM_PORTAL_URLS, type PrismPortalUrls } from '@prism/kernel/shared';
import { ACCOUNT_PROVISIONING, type AccountInvitationActor, type AccountProvisioningPort } from '@prism/contexts/identity-access/account-invitation-reference';
import { mapSupplierApplication, mapSupplierApplicationStatus } from './supplier-application.mappers';
import { applicationStatusForReviewAction } from './supplier-application-status';

function normalizeEmail(value: string) {
  return value.trim().toLowerCase();
}

function daysBetween(left: Date, right: Date) {
  return Math.abs(left.getTime() - right.getTime()) / 86_400_000;
}

function conversionHash(applicationId: string, input: ReviewSupplierApplicationInput) {
  return createHash('sha256').update(JSON.stringify({ applicationId, action: input.action, notes: input.notes?.trim() ?? '' })).digest('hex');
}

function supplierApplicationStatusInstructions(origin: string) {
  if (/^https?:\/\/(localhost|127\.0\.0\.1)(?::\d+)?$/i.test(origin)) {
    return 'Visit the Supplier Portal and open the Check application status page.';
  }
  return `Check your application at ${origin}/status.`;
}

type SupplierApplicationWithCategory = Prisma.OpsSupplierApplicationGetPayload<{ include: { category: true } }>;

@Injectable()
export class SupplierApplicationService {
  private readonly logger = new Logger(SupplierApplicationService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly eventAccessPolicyService: EventAccessPolicyService,
    @Inject(AUDIT_WRITER) private readonly auditWriter: AuditWriter,
    @Inject(NOTIFICATION_OUTBOX_WRITER) private readonly notificationOutboxWriter: NotificationOutboxWriter,
    @Inject(PRISM_PORTAL_URLS) private readonly portalUrls: PrismPortalUrls,
    @Inject(ACCOUNT_PROVISIONING) private readonly accountProvisioning: AccountProvisioningPort,
  ) {}

  async createSupplierApplication(input: CreateSupplierApplicationInput) {
    if (!input.privacyConsentAccepted) {
      throw new BadRequestException('Privacy consent is required before submitting an application');
    }

    const normalizedEmail = normalizeEmail(input.email);

    const existingApplications = await this.prisma.opsSupplierApplication.findMany({
      where: { normalizedEmail },
      take: 50,
      orderBy: { createdAt: 'asc' },
    });

    const recentDuplicate = existingApplications.find(
      (app) => daysBetween(app.createdAt, new Date()) <= 14,
    );
    if (recentDuplicate) {
      throw new BadRequestException(
        'An application with this email was already submitted within the last 14 days',
      );
    }

    const row = await this.prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      const created = await tx.opsSupplierApplication.create({
        data: {
          id: `sap_${randomUUID()}`,
          companyName: input.companyName,
          contactName: input.contactName,
          email: input.email.trim(),
          normalizedEmail,
          phone: input.phone ?? '',
          categoryId: input.categoryId ?? null,
          pastEvents: input.pastEvents ?? '',
          serviceInclusions: input.serviceInclusions ?? '',
          certifications: input.certifications ?? '',
          priceRange: input.priceRange ?? '',
          bniMember: Boolean(input.bniMember),
          portfolioUrl: input.portfolioUrl ?? '',
          additionalNotes: input.additionalNotes ?? '',
          privacyConsentAccepted: input.privacyConsentAccepted,
          privacyNoticeVersion: input.privacyNoticeVersion,
          status: 'pending',
        },
        include: { category: true, convertedSupplier: true },
      });
      const notificationKey = `supplier-application:${created.id}:submitted:v1`;
      await writeNotification(
        this.notificationOutboxWriter,
        undefined,
        created.email,
        `P.R.I.S.M received your supplier application ${created.id}. ${supplierApplicationStatusInstructions(this.portalUrls.supplier)}`,
        'email',
        { correlationId: notificationKey, idempotencyKey: notificationKey },
        { prisma: tx, correlationId: notificationKey },
      );
      return created;
    });

    return mapSupplierApplication(row);
  }

  async listPublicCategories() {
    const categories = await this.prisma.opsSupplierCategory.findMany({
      where: { active: true },
      orderBy: { sortOrder: 'asc' },
    });

    return categories.map((cat) => ({
      id: cat.id,
      name: cat.name,
    }));
  }

  async getPublicStatus(input: SupplierApplicationStatusQuery) {
    const row = await this.prisma.opsSupplierApplication.findUnique({
      where: { id: input.applicationId },
      select: { id: true, companyName: true, status: true, createdAt: true, reviewedAt: true, normalizedEmail: true, email: true },
    });
    if (!row || normalizeEmail(row.normalizedEmail || row.email) !== normalizeEmail(input.email)) {
      throw new NotFoundException('Supplier application not found');
    }
    return mapSupplierApplicationStatus(row);
  }

  async listInbox(actor: ResolvedEventOpsActor) {
    await this.requirePmcm(actor, 'supplier application inbox');
    const rows = await this.prisma.opsSupplierApplication.findMany({
      include: { category: true },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
    return rows.map((row) => mapSupplierApplication(row));
  }

  async reviewApplication(
    applicationId: string,
    input: ReviewSupplierApplicationInput,
    actor: ResolvedEventOpsActor,
  ) {
    await this.requirePmcm(actor, 'supplier application review');
    const existing = await this.prisma.opsSupplierApplication.findUnique({
      where: { id: applicationId },
      include: { category: true },
    });
    if (!existing) throw new NotFoundException('Supplier application not found');
    const replay = this.approvalReplay(existing, applicationId, input);
    if (replay) return mapSupplierApplication(replay);
    this.assertReviewTransition(existing.status, input.action);
    // Checked before the approval commits, so an unnamed actor cannot leave an approval without its login attempt.
    const approver = input.action === 'approve' ? this.invitationActorFor(actor) : null;

    const nextStatus = applicationStatusForReviewAction(input.action);
    if (input.action === 'approve' && (!existing.categoryId || !existing.category?.active)) {
      throw new BadRequestException('A supplier category is required before approval');
    }
    const now = new Date();
    // Set only by the call that converts the application, so a replayed approval never provisions a second login.
    const conversion: { approved?: SupplierApplicationWithCategory } = {};
    const row = await this.prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      const changed = await tx.opsSupplierApplication.updateMany({
        where: { id: applicationId, status: existing.status },
        data: {
        status: nextStatus,
        declineReason: input.action === 'decline' ? input.declineReason?.trim() ?? null : existing.declineReason,
        reviewedAt: now,
        approvedAt: input.action === 'approve' ? now : existing.approvedAt,
        },
      });
      if (changed.count !== 1) throw new BadRequestException('Supplier application has already been reviewed');
      const updated = await tx.opsSupplierApplication.findUnique({ where: { id: applicationId }, include: { category: true } });
      if (!updated) throw new NotFoundException('Supplier application not found');
      if (input.action === 'approve' && updated.categoryId) {
        await this.convertApprovedApplication(tx, applicationId, updated, input, actor);
        conversion.approved = updated;
      }
      await writeAudit(this.auditWriter, undefined, actor.name, `Reviewed supplier application: ${updated.companyName}`, {
        actorRole: actor.role, actorEmail: actor.email, actionType: 'update', category: 'suppliers',
        affectedType: 'supplier_application', affectedId: updated.id, affectedLabel: updated.companyName,
        metadata: { status: updated.status, action: input.action },
      }, { prisma: tx, correlationId: `supplier-application-review:${updated.id}`, actorId: actor.id ?? actor.name });
      return updated;
    });
    if (conversion.approved && approver) {
      await this.provisionSupplierLogin(conversion.approved, approver).catch((error: unknown) => this.recordMissingSupplierLogin(conversion.approved!, approver, error));
    }
    return mapSupplierApplication(row);
  }

  /**
   * PMCM admins and the system re-send an approved application's supplier login, for example after a login could not be created.
   * Refused for any application that is not approved, so a login is never sent for a rejected or pending supplier.
   */
  async resendAccountInvitation(applicationId: string, actor: ResolvedEventOpsActor) {
    await this.requirePmcm(actor, 'supplier account invitation');
    const invitedBy = this.invitationActorFor(actor);
    const application = await this.prisma.opsSupplierApplication.findUnique({ where: { id: applicationId }, include: { category: true } });
    if (!application) throw new NotFoundException('Supplier application not found');
    if (application.status !== 'approved') throw new ConflictException('Supplier logins are sent for approved applications only');
    return this.provisionSupplierLogin(application, invitedBy);
  }

  /** Attributes the invitation to the person who acted, not a generic system actor. */
  private invitationActorFor(actor: ResolvedEventOpsActor): AccountInvitationActor {
    const id = actor.id?.trim();
    const name = actor.name?.trim();
    if (!id || !name) throw new ForbiddenException('A named actor is required to invite a supplier');
    return { id, name, role: actor.role };
  }

  /**
   * Approval runs this after it commits, so a failure is audited and logged rather than thrown: the approval stands and
   * the audit trail shows the login is missing. The resend route calls the same method and lets failures surface.
   */
  private async provisionSupplierLogin(application: SupplierApplicationWithCategory, invitedBy: AccountInvitationActor) {
    return this.accountProvisioning.provision({
      email: application.email,
      name: application.contactName,
      role: 'supplier',
      organization: application.companyName,
      source: 'supplier_application',
      sourceId: application.id,
      actor: invitedBy,
    });
  }

  private async recordMissingSupplierLogin(application: SupplierApplicationWithCategory, invitedBy: AccountInvitationActor, error: unknown) {
    const reason = error instanceof Error ? error.message : String(error);
    this.logger.error(`Supplier login was not provisioned for approved application ${application.id}: ${reason}`);
    await writeAudit(this.auditWriter, undefined, invitedBy.name, `Supplier login was not created for approved application: ${application.companyName}`, {
      actorRole: invitedBy.role,
      actionType: 'update',
      category: 'suppliers',
      affectedType: 'supplier_application',
      affectedId: application.id,
      affectedLabel: application.companyName,
      severity: 'warning',
    });
  }

  private approvalReplay(existing: SupplierApplicationWithCategory, applicationId: string, input: ReviewSupplierApplicationInput): SupplierApplicationWithCategory | null {
    if (existing.status !== 'approved' || input.action !== 'approve' || !existing.convertedSupplierId) return null;
    if (existing.conversionIdempotencyKey !== (input.idempotencyKey ?? `supplier-application:${applicationId}`) || existing.conversionPayloadHash !== conversionHash(applicationId, input)) throw new BadRequestException('Approval replay payload does not match the original conversion');
    return existing;
  }

  private assertReviewTransition(status: string, action: ReviewSupplierApplicationInput['action']) {
    if (['declined', 'approved'].includes(status)) throw new BadRequestException('Supplier application has already been reviewed');
    if (status !== 'pending' && action !== 'approve') throw new BadRequestException('Only approval can complete an application already in progress');
  }

  private async convertApprovedApplication(tx: Prisma.TransactionClient, applicationId: string, updated: SupplierApplicationWithCategory, input: ReviewSupplierApplicationInput, actor: ResolvedEventOpsActor) {
    if (!updated.categoryId) throw new BadRequestException('A supplier category is required before conversion');
    const supplierId = `sup_application_${applicationId}`;
    const normalizedEmail = updated.email.trim().toLowerCase();
    // QUERY_AUDIT_RAW_SQL: serialize conversions by normalized email to prevent duplicate suppliers.
    await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext(${normalizedEmail}))`;
    const conflictingSupplier = await tx.opsSupplier.findFirst({ where: { email: { equals: normalizedEmail, mode: 'insensitive' } } });
    if (conflictingSupplier && conflictingSupplier.id !== supplierId) throw new BadRequestException('A supplier with this email already exists');
    const supplier = await tx.opsSupplier.findUnique({ where: { id: supplierId } });
    if (!supplier) {
      await tx.opsSupplier.create({ data: { id: supplierId, categoryId: updated.categoryId, name: updated.companyName.trim(), contactName: updated.contactName.trim(), email: normalizedEmail, phone: updated.phone.trim(), tier: 'pending_first_event', bniMember: updated.bniMember, serviceInclusions: updated.serviceInclusions.trim(), performanceNotes: updated.additionalNotes.trim() } });
      await writeAudit(this.auditWriter, undefined, actor.name, `Converted supplier application into supplier: ${updated.companyName}`, {
        actorRole: actor.role, actorEmail: actor.email, actionType: 'create', category: 'suppliers',
        affectedType: 'supplier', affectedId: supplierId, affectedLabel: updated.companyName,
        metadata: { applicationId, categoryId: updated.categoryId, tier: 'pending_first_event' },
      }, { prisma: tx, correlationId: `supplier-application-conversion:${applicationId}`, actorId: actor.id ?? actor.name });
    }
    await tx.opsSupplierApplication.update({ where: { id: applicationId }, data: { convertedSupplierId: supplierId, conversionIdempotencyKey: input.idempotencyKey ?? `supplier-application:${applicationId}`, conversionPayloadHash: conversionHash(applicationId, input) } });
  }

  private requirePmcm(actor: ResolvedEventOpsActor, resource: string) {
    return this.eventAccessPolicyService.requireActorRole(
      actor,
      [OpsUserRole.PmcmAdmin, OpsUserRole.System],
      resource,
    );
  }
}

