import { BadRequestException, Injectable } from '@nestjs/common';
import type { OpsSupplierApplication, OpsSupplierCategory } from '@prisma/client';
import { PrismaService } from '@prism/database';
import { randomUUID } from 'node:crypto';
import type { CreateSupplierApplicationDto } from '../dto/supplier-application.dto';
import { mapSupplierApplication } from '../mappers/supplier-application.mappers';

function normalizeEmail(value: string) {
  return value.trim().toLowerCase();
}

function daysBetween(left: Date, right: Date) {
  return Math.abs(left.getTime() - right.getTime()) / 86_400_000;
}

@Injectable()
export class SupplierApplicationService {
  constructor(private readonly prisma: PrismaService) {}

  async createSupplierApplication(input: CreateSupplierApplicationDto) {
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
}
