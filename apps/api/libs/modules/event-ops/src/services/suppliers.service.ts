import { BadRequestException, NotFoundException } from '@nestjs/common';
import type {
  OpsEvent,
  OpsSupplier,
  OpsSupplierCategory,
  OpsSupplierCertification,
  OpsSupplierReliabilityNote,
  OpsSupplierReview,
} from '@prisma/client';
import type { PrismaService } from '@prism/database';
import { randomUUID } from 'node:crypto';
import { SupplierTier } from '../ops.constants';

export type AddSupplierQuoteInput = {
  requestId?: string;
  supplierId?: string;
  categoryId?: string;
  supplierName?: string;
  category?: string;
  amount?: number;
  inclusions?: string[];
  paymentTerms?: string;
  notes?: string;
  status?: string;
};

export type CreateSupplierInput = {
  categoryId: string;
  name: string;
  contactName?: string;
  email?: string;
  phone?: string;
  tier?: string;
  bniMember?: boolean;
  serviceInclusions?: string;
  performanceNotes?: string;
};

export type UpdateSupplierInput = Partial<Omit<CreateSupplierInput, 'tier'>>;

export type ChangeSupplierTierInput = {
  tier: string;
  reason: string;
};

export type CreateSupplierReviewInput = {
  eventId?: string;
  rating: number;
  notes: string;
  reviewedBy?: string;
};

export type CreateSupplierCertificationInput = {
  fileName: string;
  documentType: string;
  issuer?: string;
  expiresAt?: string;
  status?: string;
  notes?: string;
};

type SupplierWithProfile = OpsSupplier & {
  category: OpsSupplierCategory;
  reviews: Array<OpsSupplierReview & { event: OpsEvent | null }>;
  reliabilityNotes: Array<OpsSupplierReliabilityNote & { event: OpsEvent | null }>;
  certifications: OpsSupplierCertification[];
};

function isoDate(value: Date) {
  return value.toISOString().slice(0, 10);
}

function timestamp(value: Date) {
  return value.toISOString();
}

export class SuppliersService {
  constructor(private readonly prisma: PrismaService) {}

  async listSupplierCategories() {
    const categories = await this.prisma.opsSupplierCategory.findMany({
      where: { active: true },
      orderBy: { sortOrder: 'asc' },
    });
    return categories.map((category: OpsSupplierCategory) => this.mapSupplierCategory(category));
  }

  async listSuppliers() {
    const suppliers = await this.supplierRows();
    return suppliers.map((supplier: SupplierWithProfile) => this.mapSupplier(supplier));
  }

  async createSupplier(input: CreateSupplierInput) {
    await this.requireCategory(input.categoryId);

    const supplier = await this.prisma.opsSupplier.create({
      data: {
        id: `sup_${randomUUID()}`,
        categoryId: input.categoryId,
        name: input.name.trim(),
        contactName: input.contactName?.trim() ?? '',
        email: input.email?.trim() ?? '',
        phone: input.phone?.trim() ?? '',
        tier: input.tier ?? SupplierTier.PendingFirstEvent,
        bniMember: Boolean(input.bniMember),
        serviceInclusions: input.serviceInclusions?.trim() ?? '',
        performanceNotes: input.performanceNotes?.trim() ?? '',
      },
    });

    return this.mapSupplier(await this.supplierRow(supplier.id));
  }

  async updateSupplier(supplierId: string, input: UpdateSupplierInput) {
    if (input.categoryId) await this.requireCategory(input.categoryId);

    const supplier = await this.prisma.opsSupplier
      .update({
        where: { id: supplierId },
        data: {
          ...(typeof input.bniMember === 'boolean' ? { bniMember: input.bniMember } : {}),
          ...(input.categoryId ? { categoryId: input.categoryId } : {}),
          ...(input.name !== undefined ? { name: input.name.trim() } : {}),
          ...(input.contactName !== undefined ? { contactName: input.contactName.trim() } : {}),
          ...(input.email !== undefined ? { email: input.email.trim() } : {}),
          ...(input.phone !== undefined ? { phone: input.phone.trim() } : {}),
          ...(input.serviceInclusions !== undefined ? { serviceInclusions: input.serviceInclusions.trim() } : {}),
          ...(input.performanceNotes !== undefined ? { performanceNotes: input.performanceNotes.trim() } : {}),
        },
      })
      .catch(() => {
        throw new NotFoundException('Supplier not found');
      });

    const row = await this.supplierRow(supplier.id);
    return this.mapSupplier(row);
  }

  async changeSupplierTier(supplierId: string, input: ChangeSupplierTierInput) {
    if (!input.reason.trim()) throw new BadRequestException('Tier change reason is required');
    if (!Object.values(SupplierTier).includes(input.tier as SupplierTier)) {
      throw new BadRequestException('Unsupported supplier tier');
    }

    const existing = await this.supplierRow(supplierId);
    const supplier = await this.prisma.opsSupplier.update({
      where: { id: supplierId },
      data: { tier: input.tier },
    });

    return { oldTier: existing.tier, supplier: this.mapSupplier(await this.supplierRow(supplier.id)) };
  }

  async addSupplierReview(supplierId: string, input: CreateSupplierReviewInput) {
    await this.supplierRow(supplierId);
    if (input.rating < 1 || input.rating > 5) throw new BadRequestException('Supplier review rating must be 1 to 5');

    await this.prisma.opsSupplierReview.create({
      data: {
        id: `review_${randomUUID()}`,
        supplierId,
        eventId: input.eventId ?? null,
        rating: input.rating,
        notes: input.notes,
        reviewedBy: input.reviewedBy ?? 'PMCM Admin',
      },
    });

    return this.mapSupplier(await this.supplierRow(supplierId));
  }

