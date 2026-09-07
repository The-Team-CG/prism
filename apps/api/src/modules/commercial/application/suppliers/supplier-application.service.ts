import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '@prism/kernel/database';
import type { CreateSupplierApplicationInput, ReviewSupplierApplicationInput } from '@prism/types';
import type { Prisma } from '@prisma/client';
import { randomUUID } from 'node:crypto';
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
      include: { category: true },
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
    if (['declined', 'approved', 'proposal_requested', 'meeting_scheduled'].includes(existing.status)) {
      throw new BadRequestException('Supplier application has already been reviewed');
    }

    const nextStatus = applicationStatusForReviewAction(input.action);
    if (input.action === 'approve' && (!existing.categoryId || !existing.category?.active)) {
      throw new BadRequestException('A supplier category is required before approval');
    }
    const now = new Date();
    const row = await this.prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      const changed = await tx.opsSupplierApplication.updateMany({
        where: { id: applicationId, status: 'pending' },
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
        const supplierId = `sup_application_${applicationId}`;
        const supplier = await tx.opsSupplier.findUnique({ where: { id: supplierId } });
        if (!supplier) {
          await tx.opsSupplier.create({
            data: {
              id: supplierId,
              categoryId: updated.categoryId,
              name: updated.companyName.trim(),
              contactName: updated.contactName.trim(),
              email: updated.email.trim(),
              phone: updated.phone.trim(),
              tier: 'pending_first_event',
              bniMember: updated.bniMember,
              serviceInclusions: updated.serviceInclusions.trim(),
              performanceNotes: updated.additionalNotes.trim(),
            },
          });
        }
      }
      await writeAudit(this.auditWriter, undefined, actor.name, `Reviewed supplier application: ${updated.companyName}`, {
        actorRole: actor.role, actorEmail: actor.email, actionType: 'update', category: 'suppliers',
        affectedType: 'supplier_application', affectedId: updated.id, affectedLabel: updated.companyName,
        metadata: { status: updated.status, action: input.action },
      }, { prisma: tx, correlationId: `supplier-application-review:${updated.id}`, actorId: actor.id ?? actor.name });
      return updated;
    });
    return mapSupplierApplication(row);
  }

  private requirePmcm(actor: ResolvedEventOpsActor, resource: string) {
    return this.eventAccessPolicyService.requireActorRole(
      actor,
      [OpsUserRole.PmcmAdmin, OpsUserRole.System],
      resource,
    );
  }
}

