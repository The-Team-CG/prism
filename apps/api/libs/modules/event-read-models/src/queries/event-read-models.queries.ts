import { Injectable } from '@nestjs/common';
import type {
  OpsEvent,
  OpsSupplier,
  OpsSupplierCategory,
  OpsSupplierCertification,
  OpsSupplierReliabilityNote,
  OpsSupplierReview,
} from '@prisma/client';
import type { PrismaService } from '@prism/database';
import { AuditCategory } from '@prism/modules/event-core';

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

@Injectable()
export class EventReadModelQueries {
  constructor(private readonly prisma: PrismaService) {}

  // Query budget: one archived-filtered event query with floorplan drafts, no per-row Prisma loop.
  visibleEvents() {
    return this.prisma.opsEvent.findMany({
      where: { archived: false },
      include: { floorPlanDrafts: { orderBy: { updatedAt: 'desc' } } },
      orderBy: { eventDate: 'asc' },
    });
  }

  // Query budget: one selected-event query with floorplan drafts, no per-row Prisma loop.
  eventWithDrafts(eventId: string) {
    return this.prisma.opsEvent.findUnique({
      where: { id: eventId },
      include: { floorPlanDrafts: { orderBy: { updatedAt: 'desc' } } },
    });
  }

  // Query budget: four finance queries for a bounded actor-visible event id set, no per-row Prisma loop.
  billingForEvents(eventIds: string[], includeInternalCosts: boolean) {
    return Promise.all([
      includeInternalCosts
        ? this.prisma.opsBillingSource.findMany({ where: { eventId: { in: eventIds } }, orderBy: { createdAt: 'desc' } })
        : Promise.resolve([]),
      this.prisma.opsBillingStatement.findMany({ where: { eventId: { in: eventIds } }, orderBy: { generatedAt: 'desc' } }),
      this.prisma.opsPaymentMilestone.findMany({ where: { eventId: { in: eventIds } }, orderBy: { createdAt: 'asc' } }),
      this.prisma.opsPaymentRecord.findMany({ where: { eventId: { in: eventIds } }, orderBy: { recordedAt: 'desc' } }),
    ]);
  }

  // Query budget: seven client workspace queries for a bounded visible event id set, no per-row Prisma loop.
  clientWorkspaceForEvents(eventIds: string[]) {
    return Promise.all([
      this.prisma.opsDocument.findMany({ where: { eventId: { in: eventIds } }, orderBy: { uploadedAt: 'desc' } }),
      this.prisma.opsBriefing.findMany({ where: { eventId: { in: eventIds } }, orderBy: { submittedAt: 'desc' } }),
      this.prisma.opsFloorPlanDraft.findMany({ where: { eventId: { in: eventIds } }, orderBy: { updatedAt: 'desc' } }),
      this.prisma.opsBillingStatement.findMany({ where: { eventId: { in: eventIds } }, orderBy: { generatedAt: 'desc' } }),
      this.prisma.opsPaymentMilestone.findMany({ where: { eventId: { in: eventIds } }, orderBy: { createdAt: 'asc' } }),
      this.prisma.opsPaymentRecord.findMany({ where: { eventId: { in: eventIds } }, orderBy: { recordedAt: 'desc' } }),
      this.prisma.opsAuditLog.findMany({
        where: { eventId: { in: eventIds }, category: { not: AuditCategory.Access } },
        orderBy: { createdAt: 'desc' },
        take: 50,
      }),
    ]);
  }

  // Query budget: seven client action-center queries for a bounded visible event id set, no per-row Prisma loop.
  clientActionCenterForEvents(eventIds: string[]) {
    return Promise.all([
      this.prisma.opsBriefing.findMany({ where: { eventId: { in: eventIds } }, orderBy: { submittedAt: 'desc' } }),
      this.prisma.opsDocument.findMany({ where: { eventId: { in: eventIds } }, orderBy: { uploadedAt: 'desc' } }),
      this.prisma.opsFloorPlanDraft.findMany({ where: { eventId: { in: eventIds } }, orderBy: { updatedAt: 'desc' } }),
      this.prisma.opsBillingStatement.findMany({ where: { eventId: { in: eventIds } }, orderBy: { generatedAt: 'desc' } }),
      this.prisma.opsPaymentMilestone.findMany({ where: { eventId: { in: eventIds } }, orderBy: { createdAt: 'asc' } }),
      this.prisma.opsPaymentRecord.findMany({ where: { eventId: { in: eventIds } }, orderBy: { recordedAt: 'desc' } }),
      this.prisma.opsPostEventDocument.findMany({ where: { eventId: { in: eventIds } }, orderBy: { title: 'asc' } }),
    ]);
  }

