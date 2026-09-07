import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '@prism/kernel/database';
import type { CreateSupplierApplicationInput, ReviewSupplierApplicationInput } from '@prism/types';
import { randomUUID } from 'node:crypto';
import { EventAccessPolicyService, type ResolvedEventOpsActor } from '@prism/kernel/access-control';
import { OpsUserRole } from '@prism/kernel/event-core';
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
    const now = new Date();
    const row = await this.prisma.opsSupplierApplication.update({
      where: { id: applicationId },
      data: {
        status: nextStatus,
        declineReason: input.action === 'decline' ? input.declineReason?.trim() ?? null : existing.declineReason,
        reviewedAt: now,
        approvedAt: existing.approvedAt,
      },
      include: { category: true },
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

