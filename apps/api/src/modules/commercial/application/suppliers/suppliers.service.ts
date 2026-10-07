import { Inject, Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type {
  ChangeSupplierTierInput,
  CreateSupplierCertificationInput,
  CreateSupplierInput,
  CreateSupplierReliabilityNoteInput,
  CreateSupplierReviewInput,
  PromoteSupplierInput,
  UpdateSupplierInput,
} from '@prism/types';
import type {
  OpsSupplier,
  OpsSupplierCategory,
  OpsSupplierCertification,
  OpsSupplierReliabilityNote,
  OpsSupplierReview,
  OpsSupplierReviewDimension,
  OpsSupplierReviewDimensionRating,
} from '@prisma/client';
import type { AddSupplierQuoteInput } from '@prism/types';
import { PrismaService } from '@prism/kernel/database';
import type { PrismTransactionContext } from '@prism/kernel/shared-kernel';
import type { SupplierPromotionResult } from '../../contracts/supplier-directory.port';
import { createHash, randomUUID } from 'node:crypto';
import { SupplierTier } from '@prism/kernel/event-core';
import { COMMERCIAL_FACTS_READER, type CommercialFactsReader } from '@prism/contexts/read-models/commercial-facts-reader';
import {
  OPERATIONS_EVENT_REFERENCE_READER,
  type OperationsEventReference,
  type OperationsEventReferenceReader,
} from '@prism/contexts/event-lifecycle/operations-reference';

function isIdempotencyKeyViolation(error: unknown): boolean {
  return isUniqueViolationOn(error, ['idempotencyKey', 'idempotency_key']);
}

function isAssessmentUniqueViolation(error: unknown): boolean {
  if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== 'P2002') return false;
  const target = error.meta?.target;
  const names = Array.isArray(target) ? target.map(String) : typeof target === 'string' ? [target] : [];
  if (names.some((name) => name.includes('supplier_reviews_supplier_event_key'))) return true;
  return names.some((name) => /^supplier_?id$/i.test(name)) && names.some((name) => /^event_?id$/i.test(name));
}

function isUniqueViolationOn(error: unknown, fragments: string[]): boolean {
  if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== 'P2002') return false;
  const target = error.meta?.target;
  const names = Array.isArray(target) ? target.map(String) : typeof target === 'string' ? [target] : [];
  return names.some((name) => fragments.some((fragment) => name.includes(fragment)));
}

type ReviewDimensionRatingWithDimension = OpsSupplierReviewDimensionRating & { dimension: OpsSupplierReviewDimension };

type SupplierProfileBase = OpsSupplier & {
  category: OpsSupplierCategory;
  reviews: Array<OpsSupplierReview & { dimensionRatings: ReviewDimensionRatingWithDimension[] }>;
  reliabilityNotes: OpsSupplierReliabilityNote[];
  certifications: OpsSupplierCertification[];
};
type SupplierWithProfile = Omit<SupplierProfileBase, 'reviews' | 'reliabilityNotes'> & {
  reviews: Array<OpsSupplierReview & { event: OperationsEventReference | null; dimensionRatings: ReviewDimensionRatingWithDimension[] }>;
  reliabilityNotes: Array<OpsSupplierReliabilityNote & { event: Pick<OperationsEventReference, 'id' | 'eventName'> | null }>;
};

type CategoryWithDimensions = OpsSupplierCategory & { reviewDimensions: OpsSupplierReviewDimension[] };

function isoDate(value: Date) {
  return value.toISOString().slice(0, 10);
}

function timestamp(value: Date) {
  return value.toISOString();
}