  async addSupplierCertification(supplierId: string, input: CreateSupplierCertificationInput) {
    await this.supplierRow(supplierId);

    await this.prisma.opsSupplierCertification.create({
      data: {
        id: `cert_${randomUUID()}`,
        supplierId,
        fileName: input.fileName,
        documentType: input.documentType,
        issuer: input.issuer ?? '',
        expiresAt: input.expiresAt ? new Date(input.expiresAt) : null,
        status: input.status ?? 'submitted',
        notes: input.notes ?? '',
      },
    });

    return this.mapSupplier(await this.supplierRow(supplierId));
  }

  async supplierRow(supplierId: string) {
    const supplier = await this.prisma.opsSupplier.findUnique({
      where: { id: supplierId },
      include: {
        category: true,
        reviews: {
          include: { event: true },
          orderBy: { createdAt: 'desc' },
        },
        reliabilityNotes: {
          include: { event: true },
          orderBy: { createdAt: 'desc' },
        },
        certifications: { orderBy: { uploadedAt: 'desc' } },
      },
    });

    if (!supplier) throw new NotFoundException('Supplier not found');
    return supplier as SupplierWithProfile;
  }

  async resolveQuoteSupplier(input: AddSupplierQuoteInput) {
    if (input.supplierId) {
      return this.supplierRow(input.supplierId);
    }

    if (!input.categoryId) return null;

    const category = await this.prisma.opsSupplierCategory.findUnique({
      where: { id: input.categoryId },
    });
    if (!category) throw new NotFoundException('Supplier category not found');

    const tierOneSupplier = await this.prisma.opsSupplier.findFirst({
      where: { categoryId: category.id, tier: SupplierTier.Tier1 },
      orderBy: { name: 'asc' },
    });
    if (!tierOneSupplier) {
      throw new BadRequestException('No Tier 1 supplier exists for this category');
    }

    return this.supplierRow(tierOneSupplier.id);
  }

  mapSupplierCategory(category: OpsSupplierCategory) {
    return {
      id: category.id,
      slug: category.slug,
      name: category.name,
      sortOrder: category.sortOrder,
      active: category.active,
      acceptableMin: category.acceptableMin ?? null,
      acceptableMax: category.acceptableMax ?? null,
    };
  }

  mapSupplier(supplier: SupplierWithProfile) {
    const ratings = supplier.reviews.map((review) => review.rating);
    const aggregateRating =
      ratings.length > 0
        ? Math.round((ratings.reduce((sum, rating) => sum + rating, 0) / ratings.length) * 10) / 10
        : null;
    const datedEvents = supplier.reviews
      .map((review) => review.event)
      .filter((event): event is OpsEvent => Boolean(event))
      .sort((a, b) => b.eventDate.getTime() - a.eventDate.getTime());

    return {
      id: supplier.id,
      name: supplier.name,
      categoryId: supplier.categoryId,
      categoryName: supplier.category.name,
      categorySlug: supplier.category.slug,
      tier: supplier.tier,
      bniMember: supplier.bniMember,
      autoTrust: supplier.bniMember,
      contactName: supplier.contactName,
      email: supplier.email,
      phone: supplier.phone,
      serviceInclusions: supplier.serviceInclusions,
      performanceNotes: supplier.performanceNotes,
      applicationDate: isoDate(supplier.applicationDate),
      aggregateRating,
      lastEventDate: datedEvents[0] ? isoDate(datedEvents[0].eventDate) : null,
      pastEvents: datedEvents.map((event) => ({
        id: event.id,
        eventName: event.eventName,
        clientName: event.clientName,
        eventDate: isoDate(event.eventDate),
      })),
      reviews: supplier.reviews.map((review) => ({
        id: review.id,
        rating: review.rating,
        notes: review.notes,
        reviewedBy: review.reviewedBy,
        eventId: review.eventId,
        eventName: review.event?.eventName ?? null,
        createdAt: timestamp(review.createdAt),
      })),
      reliabilityNotes: supplier.reliabilityNotes.map((note) => ({
        id: note.id,
        note: note.note,
        eventId: note.eventId,
        eventName: note.event?.eventName ?? null,
        createdAt: timestamp(note.createdAt),
      })),
      certifications: supplier.certifications.map((certification) => {
        const metadata = certification as OpsSupplierCertification & {
          documentType?: string;
          issuer?: string;
          expiresAt?: Date | null;
          status?: string;
          notes?: string;
        };
        return {
          id: certification.id,
          fileName: certification.fileName,
          documentType: metadata.documentType ?? '',
          issuer: metadata.issuer ?? '',
          expiresAt: metadata.expiresAt ? isoDate(metadata.expiresAt) : null,
          status: metadata.status ?? 'submitted',
          notes: metadata.notes ?? '',
          uploadedAt: timestamp(certification.uploadedAt),
        };
      }),
    };
  }

  private async requireCategory(categoryId: string) {
    const category = await this.prisma.opsSupplierCategory.findUnique({ where: { id: categoryId } });
    if (!category) throw new NotFoundException('Supplier category not found');
    return category;
  }

  private supplierRows() {
    return this.prisma.opsSupplier.findMany({
      include: {
        category: true,
        reviews: {
          include: { event: true },
          orderBy: { createdAt: 'desc' },
        },
        reliabilityNotes: {
          include: { event: true },
          orderBy: { createdAt: 'desc' },
        },
        certifications: { orderBy: { uploadedAt: 'desc' } },
      },
      orderBy: [{ category: { sortOrder: 'asc' } }, { tier: 'asc' }, { name: 'asc' }],
    });
  }
}
