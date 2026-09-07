import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '@prism/kernel/database';
import type { CreateSupplierApplicationInput, ReviewSupplierApplicationInput } from '@prism/types';
import type { Prisma } from '@prisma/client';
import { randomUUID } from 'node:crypto';
import { createHash } from 'node:crypto';
import { EventAccessPolicyService, type ResolvedEventOpsActor } from '@prism/kernel/access-control';
import { OpsUserRole } from '@prism/kernel/event-core';
import { AUDIT_WRITER, type AuditWriter, writeAudit } from '@prism/kernel/access-control';
import { Inject } from '@nestjs/common';
import type { PrismTransactionContext } from '@prism/kernel/shared-kernel';
import { mapSupplierApplication } from './supplier-application.mappers';
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

@Injectable()
export class SupplierApplicationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly eventAccessPolicyService: EventAccessPolicyService,
    @Inject(AUDIT_WRITER) private readonly auditWriter: AuditWriter,
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

    const row = await this.prisma.opsSupplierApplication.create({
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
        privacyConsentAccepted: true,
        privacyNoticeVersion: input.privacyNoticeVersion ?? '2026-05-01',
        status: 'pending',
      },
      include: { category: true, convertedSupplier: true },
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

    const nextStatus = applicationStatusForReviewAction(input.action);
    if (input.action === 'approve' && (!existing.categoryId || !existing.category?.active)) {
      throw new BadRequestException('A supplier category is required before approval');
    }
    const now = new Date();
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
      if (input.action === 'approve' && updated.categoryId) await this.convertApprovedApplication(tx, applicationId, updated, input);
      await writeAudit(this.auditWriter, undefined, actor.name, `Reviewed supplier application: ${updated.companyName}`, {
        actorRole: actor.role, actorEmail: actor.email, actionType: 'update', category: 'suppliers',
        affectedType: 'supplier_application', affectedId: updated.id, affectedLabel: updated.companyName,
        metadata: { status: updated.status, action: input.action },
      }, { prisma: tx, correlationId: `supplier-application-review:${updated.id}`, actorId: actor.id ?? actor.name });
      return updated;
    });
    return mapSupplierApplication(row);
  }

  private approvalReplay(existing: any, applicationId: string, input: ReviewSupplierApplicationInput) {
    if (existing.status !== 'approved' || input.action !== 'approve' || !existing.convertedSupplierId) return null;
    if (existing.conversionIdempotencyKey !== (input.idempotencyKey ?? `supplier-application:${applicationId}`) || existing.conversionPayloadHash !== conversionHash(applicationId, input)) throw new BadRequestException('Approval replay payload does not match the original conversion');
    return existing;
  }

  private assertReviewTransition(status: string, action: ReviewSupplierApplicationInput['action']) {
    if (['declined', 'approved'].includes(status)) throw new BadRequestException('Supplier application has already been reviewed');
    if (status !== 'pending' && action !== 'approve') throw new BadRequestException('Only approval can complete an application already in progress');
  }

  private async convertApprovedApplication(tx: Prisma.TransactionClient, applicationId: string, updated: any, input: ReviewSupplierApplicationInput) {
    const supplierId = `sup_application_${applicationId}`;
    const normalizedEmail = updated.email.trim().toLowerCase();
    await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext(${normalizedEmail}))`;
    const conflictingSupplier = await tx.opsSupplier.findFirst({ where: { email: { equals: normalizedEmail, mode: 'insensitive' } } });
    if (conflictingSupplier && conflictingSupplier.id !== supplierId) throw new BadRequestException('A supplier with this email already exists');
    const supplier = await tx.opsSupplier.findUnique({ where: { id: supplierId } });
    if (!supplier) await tx.opsSupplier.create({ data: { id: supplierId, categoryId: updated.categoryId, name: updated.companyName.trim(), contactName: updated.contactName.trim(), email: updated.email.trim(), phone: updated.phone.trim(), tier: 'pending_first_event', bniMember: updated.bniMember, serviceInclusions: updated.serviceInclusions.trim(), performanceNotes: updated.additionalNotes.trim() } });
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