@Injectable()
export class SuppliersService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(OPERATIONS_EVENT_REFERENCE_READER) private readonly eventReferences: OperationsEventReferenceReader,
    @Inject(COMMERCIAL_FACTS_READER) private readonly commercialFacts: CommercialFactsReader,
  ) {}

  async listSupplierCategories() {
    const categories = await this.prisma.opsSupplierCategory.findMany({
      where: { active: true },
      orderBy: { sortOrder: 'asc' },
      include: {
        reviewDimensions: {
          where: { active: true },
          orderBy: { sortOrder: 'asc' },
        },
      },
    });
    return categories.map((category: CategoryWithDimensions) => this.mapSupplierCategory(category));
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
    if (existing.tier === SupplierTier.PendingFirstEvent) throw new BadRequestException('Pending-first-event suppliers require a completed event promotion');
    const supplier = await this.prisma.opsSupplier.update({
      where: { id: supplierId },
      data: { tier: input.tier },
    });

    return { oldTier: existing.tier, supplier: this.mapSupplier(await this.supplierRow(supplier.id)) };
  }

  async addSupplierReview(supplierId: string, input: CreateSupplierReviewInput, reviewedBy: string, context?: PrismTransactionContext) {
    const db = context?.prisma ?? this.prisma;
    if (input.rating < 1 || input.rating > 5) throw new BadRequestException('Supplier review rating must be 1 to 5');
    await this.validateReviewEligibility(supplierId, input.eventId, db);
    const supplier = await this.supplierRow(supplierId, db);

    const dimensionRatings = input.dimensionRatings ?? [];
    await this.validateDimensionRatings(supplier.categoryId, dimensionRatings, db);

    const persisted = await this.persistSupplierReview(supplierId, input, reviewedBy, dimensionRatings, context);
    const reviewId = persisted.reviewId;
    if (persisted.replayed) return { supplier: this.mapSupplier(await this.supplierRow(supplierId, db)), reviewId, replayed: true };
    return { supplier: this.mapSupplier(await this.supplierRow(supplierId, db)), reviewId };
  }

  async addReliabilityNote(supplierId: string, input: CreateSupplierReliabilityNoteInput, context?: PrismTransactionContext, createdBy?: string) {
    const db = context?.prisma ?? this.prisma;
    await this.validateReviewEligibility(supplierId, input.eventId, db);
    const existing = input.idempotencyKey
      ? await db.opsSupplierReliabilityNote.findUnique({ where: { idempotencyKey: input.idempotencyKey } })
      : null;
    if (existing) {
      if (existing.supplierId !== supplierId || existing.eventId !== input.eventId || existing.note !== input.note.trim()) {
        throw new BadRequestException('Idempotency key was already used for a different reliability note');
      }
      return { supplier: this.mapSupplier(await this.supplierRow(supplierId, db)), noteId: existing.id, replayed: true };
    }
    const noteId = `reliability_${randomUUID()}`;
    await db.opsSupplierReliabilityNote.create({
      data: { id: noteId, supplierId, eventId: input.eventId, note: input.note.trim(), createdBy: createdBy ?? null, idempotencyKey: input.idempotencyKey ?? null },
    });
    return { supplier: this.mapSupplier(await this.supplierRow(supplierId, db)), noteId, replayed: false };
  }

  async promoteSupplier(supplierId: string, input: PromoteSupplierInput, promotedBy: string, context?: PrismTransactionContext): Promise<SupplierPromotionResult> {
    const db = context?.prisma ?? this.prisma;
    await this.validateReviewEligibility(supplierId, input.eventId, db);
    const supplier = await this.supplierRow(supplierId, db);
    const payloadHash = createHash('sha256').update(JSON.stringify({ supplierId, eventId: input.eventId, tier: input.tier, reason: input.reason.trim() })).digest('hex');
    const replay = await this.findPromotionReplay(db, input.idempotencyKey, payloadHash, supplierId);
    if (replay) return { supplier: this.mapSupplier(await this.supplierRow(supplierId, db)), replayed: true };
    this.assertPromotionTarget(supplier, input);
    const review = await db.opsSupplierReview.findFirst({ where: { supplierId, eventId: input.eventId }, select: { id: true } });
    if (!review) throw new BadRequestException('A completed event assessment is required before promotion');
    const changed = await db.opsSupplier.updateMany({ where: { id: supplierId, tier: SupplierTier.PendingFirstEvent }, data: { tier: input.tier } });
    if (changed.count !== 1) throw new BadRequestException('Supplier tier changed before promotion');
    await db.opsSupplierPromotion.create({ data: { id: `promotion_${randomUUID()}`, supplierId, reviewId: review.id, fromTier: SupplierTier.PendingFirstEvent, toTier: input.tier, reason: input.reason.trim(), promotedBy, idempotencyKey: input.idempotencyKey ?? `promotion_${randomUUID()}`, payloadHash } });
    return { supplier: this.mapSupplier(await this.supplierRow(supplierId, db)), replayed: false };
  }

  private assertPromotionTarget(supplier: SupplierWithProfile, input: PromoteSupplierInput) {
    if (!supplier.category.active) throw new BadRequestException('Supplier category is inactive');
    if (supplier.tier !== SupplierTier.PendingFirstEvent && supplier.tier !== input.tier) throw new BadRequestException('Only pending-first-event suppliers can be promoted');
    if (supplier.tier === input.tier) throw new BadRequestException('Supplier has already been promoted to this tier');
  }

  private async findPromotionReplay(db: PrismaService | Prisma.TransactionClient, key: string | undefined, payloadHash: string, supplierId: string) {
    if (!key) return false;
    const replay = await db.opsSupplierPromotion.findUnique({ where: { idempotencyKey: key } });
    if (!replay) return false;
    if (replay.payloadHash !== payloadHash || replay.supplierId !== supplierId) throw new BadRequestException('Idempotency key was already used for a different supplier promotion');
    return true;
  }

  private async persistSupplierReview(
    supplierId: string,
    input: CreateSupplierReviewInput,
    reviewedBy: string,
    dimensionRatings: NonNullable<CreateSupplierReviewInput['dimensionRatings']>,
    context?: PrismTransactionContext,
  ) {
    const db = context?.prisma ?? this.prisma;
    const reviewId = `review_${randomUUID()}`;
    await this.assertAssessmentAvailable(supplierId, input, db);
    try {
      await this.createSupplierReview(reviewId, supplierId, input, reviewedBy, dimensionRatings, db);
    } catch (error) {
      return this.resolveReviewConflict(error, supplierId, input, db);
    }
    return { reviewId, replayed: false };
  }

  private async assertAssessmentAvailable(supplierId: string, input: CreateSupplierReviewInput, db: PrismaService | Prisma.TransactionClient) {
    if (!input.eventId) return;
    // One PMCM assessment per supplier per event. A retry carrying the same idempotency key falls through to the
    // unique-key replay path, which also rejects a payload that differs from the original.
    const existingForEvent = await db.opsSupplierReview.findFirst({
      where: { supplierId, eventId: input.eventId }, select: { id: true, idempotencyKey: true },
    });
    if (existingForEvent && (!input.idempotencyKey || existingForEvent.idempotencyKey !== input.idempotencyKey)) {
      throw new BadRequestException('A supplier assessment already exists for this event');
    }
  }

  private async createSupplierReview(
    reviewId: string,
    supplierId: string,
    input: CreateSupplierReviewInput,
    reviewedBy: string,
    dimensionRatings: NonNullable<CreateSupplierReviewInput['dimensionRatings']>,
    db: PrismaService | Prisma.TransactionClient,
  ) {
    await db.opsSupplierReview.create({
      data: {
        id: reviewId,
        supplierId,
        eventId: input.eventId ?? null,
        rating: input.rating,
        notes: input.notes,
        reviewedBy,
        idempotencyKey: input.idempotencyKey ?? null,
        dimensionRatings: dimensionRatings.length
          ? {
              create: dimensionRatings.map((rating) => ({
                id: `dimr_${randomUUID()}`,
                dimensionId: rating.dimensionId,
                rating: rating.rating,
              })),
            }
          : undefined,
      },
    });
  }

  private async resolveReviewConflict(error: unknown, supplierId: string, input: CreateSupplierReviewInput, db: PrismaService | Prisma.TransactionClient) {
    const keyConflict = isIdempotencyKeyViolation(error);
    const assessmentConflict = isAssessmentUniqueViolation(error);
    if (!keyConflict && !assessmentConflict) throw error;
    // A same-key retry can trip either unique index; the key lookup decides between replay and conflict.
    const existing = input.idempotencyKey
      ? await db.opsSupplierReview.findFirst({
        where: { idempotencyKey: input.idempotencyKey },
        include: { dimensionRatings: { select: { dimensionId: true, rating: true } } },
      })
      : null;
    if (!existing) {
      if (assessmentConflict) throw new BadRequestException('A supplier assessment already exists for this event');
      throw error;
    }
    if (this.reviewReplayMismatches(existing, supplierId, input)) {
      throw new BadRequestException('Idempotency key was already used for a different supplier review');
    }
    return { reviewId: existing.id, replayed: true };
  }

  private reviewReplayMismatches(existing: { supplierId: string; eventId: string | null; rating: number; notes: string; reviewedBy: string }, supplierId: string, input: CreateSupplierReviewInput) {
    const existingDimensions = (existing as typeof existing & { dimensionRatings?: Array<{ dimensionId: string; rating: number }> }).dimensionRatings ?? [];
    const inputDimensions = input.dimensionRatings ?? [];
    return existing.supplierId !== supplierId || existing.eventId !== input.eventId || existing.rating !== input.rating || existing.notes !== input.notes || JSON.stringify(existingDimensions.slice().sort(this.compareDimensions)) !== JSON.stringify(inputDimensions.slice().sort(this.compareDimensions));
  }

  private compareDimensions(left: { dimensionId: string; rating: number }, right: { dimensionId: string; rating: number }) {
    return left.dimensionId.localeCompare(right.dimensionId) || left.rating - right.rating;
  }

  private async validateDimensionRatings(categoryId: string, ratings: NonNullable<CreateSupplierReviewInput['dimensionRatings']>, db: PrismaService | Prisma.TransactionClient) {
    // An assessment is complete only when every active dimension of the supplier's category is rated once.
    const ratedIds = new Set(ratings.map((rating) => rating.dimensionId));
    if (ratedIds.size !== ratings.length) throw new BadRequestException('Duplicate supplier review dimensions are not allowed');
    const activeDimensions = await db.opsSupplierReviewDimension.findMany({
      where: { categoryId, active: true }, select: { id: true },
    });
    const activeIds = new Set(activeDimensions.map((dimension) => dimension.id));
    if (ratings.some((rating) => !activeIds.has(rating.dimensionId))) {
      throw new BadRequestException("Dimension rating does not belong to the supplier's category");
    }
    if (activeDimensions.some((dimension) => !ratedIds.has(dimension.id))) {
      throw new BadRequestException('Every active supplier review dimension must be rated');
    }
  }

  private async validateReviewEligibility(supplierId: string, eventId: string | undefined, db: PrismaService | Prisma.TransactionClient) {
    if (!eventId) throw new BadRequestException('Supplier reviews require an event');
    const event = await this.commercialFacts.findSupplierReviewEventEligibility(eventId, db);
    if (!event) throw new BadRequestException('Supplier review event not found');
    if (event.actualEndedAt === null || !['completed', 'closed', 'archived'].includes(event.status)) {
      throw new BadRequestException('Supplier reviews are available only after event completion');
    }
    const confirmedAssignment = await db.opsSupplierQuoteRequest.findFirst({
      where: { eventId, supplierId, assignmentStatus: 'confirmed' }, select: { id: true },
    });
    if (!confirmedAssignment) throw new BadRequestException('Supplier was not confirmed for this event');
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

  async supplierRow(supplierId: string, db: PrismaService | Prisma.TransactionClient = this.prisma) {
    const supplier = await db.opsSupplier.findUnique({
      where: { id: supplierId },
      include: {
        category: true,
        reviews: {
          include: { dimensionRatings: { include: { dimension: true } } },
          orderBy: { createdAt: 'desc' },
        },
        reliabilityNotes: {
          orderBy: { createdAt: 'desc' },
        },
        certifications: { orderBy: { uploadedAt: 'desc' } },
      },
    });

    if (!supplier) throw new NotFoundException('Supplier not found');
    return this.attachSupplierEvents(supplier);
  }

  private async attachSupplierEvents(supplier: SupplierProfileBase): Promise<SupplierWithProfile> {
    const [enriched] = await this.attachSupplierEventsToRows([supplier]);
    return enriched;
  }

  private async attachSupplierEventsToRows(suppliers: SupplierProfileBase[]): Promise<SupplierWithProfile[]> {
    const eventIds = [...new Set(suppliers.flatMap((supplier) => [
      ...supplier.reviews.flatMap((review) => review.eventId ? [review.eventId] : []),
      ...supplier.reliabilityNotes.flatMap((note) => note.eventId ? [note.eventId] : []),
    ]))];
    const events = await this.eventReferences.findOperationsEvents(eventIds);
    const eventById = new Map(events.map((event) => [event.id, event]));
    return suppliers.map((supplier) => ({
        ...supplier,
        reviews: supplier.reviews.map((review) => ({ ...review, event: review.eventId ? eventById.get(review.eventId) ?? null : null })),
        reliabilityNotes: supplier.reliabilityNotes.map((note) => {
          const event = note.eventId ? eventById.get(note.eventId) : undefined;
          return { ...note, event: event ? { id: event.id, eventName: event.eventName } : null };
        }),
      }));
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

  mapSupplierCategory(category: CategoryWithDimensions) {
    return {
      id: category.id,
      slug: category.slug,
      name: category.name,
      sortOrder: category.sortOrder,
      active: category.active,
      acceptableMin: category.acceptableMin ?? null,
      acceptableMax: category.acceptableMax ?? null,
      reviewDimensions: category.reviewDimensions.map((dimension) => ({
        id: dimension.id,
        slug: dimension.slug,
        name: dimension.name,
        sortOrder: dimension.sortOrder,
        active: dimension.active,
      })),
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
      .filter((event): event is OperationsEventReference => Boolean(event))
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
        dimensionRatings: (review.dimensionRatings ?? []).map((dimensionRating) => ({
          dimensionId: dimensionRating.dimensionId,
          dimensionName: dimensionRating.dimension.name,
          rating: dimensionRating.rating,
        })),
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

  private async supplierRows() {
    const suppliers = await this.prisma.opsSupplier.findMany({
      take: 500,
      include: {
        category: true,
        reviews: {
          include: { dimensionRatings: { include: { dimension: true } } },
          orderBy: { createdAt: 'desc' },
        },
        reliabilityNotes: {
          orderBy: { createdAt: 'desc' },
        },
        certifications: { orderBy: { uploadedAt: 'desc' } },
      },
      orderBy: [{ category: { sortOrder: 'asc' } }, { tier: 'asc' }, { name: 'asc' }],
    });
    return this.attachSupplierEventsToRows(suppliers);
  }
}