  // Query budget: two supplier quote queries for one supplier, no per-row Prisma loop.
  supplierWorkspaceForSupplier(supplierId: string) {
    return Promise.all([
      this.prisma.opsSupplierQuoteRequest.findMany({ where: { supplierId }, orderBy: { createdAt: 'desc' } }),
      this.prisma.opsSupplierQuote.findMany({ where: { supplierId }, orderBy: { createdAt: 'desc' } }),
    ]);
  }

  // Query budget: one archived-filtered event query for supplier event ids, no per-row Prisma loop.
  supplierEvents(eventIds: string[]) {
    return eventIds.length
      ? this.prisma.opsEvent.findMany({ where: { id: { in: eventIds }, archived: false } })
      : Promise.resolve([]);
  }

  // Query budget: one bounded supplier quote-request query for one supplier, no per-row Prisma loop.
  supplierReadinessRequests(supplierId: string) {
    return this.prisma.opsSupplierQuoteRequest.findMany({ where: { supplierId }, orderBy: { createdAt: 'desc' } });
  }

  // Query budget: seven bounded PMCM command-inbox queries, no per-row Prisma loop.
  pmcmCommandInbox() {
    return Promise.all([
      this.prisma.opsInquiry.findMany({ take: 500, orderBy: { createdAt: 'desc' } }),
      this.prisma.opsEvent.findMany({
        where: { archived: false },
        include: { floorPlanDrafts: { orderBy: { updatedAt: 'desc' } } },
        orderBy: { eventDate: 'asc' },
      }),
      this.prisma.opsPaymentMilestone.findMany({ take: 500, orderBy: { dueDate: 'asc' } }),
      this.prisma.opsSupplierQuoteRequest.findMany({ take: 500, orderBy: { createdAt: 'desc' } }),
      this.prisma.opsCoordinatorAssignment.findMany({ take: 500, orderBy: { createdAt: 'desc' } }),
      this.prisma.opsFloorPlanDraft.findMany({ take: 500, orderBy: { updatedAt: 'desc' } }),
      this.prisma.opsPostEventDocument.findMany({ take: 500, orderBy: { title: 'asc' } }),
    ]);
  }

  // Query budget: fourteen selected-event relation queries; guest and staffing reads use public reader ports outside this query builder.
  pmcmEventWorkspace(eventId: string) {
    return Promise.all([
      this.prisma.opsDocument.findMany({ where: { eventId }, orderBy: { uploadedAt: 'desc' } }),
      this.prisma.opsBriefing.findMany({ where: { eventId }, orderBy: { submittedAt: 'desc' } }),
      this.prisma.opsSupplierQuoteRequest.findMany({ where: { eventId }, orderBy: { createdAt: 'desc' } }),
      this.prisma.opsSupplierQuote.findMany({ where: { eventId }, orderBy: { createdAt: 'desc' } }),
      this.prisma.opsComplianceCheck.findMany({ where: { eventId }, orderBy: { createdAt: 'desc' } }),
      this.prisma.opsBillingSource.findMany({ where: { eventId }, orderBy: { createdAt: 'desc' } }),
      this.prisma.opsBillingStatement.findMany({ where: { eventId }, orderBy: { generatedAt: 'desc' } }),
      this.prisma.opsPaymentMilestone.findMany({ where: { eventId }, orderBy: { createdAt: 'asc' } }),
      this.prisma.opsPaymentRecord.findMany({ where: { eventId }, orderBy: { recordedAt: 'desc' } }),
      this.prisma.opsPostEventDocument.findMany({ where: { eventId }, orderBy: { title: 'asc' } }),
      this.prisma.opsEventInsight.findMany({ where: { eventId }, orderBy: { generatedAt: 'desc' } }),
      this.prisma.opsFloorPlanDraft.findMany({ where: { eventId }, orderBy: { updatedAt: 'desc' } }),
      this.prisma.opsAuditLog.findMany({ where: { eventId }, orderBy: { createdAt: 'desc' }, take: 100 }),
      this.prisma.opsNotificationLog.findMany({ where: { eventId }, orderBy: { createdAt: 'desc' }, take: 100 }),
    ]);
  }

  // Query budget: eighteen bounded PMCM dashboard queries plus supplier directory/category reads; staffing display cards use a reader port.
  pmcmDashboard() {
    return Promise.all([
      this.prisma.opsUser.findMany({ take: 500, orderBy: { createdAt: 'asc' } }),
      this.prisma.opsInquiry.findMany({ take: 500, orderBy: { createdAt: 'desc' } }),
      this.prisma.opsEvent.findMany({
        include: { floorPlanDrafts: { orderBy: { updatedAt: 'desc' } } },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.opsDocument.findMany({ take: 500, orderBy: { uploadedAt: 'desc' } }),
      this.prisma.opsBriefing.findMany({ take: 500, orderBy: { submittedAt: 'desc' } }),
      this.prisma.opsSupplierQuoteRequest.findMany({ take: 500, orderBy: { createdAt: 'desc' } }),
      this.prisma.opsSupplierQuote.findMany({ take: 500, orderBy: { createdAt: 'desc' } }),
      this.prisma.opsComplianceRule.findMany({ take: 500, orderBy: { createdAt: 'desc' } }),
      this.prisma.opsComplianceCheck.findMany({ take: 500, orderBy: { createdAt: 'desc' } }),
      this.prisma.opsBillingSource.findMany({ take: 500, orderBy: { createdAt: 'desc' } }),
      this.prisma.opsBillingStatement.findMany({ take: 500, orderBy: { generatedAt: 'desc' } }),
      this.prisma.opsPaymentMilestone.findMany({ take: 500, orderBy: { createdAt: 'asc' } }),
      this.prisma.opsPaymentRecord.findMany({ take: 500, orderBy: { recordedAt: 'desc' } }),
      this.prisma.opsPostEventDocument.findMany({ take: 500, orderBy: { title: 'asc' } }),
      this.prisma.opsEventInsight.findMany({ take: 500, orderBy: { generatedAt: 'desc' } }),
      this.prisma.opsFloorPlanDraft.findMany({ take: 500, orderBy: { updatedAt: 'desc' } }),
      this.prisma.opsAuditLog.findMany({ take: 500, orderBy: { createdAt: 'desc' } }),
      this.prisma.opsNotificationLog.findMany({ take: 500, orderBy: { createdAt: 'desc' } }),
      this.supplierCategories(),
      this.activeSuppliers(),
    ]);
  }

  // Query budget: one active coordinator dashboard query, no per-row Prisma loop.
  activeCoordinators() {
    return this.prisma.opsCoordinator.findMany({ where: { active: true }, orderBy: { name: 'asc' } });
  }
  // Query budget: one bounded coordinator assignment dashboard query, no per-row Prisma loop.
  boundedCoordinatorAssignments() {
    return this.prisma.opsCoordinatorAssignment.findMany({ take: 500, orderBy: { createdAt: 'desc' } });
  }

  // Query budget: one active supplier directory query, no per-row Prisma loop.
  activeSuppliers() {
    return this.prisma.opsSupplier
      .findMany({
        take: 500,
        include: {
          category: true,
          reviews: { include: { event: true }, orderBy: { createdAt: 'desc' } },
          reliabilityNotes: { include: { event: true }, orderBy: { createdAt: 'desc' } },
          certifications: { orderBy: { uploadedAt: 'desc' } },
        },
        orderBy: { name: 'asc' },
      })
      .then((suppliers) => suppliers.map((supplier) => this.mapSupplier(supplier)));
  }

  // Query budget: one supplier category query, no per-row Prisma loop.
  supplierCategories() {
    return this.prisma.opsSupplierCategory
      .findMany({ where: { active: true }, orderBy: { sortOrder: 'asc' } })
      .then((categories) => categories.map((category) => this.mapSupplierCategory(category)));
  }

  private mapSupplierCategory(category: OpsSupplierCategory) {
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

  private mapSupplier(supplier: SupplierWithProfile) {
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
}