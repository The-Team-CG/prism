import { BadRequestException, ForbiddenException, UnauthorizedException } from '@nestjs/common';
import { describe, expect, it } from 'vitest';
import { PrismTransactionRunner } from '@prism/kernel/shared-kernel';
import { SampleCompatibilityService } from './sample-compatibility.service';
import { AiGovernanceService } from '@prism/contexts/platform-ops';
import { AuditService, AuditWriterAdapter, PrivacyOperationsService } from '@prism/contexts/platform-ops';
import { AuthAuditAdapter, AuthOperationsService, AuthSecurityService } from '@prism/contexts/identity-access';
import { BillingOperationsService } from '@prism/contexts/commercial';
import {
  ClientOnboardingWorkflowService,
  InquiriesService,
  InquiryWorkflowService,
} from '@prism/contexts/event-lifecycle';
import { CommercialWorkflowService } from '@prism/contexts/commercial';
import { ComplianceWorkflowService } from '@prism/contexts/event-lifecycle';
import { CoordinatorsService, RegistrationPlatformService } from '@prism/contexts/operations';
import { DocumentVaultService, FileRequirementsMatrixService } from '@prism/contexts/event-lifecycle';
import { EventAccessPolicyService } from '@prism/kernel/access-control';
import { EventClosureService } from '@prism/contexts/event-lifecycle';
import { EventLifecycleService } from '@prism/kernel/event-core';
import { EventReadModelQueries, EventReadModelsService } from '@prism/contexts/read-models';
import { FloorPlanWorkflowService } from '@prism/contexts/floorplan';
import { GuestWorkflowService } from '@prism/contexts/operations';
import { LiveOperationsService } from '@prism/contexts/live-ops';
import { NotificationOutboxService, NotificationOutboxWriterAdapter } from '@prism/contexts/platform-ops';
import { PAREService } from '@prism/contexts/platform-ops';
import { SampleStateService } from './sample-state.service';
import { SupplierNetworkWorkflowService, SupplierProfileCommandsService, SuppliersService } from '@prism/contexts/commercial';
import { OpsUserRole, WorkflowCommandService } from '@prism/kernel/event-core';

type InquiryWorkflowHarness = {
  inquiryWorkflowService: InquiryWorkflowService;
  inquiryWorkflowContext: () => Parameters<InquiryWorkflowService['updateInquiryStatus']>[2];
};
type GuestNameFilter = string | { equals: string; mode?: string };

function inquiry(overrides: Record<string, unknown> = {}) {
  const createdAt = new Date('2026-04-29T00:00:00.000Z');
  return {
    id: 'inq_sample',
    clientName: 'Ana Reyes',
    companyName: 'Ayala Corp',
    email: 'ana@ayala.test',
    eventName: 'Ayala Summit',
    eventType: 'Corporate Summit',
    eventDate: new Date('2026-06-18T00:00:00.000Z'),
    clientType: 'Corporate',
    source: 'Website',
    message: 'Planning support',
    status: 'new',
    normalizedEmail: 'ana@ayala.test',
    referralDetails: '',
    loggedByRole: null,
    loggedByName: null,
    duplicateOfInquiryId: null,
    previousDeclinedInquiryId: null,
    previousDeclineReason: null,
    declineReason: null,
    acceptedAt: null,
    pendingAt: null,
    declinedAt: null,
    conformeSentAt: null,
    conformeSignedAt: null,
    portalActivatedAt: null,
    followUpIntervalDays: 3,
    lastConformeReminderAt: null,
    portalInvitationStatus: 'not_sent',
    portalInvitationSentAt: null,
    portalInvitationOpenedAt: null,
    portalInvitationExpiresAt: null,
    createdAt,
    ...overrides,
  };
}

function createPrisma(seedInquiry: any = inquiry()) {
  const seedInquiries = Array.isArray(seedInquiry) ? seedInquiry : [seedInquiry];
  const state = {
    inquiries: seedInquiries as any[],
    get inquiry() {
      return this.inquiries[0];
    },
    set inquiry(value: any) {
      this.inquiries[0] = value;
    },
    users: [
      {
        id: 'usr_client',
        name: 'Ana Reyes',
        email: 'ana@ayala.test',
        password: 'prism-client',
        role: 'client',
        organization: 'Ayala Corp',
        approvalStatus: 'approved',
        failedLoginCount: 0,
        lockoutCount: 0,
        lockedUntil: null,
        permanentLockout: false,
        lastLoginAt: null,
        createdAt: new Date('2026-04-29T00:00:00.000Z'),
      },
    ] as any[],
    events: [] as any[],
    documents: [] as any[],
    briefings: [] as any[],
    floorPlanDrafts: [] as any[],
    billings: [] as any[],
    billingSources: [] as any[],
    milestones: [] as any[],
    paymentRecords: [] as any[],
    complianceRules: [] as any[],
    complianceChecks: [] as any[],
    eventInsights: [] as any[],
    quoteRequests: [] as any[],
    supplierQuotes: [] as any[],
    supplierReviews: [] as any[],
    supplierCertifications: [] as any[],
    coordinators: [
      {
        id: 'coord_marco',
        userId: 'usr_coord',
        name: 'Marco Santos',
        email: 'marco@pmcm.test',
        photoUrl: null,
        roleTags: ['Registration Staff', 'Event Day System Operator', 'General Coordinator'],
        skillsTags: ['Registration', 'Guest Flow', 'Live Ops'],
        active: true,
        createdAt: new Date('2026-01-01T00:00:00.000Z'),
      },
      {
        id: 'coord_ina',
        userId: 'usr_coord_ina',
        name: 'Ina Cruz',
        email: 'ina@pmcm.test',
        photoUrl: null,
        roleTags: ['Floor Director', 'Stage Director'],
        skillsTags: ['Stage', 'Run of Show'],
        active: true,
        createdAt: new Date('2026-01-01T00:00:00.000Z'),
      },
    ] as any[],
    coordinatorAssignments: [] as any[],
    coordinatorReliabilityNotes: [] as any[],
    eventDayTasks: [] as any[],
    urgentIssues: [] as any[],
    eventDayLogs: [] as any[],
    supplierCategories: [
      {
        id: 'supcat_technicals',
        slug: 'technicals',
        name: 'Technicals',
        sortOrder: 1,
        active: true,
        acceptableMin: 120000,
        acceptableMax: 180000,
      },
    ] as any[],
    suppliers: [
      {
        id: 'sup_sonicline',
        categoryId: 'supcat_technicals',
        name: 'SonicLine Technicals',
        contactName: 'Dane Villanueva',
        email: 'dane@sonicline.test',
        phone: '+63 917 555 0103',
        tier: 'tier_1',
        bniMember: false,
        serviceInclusions: 'Audio, lights, LED wall',
        performanceNotes: 'Strong for keynote programs.',
        applicationDate: new Date('2026-01-01T00:00:00.000Z'),
        createdAt: new Date('2026-01-01T00:00:00.000Z'),
        updatedAt: new Date('2026-01-01T00:00:00.000Z'),
      },
      {
        id: 'sup_avbackup',
        categoryId: 'supcat_technicals',
        name: 'AV Backup Crew',
        contactName: 'Nina Bautista',
        email: 'quotes@avbackup.test',
        phone: '+63 917 555 0199',
        tier: 'tier_1',
        bniMember: false,
        serviceInclusions: 'Backup lights and sound',
        performanceNotes: 'Available for overflow work.',
        applicationDate: new Date('2026-01-01T00:00:00.000Z'),
        createdAt: new Date('2026-01-01T00:00:00.000Z'),
        updatedAt: new Date('2026-01-01T00:00:00.000Z'),
      },
    ] as any[],
    postEventDocuments: [] as any[],
    floorPlans: [] as any[],
    auditLogs: [] as any[],
    approvalRequests: [] as any[],
    securityAlerts: [] as any[],
    notifications: [] as any[],
    guestCheckIns: [] as any[],
    guestFeedback: [] as any[],
    privacyRequests: [] as any[],
    aiAuditLogs: [] as any[],
    aiApprovals: [] as any[],
    loginHistory: [] as any[],
  };
  const withInquiryRelation = (event: any) => {
    const relatedInquiry = state.inquiries.find((item) => item.id === event.inquiryId);
    return {
      ...event,
      clientEmail: event.clientEmail ?? relatedInquiry?.email,
      inquiry: relatedInquiry ? { email: relatedInquiry.email } : undefined,
    };
  };
  const prisma = {
    opsUser: {
      findUnique: async ({ where }: { where: { email?: string; id?: string } }) =>
        state.users.find((user) => user.email === where.email || user.id === where.id) ?? null,
      update: async ({ where, data }: { where: { id: string }; data: any }) => {
        const index = state.users.findIndex((user) => user.id === where.id);
        if (index === -1) throw new Error('not found');
        state.users[index] = { ...state.users[index], ...data };
        return state.users[index];
      },
    },
    opsInquiry: {
      findUnique: async ({ where }: { where?: { id?: string } } = {}) =>
        where?.id ? state.inquiries.find((item) => item.id === where.id) ?? null : state.inquiry,
      findMany: async ({ where }: { where?: any } = {}) =>
        state.inquiries.filter((item) => {
          if (where?.status && item.status !== where.status) return false;
          if (where?.normalizedEmail && item.normalizedEmail !== where.normalizedEmail) return false;
          if (where?.conformeSentAt?.not === null && item.conformeSentAt === null) return false;
          if (where?.conformeSignedAt === null && item.conformeSignedAt !== null) return false;
          return true;
        }),
      create: async ({ data }: { data: any }) => {
        const created = { ...data, createdAt: data.createdAt ?? new Date() };
        state.inquiries.unshift(created);
        return created;
      },
      update: async ({ where, data }: { where?: { id?: string }; data: any }) => {
        const id = where?.id ?? state.inquiry.id;
        const index = state.inquiries.findIndex((item) => item.id === id);
        if (index === -1) throw new Error('not found');
        state.inquiries[index] = { ...state.inquiries[index], ...data };
        return state.inquiries[index];
      },
      updateMany: async ({ where, data }: { where?: { email?: string; eventName?: string }; data: any }) => {
        let count = 0;
        state.inquiries = state.inquiries.map((item) => {
          if (where?.email && item.email !== where.email) return item;
          if (where?.eventName && item.eventName !== where.eventName) return item;
          count += 1;
          return { ...item, ...data };
        });
        return { count };
      },
    },
    opsEvent: {
      findFirst: async () => (state.events[0] ? withInquiryRelation(state.events[0]) : null),
      findMany: async ({ where }: { where?: { archived?: boolean; id?: string; clientName?: string } } = {}) =>
        state.events.filter((event) => {
          if (typeof where?.archived === 'boolean' && event.archived !== where.archived) return false;
          if (where?.id && event.id !== where.id) return false;
          if (where?.clientName && event.clientName !== where.clientName) return false;
          return true;
        }).map(withInquiryRelation),
      findUnique: async ({ where }: { where: { id: string } }) =>
        state.events.find((event) => event.id === where.id) ? withInquiryRelation(state.events.find((event) => event.id === where.id)) : null,
      create: async ({ data }: { data: any }) => {
        const event = { ...data, archived: false, floorPlanStatus: 'not_started', createdAt: new Date(), updatedAt: new Date() };
        state.events.push(event);
        return event;
      },
      update: async ({ where, data }: { where?: { id?: string }; data: any }) => {
        const index = where?.id
          ? state.events.findIndex((event) => event.id === where.id)
          : 0;
        if (index === -1) throw new Error('not found');
        state.events[index] = { ...state.events[index], ...data };
        return state.events[index];
      },
    },
    opsBillingStatement: {
      count: async ({ where }: { where?: { eventId?: string } } = {}) =>
        where?.eventId ? state.billings.filter((item) => item.eventId === where.eventId).length : state.billings.length,
      findMany: async ({ where }: { where?: { eventId?: string | { in: string[] } } } = {}) => {
        const eventIdFilter = where?.eventId;
        const eventIds = typeof eventIdFilter === 'object' && eventIdFilter ? eventIdFilter.in : undefined;
        return state.billings.filter((item) => {
          if (typeof eventIdFilter === 'string' && item.eventId !== eventIdFilter) return false;
          if (eventIds && !eventIds.includes(item.eventId)) return false;
          return true;
        });
      },
      create: async ({ data }: { data: any }) => {
        const billing = { ...data, generatedAt: data.generatedAt ?? new Date() };
        state.billings.push(billing);
        return billing;
      },
      findUnique: async ({ where }: { where: { id: string } }) =>
        state.billings.find((item) => item.id === where.id) ?? null,
      update: async ({ where, data }: { where: { id: string }; data: any }) => {
        const index = state.billings.findIndex((item) => item.id === where.id);
        if (index === -1) throw new Error('not found');
        state.billings[index] = { ...state.billings[index], ...data };
        return state.billings[index];
      },
    },
    opsBillingSource: {
      create: async ({ data }: { data: any }) => {
        const source = { ...data, createdAt: data.createdAt ?? new Date(), updatedAt: data.updatedAt ?? new Date() };
        state.billingSources.push(source);
        return source;
      },
      findUnique: async ({ where }: { where: { id: string } }) =>
        state.billingSources.find((item) => item.id === where.id) ?? null,
      findFirst: async ({ where }: { where: { eventId?: string; status?: string } }) =>
        state.billingSources.find((item) => {
          if (where.eventId && item.eventId !== where.eventId) return false;
          if (where.status && item.status !== where.status) return false;
          return true;
        }) ?? null,
      findMany: async ({ where }: { where?: { eventId?: string } } = {}) =>
        state.billingSources.filter((item) => !where?.eventId || item.eventId === where.eventId),
      update: async ({ where, data }: { where: { id: string }; data: any }) => {
        const index = state.billingSources.findIndex((item) => item.id === where.id);
        if (index === -1) throw new Error('not found');
        state.billingSources[index] = { ...state.billingSources[index], ...data, updatedAt: new Date() };
        return state.billingSources[index];
      },
    },
    opsPaymentMilestone: {
      findUnique: async ({ where }: { where: { id: string } }) =>
        state.milestones.find((item) => item.id === where.id) ?? null,
      findMany: async ({ where }: { where?: { eventId?: string | { in: string[] } } } = {}) => {
        const eventIdFilter = where?.eventId;
        const eventIds = typeof eventIdFilter === 'object' && eventIdFilter ? eventIdFilter.in : undefined;
        return state.milestones.filter((item) => {
          if (typeof eventIdFilter === 'string' && item.eventId !== eventIdFilter) return false;
          if (eventIds && !eventIds.includes(item.eventId)) return false;
          return true;
        });
      },
      createMany: async ({ data }: { data: any[] }) => {
        state.milestones.push(...data);
        return { count: data.length };
      },
      update: async ({ where, data }: { where: { id: string }; data: any }) => {
        const index = state.milestones.findIndex((item) => item.id === where.id);
        if (index === -1) throw new Error('not found');
        state.milestones[index] = { ...state.milestones[index], ...data };
        return state.milestones[index];
      },
    },
    opsPaymentRecord: {
      create: async ({ data }: { data: any }) => {
        const record = { ...data, recordedAt: data.recordedAt ?? new Date() };
        state.paymentRecords.push(record);
        return record;
      },
      findMany: async ({ where }: { where?: { milestoneId?: string; eventId?: string | { in: string[] } } } = {}) => {
        const eventIdFilter = where?.eventId;
        const eventIds = typeof eventIdFilter === 'object' && eventIdFilter ? eventIdFilter.in : undefined;
        return state.paymentRecords.filter((item) => {
          if (where?.milestoneId && item.milestoneId !== where.milestoneId) return false;
          if (typeof eventIdFilter === 'string' && item.eventId !== eventIdFilter) return false;
          if (eventIds && !eventIds.includes(item.eventId)) return false;
          return true;
        });
      },
    },
    opsSupplierCategory: {
      findUnique: async ({ where }: { where: { id?: string } }) =>
        state.supplierCategories.find((category) => category.id === where.id) ?? null,
    },
    opsSupplier: {
      findMany: async ({ where, include }: { where?: { categoryId?: string; tier?: string; id?: { in: string[] } }; include?: unknown } = {}) =>
        state.suppliers.filter((supplier) => {
          if (where?.categoryId && supplier.categoryId !== where.categoryId) return false;
          if (where?.tier && supplier.tier !== where.tier) return false;
          if (where?.id?.in && !where.id.in.includes(supplier.id)) return false;
          return true;
        }).map((supplier) => {
          if (!include) return supplier;
          const category = state.supplierCategories.find((item) => item.id === supplier.categoryId);
          return {
            ...supplier,
            category,
            reviews: state.supplierReviews
              .filter((review) => review.supplierId === supplier.id)
              .map((review) => ({ ...review, event: state.events.find((event) => event.id === review.eventId) ?? null })),
            reliabilityNotes: [],
            certifications: state.supplierCertifications.filter((certification) => certification.supplierId === supplier.id),
          };
        }),
      findUnique: async ({ where }: { where: { id: string } }) => {
        const supplier = state.suppliers.find((item) => item.id === where.id);
        if (!supplier) return null;
        const category = state.supplierCategories.find((item) => item.id === supplier.categoryId);
        return {
          ...supplier,
          category,
          reviews: state.supplierReviews
            .filter((review) => review.supplierId === supplier.id)
            .map((review) => ({ ...review, event: state.events.find((event) => event.id === review.eventId) ?? null })),
          reliabilityNotes: [],
          certifications: state.supplierCertifications.filter((certification) => certification.supplierId === supplier.id),
        };
      },
      findFirst: async ({ where }: { where: { categoryId?: string; tier?: string } }) =>
        state.suppliers.find((supplier) => supplier.categoryId === where.categoryId && supplier.tier === where.tier) ?? null,
      create: async ({ data }: { data: any }) => {
        const supplier = {
          ...data,
          applicationDate: data.applicationDate ?? new Date(),
          createdAt: data.createdAt ?? new Date(),
          updatedAt: data.updatedAt ?? new Date(),
        };
        state.suppliers.push(supplier);
        return supplier;
      },
      update: async ({ where, data }: { where: { id: string }; data: any }) => {
        const index = state.suppliers.findIndex((supplier) => supplier.id === where.id);
        if (index === -1) throw new Error('not found');
        state.suppliers[index] = { ...state.suppliers[index], ...data, updatedAt: new Date() };
        return state.suppliers[index];
      },
      updateMany: async ({ where, data }: { where?: { email?: string }; data: any }) => {
        let count = 0;
        state.suppliers = state.suppliers.map((supplier) => {
          if (where?.email && supplier.email !== where.email) return supplier;
          count += 1;
          return { ...supplier, ...data, updatedAt: new Date() };
        });
        return { count };
      },
    },
    opsSupplierReview: {
      findMany: async ({ where }: { where?: { eventId?: string; supplierId?: string } } = {}) =>
        state.supplierReviews.filter((review) => {
          if (where?.eventId && review.eventId !== where.eventId) return false;
          if (where?.supplierId && review.supplierId !== where.supplierId) return false;
          return true;
        }),
      create: async ({ data }: { data: any }) => {
        const review = { ...data, createdAt: data.createdAt ?? new Date() };
        state.supplierReviews.push(review);
        return review;
      },
    },
    opsSupplierCertification: {
      create: async ({ data }: { data: any }) => {
        const certification = { ...data, uploadedAt: data.uploadedAt ?? new Date() };
        state.supplierCertifications.push(certification);
        return certification;
      },
    },
    opsCoordinator: {
      count: async () => state.coordinators.length,
      createMany: async ({ data }: { data: any[] }) => {
        state.coordinators.push(...data.map((item) => ({ ...item, createdAt: item.createdAt ?? new Date() })));
        return { count: data.length };
      },
      findUnique: async ({ where }: { where: { id?: string } }) =>
        state.coordinators.find((coordinator) => coordinator.id === where.id) ?? null,
      findFirst: async ({ where }: { where: { name?: string; email?: string; active?: boolean } }) =>
        state.coordinators.find((coordinator) => {
          if (where.name && coordinator.name !== where.name) return false;
          if (where.email && coordinator.email !== where.email) return false;
          if (typeof where.active === 'boolean' && coordinator.active !== where.active) return false;
          return true;
        }) ?? null,
      findMany: async ({ where }: { where?: { active?: boolean } } = {}) =>
        state.coordinators.filter((coordinator) => typeof where?.active !== 'boolean' || coordinator.active === where.active),
    },
    opsCoordinatorAssignment: {
      deleteMany: async () => {
        const count = state.coordinatorAssignments.length;
        state.coordinatorAssignments = [];
        return { count };
      },
      create: async ({ data }: { data: any }) => {
        const assignment = { ...data, createdAt: data.createdAt ?? new Date() };
        state.coordinatorAssignments.push(assignment);
        return assignment;
      },
      findUnique: async ({ where }: { where: { id?: string } }) =>
        state.coordinatorAssignments.find((assignment) => assignment.id === where.id) ?? null,
      findFirst: async ({ where }: { where?: { id?: string; eventId?: string; coordinatorId?: string; status?: any } } = {}) =>
        state.coordinatorAssignments.find((assignment) => {
          if (where?.id && assignment.id !== where.id) return false;
          if (where?.eventId && assignment.eventId !== where.eventId) return false;
          if (where?.coordinatorId && assignment.coordinatorId !== where.coordinatorId) return false;
          if (where?.status?.not && assignment.status === where.status.not) return false;
          return true;
        }) ?? null,
      findMany: async ({ where }: { where?: { eventId?: string; coordinatorId?: string; coordinatorName?: string } } = {}) =>
        state.coordinatorAssignments.filter((assignment) => {
          if (where?.eventId && assignment.eventId !== where.eventId) return false;
          if (where?.coordinatorId && assignment.coordinatorId !== where.coordinatorId) return false;
          if (where?.coordinatorName && assignment.coordinatorName !== where.coordinatorName) return false;
          return true;
        }),
      update: async ({ where, data }: { where: { id: string }; data: any }) => {
        const index = state.coordinatorAssignments.findIndex((assignment) => assignment.id === where.id);
        if (index === -1) throw new Error('not found');
        state.coordinatorAssignments[index] = { ...state.coordinatorAssignments[index], ...data };
        return state.coordinatorAssignments[index];
      },
    },
    opsCoordinatorReliabilityNote: {
      create: async ({ data }: { data: any }) => {
        const row = { ...data, createdAt: data.createdAt ?? new Date() };
        state.coordinatorReliabilityNotes.push(row);
        return row;
      },
      findMany: async ({ where }: { where?: { eventId?: string; coordinatorId?: string } } = {}) =>
        state.coordinatorReliabilityNotes.filter((item) => {
          if (where?.eventId && item.eventId !== where.eventId) return false;
          if (where?.coordinatorId && item.coordinatorId !== where.coordinatorId) return false;
          return true;
        }),
    },
    opsSupplierQuoteRequest: {
      create: async ({ data }: { data: any }) => {
        const request = { ...data, createdAt: data.createdAt ?? new Date() };
        state.quoteRequests.push(request);
        return request;
      },
      findUnique: async ({ where }: { where: { accessToken?: string; id?: string } }) =>
        state.quoteRequests.find((request) => request.accessToken === where.accessToken || request.id === where.id) ?? null,
      update: async ({ where, data }: { where: { id: string }; data: any }) => {
        const index = state.quoteRequests.findIndex((request) => request.id === where.id);
        if (index === -1) throw new Error('not found');
        state.quoteRequests[index] = { ...state.quoteRequests[index], ...data };
        return state.quoteRequests[index];
      },
      findMany: async ({ where }: { where?: { supplierId?: string; eventId?: string; status?: string } } = {}) =>
        state.quoteRequests.filter((request) => {
          if (where?.supplierId && request.supplierId !== where.supplierId) return false;
          if (where?.eventId && request.eventId !== where.eventId) return false;
          if (where?.status && request.status !== where.status) return false;
          return true;
        }),
      findFirst: async ({ where }: { where?: { eventId?: string; supplierId?: string; assignmentStatus?: string } } = {}) =>
        state.quoteRequests.find((request) => {
          if (where?.eventId && request.eventId !== where.eventId) return false;
          if (where?.supplierId && request.supplierId !== where.supplierId) return false;
          if (where?.assignmentStatus && request.assignmentStatus !== where.assignmentStatus) return false;
          return true;
        }) ?? null,
      updateMany: async ({ where, data }: { where?: { eventId?: string; categoryId?: string; id?: { not?: string } }; data: any }) => {
        let count = 0;
        state.quoteRequests = state.quoteRequests.map((request) => {
          if (where?.eventId && request.eventId !== where.eventId) return request;
          if (where?.categoryId && request.categoryId !== where.categoryId) return request;
          if (where?.id?.not && request.id === where.id.not) return request;
          count += 1;
          return { ...request, ...data };
        });
        return { count };
      },
    },
    opsSupplierQuote: {
      create: async ({ data }: { data: any }) => {
        const quote = { ...data, createdAt: data.createdAt ?? new Date() };
        state.supplierQuotes.push(quote);
        return quote;
      },
      findUnique: async ({ where }: { where: { id?: string } }) =>
        state.supplierQuotes.find((quote) => quote.id === where.id) ?? null,
      findFirst: async ({ where }: { where?: { requestId?: string; supplierId?: string } } = {}) =>
        state.supplierQuotes.find((quote) => {
          if (where?.requestId && quote.requestId !== where.requestId) return false;
          if (where?.supplierId && quote.supplierId !== where.supplierId) return false;
          return true;
        }) ?? null,
      findMany: async ({ where }: { where?: { supplierId?: string; eventId?: string } } = {}) =>
        state.supplierQuotes.filter((quote) => {
          if (where?.supplierId && quote.supplierId !== where.supplierId) return false;
          if (where?.eventId && quote.eventId !== where.eventId) return false;
          return true;
        }),
      update: async ({ where, data }: { where: { id: string }; data: any }) => {
        const index = state.supplierQuotes.findIndex((quote) => quote.id === where.id);
        if (index === -1) throw new Error('not found');
        state.supplierQuotes[index] = { ...state.supplierQuotes[index], ...data };
        return state.supplierQuotes[index];
      },
      updateMany: async ({
        where,
        data,
      }: {
        where?: {
          eventId?: string;
          category?: string;
          id?: string | { not?: string };
          revisionNumber?: { lt?: number };
        };
        data: any;
      }) => {
        let count = 0;
        state.supplierQuotes = state.supplierQuotes.map((quote) => {
          if (where?.eventId && quote.eventId !== where.eventId) return quote;
          if (where?.category && quote.category !== where.category) return quote;
          if (typeof where?.id === 'string' && quote.id !== where.id) return quote;
          if (typeof where?.id === 'object' && where.id?.not && quote.id === where.id.not) return quote;
          // Supports the AC4 compare-and-swap: `revisionNumber: { lt: 2 }`.
          if (typeof where?.revisionNumber?.lt === 'number' && (quote.revisionNumber ?? 0) >= where.revisionNumber.lt) {
            return quote;
          }
          count += 1;
          const { revisionNumber: bump, ...rest } = data as Record<string, any>;
          const next = { ...quote, ...rest };
          if (bump && typeof bump === 'object' && typeof bump.increment === 'number') {
            next.revisionNumber = (quote.revisionNumber ?? 0) + bump.increment;
          } else if (bump !== undefined) {
            next.revisionNumber = bump;
          }
          return next;
        });
        return { count };
      },
      findUniqueOrThrow: async ({ where }: { where: { id?: string } }) => {
        const quote = state.supplierQuotes.find((item) => item.id === where.id);
        if (!quote) throw new Error('not found');
        return quote;
      },
    },
    opsPostEventDocument: {
      createMany: async ({ data }: { data: any[] }) => {
        state.postEventDocuments.push(...data);
        return { count: data.length };
      },
      findMany: async ({ where }: { where?: { eventId?: string; status?: string } } = {}) =>
        state.postEventDocuments.filter((item) => {
          if (where?.eventId && item.eventId !== where.eventId) return false;
          if (where?.status && item.status !== where.status) return false;
          return true;
        }),
      update: async ({ where, data }: { where: { id: string }; data: any }) => {
        const index = state.postEventDocuments.findIndex((item) => item.id === where.id);
        if (index === -1) throw new Error('not found');
        state.postEventDocuments[index] = { ...state.postEventDocuments[index], ...data };
        return state.postEventDocuments[index];
      },
    },
    opsDocument: {
      findMany: async ({ where }: { where?: { eventId?: string | { in: string[] } } } = {}) => {
        const eventIdFilter = where?.eventId;
        const eventIds = typeof eventIdFilter === 'object' && eventIdFilter ? eventIdFilter.in : undefined;
        return state.documents.filter((item) => {
          if (typeof eventIdFilter === 'string' && item.eventId !== eventIdFilter) return false;
          if (eventIds && !eventIds.includes(item.eventId)) return false;
          return true;
        });
      },
      create: async ({ data }: { data: any }) => {
        const document = { ...data, uploadedAt: new Date() };
        state.documents.push(document);
        return document;
      },
    },
    opsBriefing: {
      findMany: async ({ where }: { where?: { eventId?: string | { in: string[] } } } = {}) => {
        const eventIdFilter = where?.eventId;
        const eventIds = typeof eventIdFilter === 'object' && eventIdFilter ? eventIdFilter.in : undefined;
        return state.briefings.filter((item) => {
          if (typeof eventIdFilter === 'string' && item.eventId !== eventIdFilter) return false;
          if (eventIds && !eventIds.includes(item.eventId)) return false;
          return true;
        });
      },
    },
    opsFloorPlanDraft: {
      findMany: async ({ where }: { where?: { eventId?: string | { in: string[] } } } = {}) => {
        const eventIdFilter = where?.eventId;
        const eventIds = typeof eventIdFilter === 'object' && eventIdFilter ? eventIdFilter.in : undefined;
        return state.floorPlanDrafts.filter((item) => {
          if (typeof eventIdFilter === 'string' && item.eventId !== eventIdFilter) return false;
          if (eventIds && !eventIds.includes(item.eventId)) return false;
          return true;
        });
      },
      findFirst: async ({ where }: { where: { id?: string; eventId?: string } }) =>
        state.floorPlanDrafts.find((draft) => {
          if (where.id && draft.id !== where.id) return false;
          if (where.eventId && draft.eventId !== where.eventId) return false;
          return true;
        }) ?? null,
      create: async ({ data }: { data: any }) => {
        const draft = { ...data, createdAt: data.createdAt ?? new Date(), updatedAt: data.updatedAt ?? new Date() };
        state.floorPlanDrafts.push(draft);
        return draft;
      },
      update: async ({ where, data }: { where: { id: string }; data: any }) => {
        const index = state.floorPlanDrafts.findIndex((draft) => draft.id === where.id);
        if (index === -1) throw new Error('not found');
        state.floorPlanDrafts[index] = { ...state.floorPlanDrafts[index], ...data, updatedAt: data.updatedAt ?? new Date() };
        return state.floorPlanDrafts[index];
      },
      updateMany: async ({ where, data }: { where?: { eventId?: string; isActive?: boolean }; data: any }) => {
        let count = 0;
        state.floorPlanDrafts = state.floorPlanDrafts.map((draft) => {
          if (where?.eventId && draft.eventId !== where.eventId) return draft;
          if (typeof where?.isActive === 'boolean' && draft.isActive !== where.isActive) return draft;
          count += 1;
          return { ...draft, ...data };
        });
        return { count };
      },
    },
    floorPlan: {
      create: async ({ data }: { data: any }) => {
        const plan = { ...data, updatedAt: data.updatedAt ?? new Date() };
        state.floorPlans.push(plan);
        return plan;
      },
      findUnique: async ({ where }: { where: { id: string } }) =>
        state.floorPlans.find((plan) => plan.id === where.id) ?? null,
    },
    opsAuditLog: {
      findFirst: async () => state.auditLogs[state.auditLogs.length - 1] ?? null,
      findMany: async ({ where }: { where?: { eventId?: string; category?: string; actionType?: string } } = {}) =>
        state.auditLogs.filter((item) => {
          if (where?.eventId && item.eventId !== where.eventId) return false;
          if (where?.category && item.category !== where.category) return false;
          if (where?.actionType && item.actionType !== where.actionType) return false;
          return true;
        }),
      create: async ({ data }: { data: any }) => {
        state.auditLogs.push(data);
        return data;
      },
    },
    opsComplianceRule: {
      findMany: async ({ where }: { where?: { active?: boolean; phase?: string } } = {}) =>
        state.complianceRules.filter((item) => {
          if (typeof where?.active === 'boolean' && item.active !== where.active) return false;
          if (where?.phase && item.phase !== where.phase) return false;
          return true;
        }),
      create: async ({ data }: { data: any }) => {
        const rule = { ...data, active: data.active ?? true, createdAt: data.createdAt ?? new Date(), updatedAt: data.updatedAt ?? new Date() };
        state.complianceRules.push(rule);
        return rule;
      },
      update: async ({ where, data }: { where: { id: string }; data: any }) => {
        const index = state.complianceRules.findIndex((item) => item.id === where.id);
        if (index === -1) throw new Error('not found');
        state.complianceRules[index] = { ...state.complianceRules[index], ...data, updatedAt: new Date() };
        return state.complianceRules[index];
      },
    },
    opsComplianceCheck: {
      deleteMany: async ({ where }: { where?: { eventId?: string } } = {}) => {
        const before = state.complianceChecks.length;
        state.complianceChecks = state.complianceChecks.filter((item) => where?.eventId && item.eventId !== where.eventId);
        return { count: before - state.complianceChecks.length };
      },
      createMany: async ({ data }: { data: any[] }) => {
        state.complianceChecks.push(...data.map((item) => ({ ...item, createdAt: item.createdAt ?? new Date() })));
        return { count: data.length };
      },
      findMany: async ({ where }: { where?: { eventId?: string; status?: string } } = {}) =>
        state.complianceChecks.filter((item) => {
          if (where?.eventId && item.eventId !== where.eventId) return false;
          if (where?.status && item.status !== where.status) return false;
          return true;
        }),
      update: async ({ where, data }: { where: { id: string }; data: any }) => {
        const index = state.complianceChecks.findIndex((item) => item.id === where.id);
        if (index === -1) throw new Error('not found');
        state.complianceChecks[index] = { ...state.complianceChecks[index], ...data };
        return state.complianceChecks[index];
      },
    },
    opsEventInsight: {
      findFirst: async ({ where }: { where: { eventId?: string } }) =>
        state.eventInsights.find((item) => !where.eventId || item.eventId === where.eventId) ?? null,
      findMany: async ({ where }: { where?: { eventId?: string } } = {}) =>
        state.eventInsights.filter((item) => !where?.eventId || item.eventId === where.eventId),
      upsert: async ({ where, create, update }: { where: { eventId: string }; create: any; update: any }) => {
        const index = state.eventInsights.findIndex((item) => item.eventId === where.eventId);
        if (index === -1) {
          const insight = { ...create, generatedAt: create.generatedAt ?? new Date(), updatedAt: create.updatedAt ?? new Date() };
          state.eventInsights.push(insight);
          return insight;
        }
        state.eventInsights[index] = { ...state.eventInsights[index], ...update, updatedAt: new Date() };
        return state.eventInsights[index];
      },
    },
    opsLoginHistory: {
      create: async ({ data }: { data: any }) => {
        state.loginHistory.push(data);
        return data;
      },
      count: async ({ where }: { where?: { email?: string; status?: string } } = {}) =>
        state.loginHistory.filter((entry) => {
          if (where?.email && entry.email !== where.email) return false;
          if (where?.status && entry.status !== where.status) return false;
          return true;
        }).length,
    },
    opsApprovalRequest: {
      findUnique: async ({ where }: { where: { id: string } }) =>
        state.approvalRequests.find((request) => request.id === where.id) ?? null,
      findMany: async () => state.approvalRequests,
      upsert: async ({ where, create, update }: { where: { id: string }; create: any; update: any }) => {
        const index = state.approvalRequests.findIndex((request) => request.id === where.id);
        if (index === -1) {
          const row = { ...create, requestedAt: create.requestedAt ?? new Date() };
          state.approvalRequests.push(row);
          return row;
        }
        state.approvalRequests[index] = { ...state.approvalRequests[index], ...update };
        return state.approvalRequests[index];
      },
      update: async ({ where, data }: { where: { id: string }; data: any }) => {
        const index = state.approvalRequests.findIndex((request) => request.id === where.id);
        if (index === -1) throw new Error('not found');
        state.approvalRequests[index] = { ...state.approvalRequests[index], ...data };
        return state.approvalRequests[index];
      },
      updateMany: async ({ where, data }: { where?: { email?: string }; data: any }) => {
        let count = 0;
        state.approvalRequests = state.approvalRequests.map((request) => {
          if (where?.email && request.email !== where.email) return request;
          count += 1;
          return { ...request, ...data };
        });
        return { count };
      },
    },
    opsSecurityAlert: {
      findMany: async () => state.securityAlerts,
      create: async ({ data }: { data: any }) => {
        const row = { ...data, createdAt: data.createdAt ?? new Date() };
        state.securityAlerts.push(row);
        return row;
      },
    },
    opsNotificationLog: {
      findUnique: async ({ where }: { where: { id: string } }) =>
        state.notifications.find((item) => item.id === where.id) ?? null,
      findMany: async ({ where }: { where?: { eventId?: string; status?: string } } = {}) =>
        state.notifications.filter((item) => {
          if (where?.eventId && item.eventId !== where.eventId) return false;
          if (where?.status && item.status !== where.status) return false;
          return true;
        }),
      create: async ({ data }: { data: any }) => {
        const row = { ...data, createdAt: data.createdAt ?? new Date() };
        state.notifications.push(row);
        return row;
      },
      createMany: async ({ data }: { data: any[] }) => {
        state.notifications.push(...data.map((item) => ({ ...item, createdAt: item.createdAt ?? new Date() })));
        return { count: data.length };
      },
      update: async ({ where, data }: { where: { id: string }; data: any }) => {
        const index = state.notifications.findIndex((item) => item.id === where.id);
        if (index === -1) throw new Error('not found');
        state.notifications[index] = { ...state.notifications[index], ...data };
        return state.notifications[index];
      },
    },
    opsGuestCheckIn: {
      create: async ({ data }: { data: any }) => {
        const row = { ...data, checkedInAt: data.checkedInAt ?? new Date() };
        state.guestCheckIns.push(row);
        return row;
      },
      count: async ({ where }: { where?: { eventId?: string } } = {}) =>
        state.guestCheckIns.filter((item) => !where?.eventId || item.eventId === where.eventId).length,
      findMany: async ({ where }: { where?: { eventId?: string } } = {}) =>
        state.guestCheckIns.filter((item) => !where?.eventId || item.eventId === where.eventId),
      updateMany: async ({ where, data }: { where?: { eventId?: string; guestName?: GuestNameFilter }; data: any }) => {
        let count = 0;
        state.guestCheckIns = state.guestCheckIns.map((item) => {
          if (where?.eventId && item.eventId !== where.eventId) return item;
          if (where?.guestName && typeof where.guestName === 'string' && item.guestName !== where.guestName) return item;
          if (where?.guestName && typeof where.guestName === 'object' && item.guestName.toLowerCase() !== where.guestName.equals.toLowerCase()) return item;
          count += 1;
          return { ...item, ...data };
        });
        return { count };
      },
    },
    opsGuestFeedback: {
      create: async ({ data }: { data: any }) => {
        const row = { ...data, submittedAt: data.submittedAt ?? new Date() };
        state.guestFeedback.push(row);
        return row;
      },
      findMany: async ({ where }: { where?: { eventId?: string } } = {}) =>
        state.guestFeedback.filter((item) => !where?.eventId || item.eventId === where.eventId),
      updateMany: async ({ where, data }: { where?: { eventId?: string; guestName?: GuestNameFilter }; data: any }) => {
        let count = 0;
        state.guestFeedback = state.guestFeedback.map((item) => {
          if (where?.eventId && item.eventId !== where.eventId) return item;
          if (where?.guestName && typeof where.guestName === 'string' && item.guestName !== where.guestName) return item;
          if (where?.guestName && typeof where.guestName === 'object' && item.guestName.toLowerCase() !== where.guestName.equals.toLowerCase()) return item;
          count += 1;
          return { ...item, ...data };
        });
        return { count };
      },
    },
    opsPrivacyRequest: {
      create: async ({ data }: { data: any }) => {
        const row = { ...data, createdAt: data.createdAt ?? new Date(), updatedAt: data.updatedAt ?? new Date() };
        state.privacyRequests.push(row);
        return row;
      },
      findMany: async ({ where }: { where?: { eventId?: string; status?: string } } = {}) =>
        state.privacyRequests.filter((item) => {
          if (where?.eventId && item.eventId !== where.eventId) return false;
          if (where?.status && item.status !== where.status) return false;
          return true;
        }),
      findUnique: async ({ where }: { where: { id: string } }) =>
        state.privacyRequests.find((item) => item.id === where.id) ?? null,
      findUniqueOrThrow: async ({ where }: { where: { id: string } }) => {
        const request = state.privacyRequests.find((item) => item.id === where.id);
        if (!request) throw new Error('not found');
        return request;
      },
      update: async ({ where, data }: { where: { id: string }; data: any }) => {
        const index = state.privacyRequests.findIndex((item) => item.id === where.id);
        if (index === -1) throw new Error('not found');
        state.privacyRequests[index] = { ...state.privacyRequests[index], ...data, updatedAt: new Date() };
        return state.privacyRequests[index];
      },
      updateMany: async ({ where, data }: { where?: { id?: string; status?: string }; data: any }) => {
        let count = 0;
        state.privacyRequests = state.privacyRequests.map((item) => {
          if (where?.id && item.id !== where.id) return item;
          if (where?.status && item.status !== where.status) return item;
          count += 1;
          return { ...item, ...data, updatedAt: new Date() };
        });
        return { count };
      },
    },
    opsEventDayTask: {
      create: async ({ data }: { data: any }) => {
        const row = { ...data, createdAt: data.createdAt ?? new Date(), updatedAt: data.updatedAt ?? new Date() };
        state.eventDayTasks.push(row);
        return row;
      },
      findUnique: async ({ where }: { where: { id: string } }) =>
        state.eventDayTasks.find((item) => item.id === where.id) ?? null,
      findMany: async ({ where }: { where?: { eventId?: string; assignedRole?: string } } = {}) =>
        state.eventDayTasks.filter((item) => {
          if (where?.eventId && item.eventId !== where.eventId) return false;
          if (where?.assignedRole && item.assignedRole !== where.assignedRole) return false;
          return true;
        }),
      update: async ({ where, data }: { where: { id: string }; data: any }) => {
        const index = state.eventDayTasks.findIndex((item) => item.id === where.id);
        if (index === -1) throw new Error('not found');
        state.eventDayTasks[index] = { ...state.eventDayTasks[index], ...data, updatedAt: new Date() };
        return state.eventDayTasks[index];
      },
    },
    opsUrgentIssue: {
      create: async ({ data }: { data: any }) => {
        const row = { ...data, createdAt: data.createdAt ?? new Date(), updatedAt: data.updatedAt ?? new Date() };
        state.urgentIssues.push(row);
        return row;
      },
      findUnique: async ({ where }: { where: { id: string } }) =>
        state.urgentIssues.find((item) => item.id === where.id) ?? null,
      findMany: async ({ where }: { where?: { eventId?: string; status?: string } } = {}) =>
        state.urgentIssues.filter((item) => {
          if (where?.eventId && item.eventId !== where.eventId) return false;
          if (where?.status && item.status !== where.status) return false;
          return true;
        }),
      update: async ({ where, data }: { where: { id: string }; data: any }) => {
        const index = state.urgentIssues.findIndex((item) => item.id === where.id);
        if (index === -1) throw new Error('not found');
        state.urgentIssues[index] = { ...state.urgentIssues[index], ...data, updatedAt: new Date() };
        return state.urgentIssues[index];
      },
    },
    opsEventDayLog: {
      create: async ({ data }: { data: any }) => {
        const row = { ...data, createdAt: data.createdAt ?? new Date() };
        state.eventDayLogs.push(row);
        return row;
      },
      findMany: async ({ where }: { where?: { eventId?: string } } = {}) =>
        state.eventDayLogs.filter((item) => !where?.eventId || item.eventId === where.eventId),
    },
    opsAiAuditLog: {
      create: async ({ data }: { data: any }) => {
        const row = { ...data, createdAt: data.createdAt ?? new Date() };
        state.aiAuditLogs.push(row);
        return row;
      },
      findMany: async () => state.aiAuditLogs,
    },
    opsAiApprovalRecord: {
      create: async ({ data }: { data: any }) => {
        const row = { ...data, requestedAt: data.requestedAt ?? new Date() };
        state.aiApprovals.push(row);
        return row;
      },
      findMany: async () => state.aiApprovals,
    },
    $transaction: async (callback: (tx: unknown) => unknown) => callback(prisma),
    $queryRaw: async () => [],
    $executeRaw: async () => 0,
  };

  return { prisma, state };
}

function createSampleCompatibilityService(prisma: any) {
  const auditService = new AuditService(prisma);
  const notificationOutboxService = new NotificationOutboxService(prisma);
  const auditWriter = new AuditWriterAdapter(auditService);
  const notificationOutboxWriter = new NotificationOutboxWriterAdapter(notificationOutboxService);
  const workflowCommandService = new WorkflowCommandService(new PrismTransactionRunner(prisma));
  const documentVaultService = new DocumentVaultService();
  const eventLifecycleService = new EventLifecycleService();
  const sampleStateService = new SampleStateService(prisma);
  const inquiryWorkflowService = new InquiryWorkflowService(prisma);
  const aiGovernanceService = new AiGovernanceService(prisma);
  const suppliersService = new SuppliersService(prisma);
  const pareService = new PAREService(prisma);
  const eventAccessPolicyService = new EventAccessPolicyService(auditWriter);
  const inquiriesService = new InquiriesService(
    prisma,
    auditWriter,
    notificationOutboxWriter,
    workflowCommandService,
  );
  const authSessionService = { issueSession: (user: any) => ({ ...user, accessToken: 'test-token', expiresAt: new Date(Date.now() + 3600000).toISOString(), signedInAt: new Date().toISOString(), tokenType: 'Bearer' }), issueTwoFactorToken: () => 'test-2fa-token', verifyTwoFactorToken: () => ({ userId: 'usr_pmcm', email: 'mys@pmcm.test', role: 'pmcm-admin', purpose: 'challenge' }) };
  const authAudit = new AuthAuditAdapter(auditService);
  const authOperationsService = new AuthOperationsService(prisma, authAudit, inquiriesService, authSessionService as any, {} as any);
  const privacyOperationsService = new PrivacyOperationsService(prisma, auditService);
  const coordinatorsService = new CoordinatorsService(
    prisma,
    auditWriter,
    notificationOutboxWriter,
    workflowCommandService,
    eventAccessPolicyService,
  );
  const liveOperationsService = new LiveOperationsService(
    prisma,
    auditWriter,
    notificationOutboxWriter,
    workflowCommandService,
  );
  const fileRequirementsMatrixService = new FileRequirementsMatrixService(prisma);
  const floorPlanWorkflowService = new FloorPlanWorkflowService(
    prisma,
    auditWriter,
    notificationOutboxWriter,
    workflowCommandService,
  );
  const billingOperationsService = new BillingOperationsService(
    prisma,
    auditWriter,
    notificationOutboxWriter,
    workflowCommandService,
  );
  const guestWorkflowService = new GuestWorkflowService(
    prisma,
    auditWriter,
    workflowCommandService,
    documentVaultService,
  );
  const guestReader = {
    listCheckInsForEvent: async (eventId: string) =>
      prisma.opsGuestCheckIn.findMany({ where: { eventId }, orderBy: { checkedInAt: 'desc' } }),
    listFeedbackForEvent: async (eventId: string) =>
      prisma.opsGuestFeedback.findMany({ where: { eventId }, orderBy: { submittedAt: 'desc' } }),
    mapGuestCheckIn: (checkIn: any) => guestWorkflowService.mapGuestCheckIn(checkIn),
    mapGuestFeedback: (feedback: any) => guestWorkflowService.mapGuestFeedback(feedback),
  } as any;
  const registrationPlatformService = new RegistrationPlatformService(
    prisma,
    auditWriter,
    workflowCommandService,
  );
  const eventReadModelsService = new EventReadModelsService(
    new EventReadModelQueries(prisma as any),
    eventAccessPolicyService,
    guestReader,
    coordinatorsService,
  );
  const commercialWorkflowService = new CommercialWorkflowService(
    prisma,
    auditWriter,
    notificationOutboxWriter,
    workflowCommandService,
    suppliersService,
  );
  const eventClosureService = new EventClosureService(
    prisma,
    fileRequirementsMatrixService,
    eventLifecycleService,
    auditWriter,
    eventAccessPolicyService,
    notificationOutboxWriter,
    workflowCommandService,
  );
  const complianceWorkflowService = new ComplianceWorkflowService(
    prisma,
    auditWriter,
    eventAccessPolicyService,
    workflowCommandService,
  );
  const clientOnboardingWorkflowService = new ClientOnboardingWorkflowService(
    prisma,
    auditWriter,
    notificationOutboxWriter,
    workflowCommandService,
  );
  const supplierProfileCommandsService = new SupplierProfileCommandsService(
    suppliersService,
    auditWriter,
    eventAccessPolicyService,
    workflowCommandService,
  );
  const supplierNetworkWorkflowService = new SupplierNetworkWorkflowService(
    prisma,
    suppliersService,
    supplierProfileCommandsService,
    auditWriter,
    eventAccessPolicyService,
    workflowCommandService,
    pareService,
    documentVaultService,
  );

  return new SampleCompatibilityService(
    prisma,
    auditService,
    inquiriesService,
    authOperationsService,
    privacyOperationsService,
    suppliersService,
    supplierNetworkWorkflowService,
    coordinatorsService,
    billingOperationsService,
    floorPlanWorkflowService,
    liveOperationsService,
    eventAccessPolicyService,
    eventLifecycleService,
    fileRequirementsMatrixService,
    documentVaultService,
    notificationOutboxService,
    workflowCommandService,
    eventReadModelsService,
    commercialWorkflowService,
    eventClosureService,
    complianceWorkflowService,
    clientOnboardingWorkflowService,
    guestWorkflowService,
    registrationPlatformService,
    aiGovernanceService,
    sampleStateService,
    inquiryWorkflowService,
  );
}
describe('SampleCompatibilityService', () => {
  it('does not block API startup when non-production sample seeding cannot reach the database', async () => {
    const previousNodeEnv = process.env.NODE_ENV;
    const previousReminderFlag = process.env.PRISM_DISABLE_CONFORME_REMINDER_JOB;
    process.env.NODE_ENV = 'development';
    process.env.PRISM_DISABLE_CONFORME_REMINDER_JOB = '1';

    const service = createSampleCompatibilityService({
      opsUser: {
        count: async () => {
          throw new Error('database unavailable');
        },
      },
    } as any);

    try {
      await expect(service.onModuleInit()).resolves.toBeUndefined();
    } finally {
      process.env.NODE_ENV = previousNodeEnv;
      if (previousReminderFlag === undefined) {
        delete process.env.PRISM_DISABLE_CONFORME_REMINDER_JOB;
      } else {
        process.env.PRISM_DISABLE_CONFORME_REMINDER_JOB = previousReminderFlag;
      }
    }
  });

  it('accepts an inquiry and starts the conforme workflow', async () => {
    const fake = createPrisma();
    const service = createSampleCompatibilityService(fake.prisma as any);
    const harness = service as unknown as InquiryWorkflowHarness;
    const context = harness.inquiryWorkflowContext();
    context.resolveActor = () => ({ role: OpsUserRole.PmcmAdmin, name: 'Ms. Mys', explicit: true });

    const accepted = await harness.inquiryWorkflowService.updateInquiryStatus(
      'inq_sample',
      { status: 'accepted' },
      context,
      undefined,
    );

    expect(accepted.status).toBe('accepted');
    expect(accepted.acceptedAt).toBeTruthy();
    expect(accepted.conformeSentAt).toBeTruthy();
    expect(fake.state.notifications).toHaveLength(2);
  });

  it('requires a permanent decline reason', async () => {
    const fake = createPrisma();
    const service = createSampleCompatibilityService(fake.prisma as any);
    const harness = service as unknown as InquiryWorkflowHarness;
    const context = harness.inquiryWorkflowContext();
    context.resolveActor = () => ({ role: OpsUserRole.PmcmAdmin, name: 'Ms. Mys', explicit: true });

    await expect(harness.inquiryWorkflowService.updateInquiryStatus(
      'inq_sample',
      { status: 'declined' },
      context,
      undefined,
    )).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('links duplicate inquiry submissions by normalized email and nearby event date', async () => {
    const fake = createPrisma();
    const service = createSampleCompatibilityService(fake.prisma as any);

    const created = await (service as any).createInquiry({
      clientName: 'Ana Reyes',
      companyName: 'Ayala Corp',
      email: ' ANA@ayala.test ',
      eventName: 'Ayala Summit Follow-up',
      eventType: 'Corporate Summit',
      eventDate: '2026-06-25',
      clientType: 'Corporate',
      source: 'Website',
      referralDetails: 'Referred by Mika from BNI',
      message: 'Second submission for the same planning window',
      privacyConsentAccepted: true,
    });

    expect(created.normalizedEmail).toBe('ana@ayala.test');
    expect(created.referralDetails).toBe('Referred by Mika from BNI');
    expect(created.duplicate).toBe(true);
    expect(created.duplicateOfInquiryId).toBe('inq_sample');
  });

  it('flags previous declined inquiries by normalized email without reopening the old record', async () => {
    const fake = createPrisma([
      inquiry({
        id: 'inq_declined',
        email: 'ana@ayala.test',
        normalizedEmail: 'ana@ayala.test',
        status: 'declined',
        declineReason: 'Date Unavailable',
        declinedAt: new Date('2026-04-20T00:00:00.000Z'),
        eventDate: new Date('2026-05-01T00:00:00.000Z'),
      }),
    ]);
    const service = createSampleCompatibilityService(fake.prisma as any);

    const created = await (service as any).createInquiry({
      clientName: 'Ana Reyes',
      companyName: 'Ayala Corp',
      email: 'ana@ayala.test',
      eventName: 'Ayala Summit Relaunch',
      eventType: 'Corporate Summit',
      eventDate: '2026-08-10',
      clientType: 'Corporate',
      source: 'Website',
      message: 'Trying again on a different date',
      privacyConsentAccepted: true,
    });

    expect(created.previouslyDeclined).toBe(true);
    expect(created.previousDeclinedInquiryId).toBe('inq_declined');
    expect(created.previousDeclineReason).toBe('Date Unavailable');
    expect(fake.state.inquiries.find((item) => item.id === 'inq_declined')?.status).toBe('declined');
  });

  it('rejects public attempts to spoof PMCM log-on-behalf source', async () => {
    const fake = createPrisma();
    const service = createSampleCompatibilityService(fake.prisma as any);

    await expect(
      (service as any).createInquiry({
        clientName: 'Ana Reyes',
        email: 'ana@ayala.test',
        eventName: 'Spoofed Internal Entry',
        eventDate: '2026-06-18',
        clientType: 'Corporate',
        source: 'Log on Behalf',
        message: 'Trying to spoof internal intake',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('allows PMCM actors to log inquiries on behalf of clients with actor metadata', async () => {
    const fake = createPrisma();
    const service = createSampleCompatibilityService(fake.prisma as any);

    const created = await (service as any).logInquiryOnBehalf(
      {
        clientName: 'Walk In Client',
        email: 'walkin@example.test',
        eventName: 'Walk In Product Launch',
        eventDate: '2026-07-10',
        clientType: 'Corporate',
        source: 'BNI Referral',
        referralDetails: 'Walk-in inquiry encoded by PMCM',
        message: 'Client gave details at PMCM office',
      },
      { actorRole: 'pmcm-admin', actorName: 'Ms. Mys', actorEmail: 'mys@pmcm.test' },
    );

    expect(created.source).toBe('BNI Referral');
    expect(created.loggedByRole).toBe('pmcm-admin');
    expect(created.loggedByName).toBe('Ms. Mys');
    expect(created.referralDetails).toBe('Walk-in inquiry encoded by PMCM');
  });

  it('uploads a signed conforme and unlocks event onboarding records', async () => {
    const fake = createPrisma(inquiry({ status: 'accepted', acceptedAt: new Date(), conformeSentAt: new Date() }));
    const service = createSampleCompatibilityService(fake.prisma as any);

    const document = await (service as any).uploadConforme('inq_sample', {
      type: 'signed_conforme',
      fileName: 'signed-conforme.pdf',
    }, { actorRole: OpsUserRole.PmcmAdmin, actorName: 'Ms. Mys' });

    expect(document.status).toBe('approved');
    expect(fake.state.events[0].clientPortalStatus).toBe('unlocked');
    expect(fake.state.inquiry.conformeSignedAt).toBeTruthy();
    expect(fake.state.billings).toHaveLength(0);
    expect(fake.state.milestones).toHaveLength(0);
    expect(fake.state.documents.some((item) => item.type === 'billing_statement')).toBe(false);
  });

  it('enforces PmcmAdmin-only access and records the resolved actor on conforme upload', async () => {
    const fake = createPrisma(inquiry({ status: 'accepted', acceptedAt: new Date(), conformeSentAt: new Date() }));
    const auditService = new AuditService(fake.prisma as any);
    const auditWriter = new AuditWriterAdapter(auditService);
    const notificationOutboxService = new NotificationOutboxService(fake.prisma as any);
    const workflowCommandService = new WorkflowCommandService(new PrismTransactionRunner(fake.prisma as any));
    const eventAccessPolicyService = new EventAccessPolicyService(auditWriter);
    const inquiriesService = new InquiriesService(
      fake.prisma as any,
      auditWriter,
      new NotificationOutboxWriterAdapter(notificationOutboxService),
      workflowCommandService,
    );
    const inquiryWorkflowService = new InquiryWorkflowService(fake.prisma as any);
    const context = {
      inquiriesService,
      resolveActor: (input?: any) => eventAccessPolicyService.resolveActor(input),
      requireActorRole: (actor: any, roles: any, resource: string) =>
        eventAccessPolicyService.requireActorRole(actor, roles, resource),
      allowedAdminRoles: [OpsUserRole.PmcmAdmin, OpsUserRole.System],
      mapInquiry: (record: unknown) => record,
      mapDocument: (record: unknown) => record,
      mapEvent: (record: unknown) => record,
    };

    await expect(
      inquiryWorkflowService.uploadConforme(
        'inq_sample',
        { type: 'signed_conforme', fileName: 'signed-conforme.pdf' },
        { actorRole: 'client' },
        context as any,
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);

    await inquiryWorkflowService.uploadConforme(
      'inq_sample',
      { type: 'signed_conforme', fileName: 'signed-conforme.pdf' },
      { actorRole: 'pmcm-admin', actorName: 'Ms. Mys', actorEmail: 'mys@pmcm.test' },
      context as any,
    );

    const conformeAudit = fake.state.auditLogs.find(
      (entry: any) => entry.action === 'Uploaded signed conforme and unlocked client portal',
    );
    expect(conformeAudit?.actor).toBe('Ms. Mys');
    expect(conformeAudit?.actorEmail).toBe('mys@pmcm.test');
    expect(conformeAudit?.actor).not.toBe('PMCM Admin');
  });

  it('creates confidential quote requests for all selected Tier 1 suppliers with unique supplier tokens', async () => {
    const fake = createPrisma();
    fake.state.events.push({
      id: 'evt_sample',
      inquiryId: 'inq_sample',
      clientName: 'Ana Reyes',
      eventName: 'Ayala Summit',
      eventDate: new Date('2026-06-18T00:00:00.000Z'),
      status: 'planning',
      clientPortalStatus: 'unlocked',
      readiness: 'Supplier quotes pending',
      archived: false,
      floorPlanStatus: 'not_started',
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    const service = createSampleCompatibilityService(fake.prisma as any);

    const requests = await (service as any).requestSupplierQuotes('evt_sample', {
      categoryId: 'supcat_technicals',
      supplierIds: ['sup_sonicline', 'sup_avbackup'],
      confidentialBid: true,
      deadline: '2026-05-05',
    });

    expect(requests).toHaveLength(2);
    expect(new Set(requests.map((request: any) => request.accessToken)).size).toBe(2);
    expect(fake.state.quoteRequests.every((request) => request.confidentialBid === true)).toBe(true);
    expect(fake.state.notifications.filter((item) => item.channel === 'email')).toHaveLength(2);
    expect(fake.state.notifications.filter((item) => item.channel === 'viber')).toHaveLength(2);
  });

  it('does not create duplicate active quote requests for the same event supplier and category', async () => {
    const fake = createPrisma();
    fake.state.events.push({
      id: 'evt_sample',
      inquiryId: 'inq_sample',
      clientName: 'Ana Reyes',
      eventName: 'Ayala Summit',
      eventDate: new Date('2026-06-18T00:00:00.000Z'),
      status: 'planning',
      clientPortalStatus: 'unlocked',
      readiness: 'Supplier quotes pending',
      archived: false,
      floorPlanStatus: 'not_started',
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    fake.state.quoteRequests.push({
      id: 'qr_existing',
      eventId: 'evt_sample',
      supplierId: 'sup_sonicline',
      categoryId: 'supcat_technicals',
      supplierName: 'SonicLine Technicals',
      category: 'Technicals',
      dueDate: new Date('2026-05-05T00:00:00.000Z'),
      accessToken: 'token-existing',
      confidentialBid: false,
      message: 'Existing active request',
      status: 'open',
      createdAt: new Date(),
    });
    const service = createSampleCompatibilityService(fake.prisma as any);

    const requests = await (service as any).requestSupplierQuotes('evt_sample', {
      categoryId: 'supcat_technicals',
      supplierIds: ['sup_sonicline', 'sup_avbackup'],
      confidentialBid: false,
      deadline: '2026-05-05',
    });

    expect(requests).toHaveLength(1);
    expect(requests[0].supplierId).toBe('sup_avbackup');
    expect(fake.state.quoteRequests.filter((request) => request.supplierId === 'sup_sonicline')).toHaveLength(1);
    expect(fake.state.notifications.filter((item) => item.message.includes('token-existing'))).toHaveLength(0);
  });

  it('blocks supplier and guest actors from PMCM commercial proposal decisions', async () => {
    const fake = createPrisma();
    const service = createSampleCompatibilityService(fake.prisma as any);

    await expect(
      (service as any).requestSupplierQuotes(
        'evt_sample',
        { categoryId: 'supcat_technicals', supplierIds: ['sup_sonicline'] },
        { actorRole: 'supplier', actorName: 'SonicLine Technicals' },
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);

    await expect(
      (service as any).addSupplierQuote(
        'evt_sample',
        { supplierName: 'SonicLine Technicals', category: 'Technicals', amount: 150000 },
        { actorRole: 'guest', actorName: 'Guest User' },
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);

    await expect(
      (service as any).selectSupplierQuote('evt_sample', 'quote_selected', {
        actorRole: 'guest',
        actorName: 'Guest User',
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);

    expect(fake.state.quoteRequests).toHaveLength(0);
    expect(fake.state.supplierQuotes).toHaveLength(0);
    expect(fake.state.auditLogs.filter((log) => log.actionType === 'forbidden_access')).toHaveLength(3);
  });

  it('creates and edits supplier profiles with private review, certification metadata, and tier-change audit', async () => {
    const fake = createPrisma();
    fake.state.events.push({
      id: 'evt_sample',
      inquiryId: 'inq_sample',
      clientName: 'Ana Reyes',
      eventName: 'Ayala Summit',
      eventDate: new Date('2026-06-18T00:00:00.000Z'),
      status: 'closed',
      clientPortalStatus: 'unlocked',
      readiness: 'Supplier quotes pending',
      archived: false,
      floorPlanStatus: 'not_started',
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    fake.state.quoteRequests.push({
      id: 'qr_review', eventId: 'evt_sample', supplierId: 'sup_sonicline',
      status: 'selected', assignmentStatus: 'confirmed',
    });
    const service = createSampleCompatibilityService(fake.prisma as any);
    const actor = { actorRole: 'pmcm-admin', actorName: 'Ms. Mys', actorEmail: 'mys@pmcm.test' };

    const created = await (service as any).createSupplier(
      {
        categoryId: 'supcat_technicals',
        name: 'Rigging Pros',
        contactName: 'Lia Ramos',
        email: 'lia@rigging.test',
        phone: '+63 917 555 0900',
        tier: 'pending_first_event',
        serviceInclusions: 'Rigging inspection, truss safety, ingress crew',
        performanceNotes: 'New application for review.',
      },
      actor,
    );
    const edited = await (service as any).updateSupplier(
      created.id,
      {
        contactName: 'Lia Ramos-Santos',
        serviceInclusions: 'Rigging inspection, truss safety, ingress crew, standby lead',
      },
      actor,
    );
    fake.state.quoteRequests.push({
      id: 'qr_review', eventId: 'evt_sample', supplierId: created.id,
      status: 'selected', assignmentStatus: 'confirmed',
    });
    const reviewed = await (service as any).addSupplierReview(
      created.id,
      { eventId: 'evt_sample', rating: 4, notes: 'Private PMCM review after first walkthrough.', reviewedBy: 'Ms. Mys' },
      actor,
    );
    const certified = await (service as any).addSupplierCertification(
      created.id,
      {
        fileName: 'rigging-safety.pdf',
        documentType: 'Safety certificate',
        issuer: 'Makati LGU',
        expiresAt: '2026-12-31',
        status: 'verified',
        notes: 'Checked by PMCM ops.',
      },
      actor,
    );
    const tiered = await (service as any).changeSupplierTier(
      created.id,
      { tier: 'tier_2', reason: 'Completed first event with minor ingress delay.' },
      actor,
    );

    expect(created.tier).toBe('pending_first_event');
    expect(edited.contactName).toBe('Lia Ramos-Santos');
    expect(reviewed.reviews[0].notes).toBe('Private PMCM review after first walkthrough.');
    expect(certified.certifications[0]).toMatchObject({
      fileName: 'rigging-safety.pdf',
      documentType: 'Safety certificate',
      issuer: 'Makati LGU',
      status: 'verified',
    });
    expect(tiered.tier).toBe('tier_2');
    expect(fake.state.auditLogs.some((log) => log.metadata?.reason === 'Completed first event with minor ingress delay.')).toBe(true);
  });

  it('keeps private PMCM supplier reviews out of supplier-scoped workspace reads', async () => {
    const fake = createPrisma();
    fake.state.supplierReviews.push({
      id: 'review_private',
      supplierId: 'sup_sonicline',
      eventId: null,
      rating: 3,
      notes: 'Private PMCM note about late setup.',
      reviewedBy: 'Ms. Mys',
      createdAt: new Date('2026-05-01T00:00:00.000Z'),
    });
    fake.state.supplierQuotes.push({
      id: 'quote_private_range',
      eventId: 'evt_sample',
      requestId: 'qr_private_range',
      supplierId: 'sup_sonicline',
      categoryId: 'supcat_technicals',
      supplierName: 'SonicLine Technicals',
      category: 'Technicals',
      amount: 250000,
      inclusions: ['Audio', 'LED wall'],
      paymentTerms: '50/50',
      notes: 'Supplier-visible notes only.',
      acceptableMin: 120000,
      acceptableMax: 180000,
      outsideAcceptableRange: true,
      status: 'received',
      selectedAt: null,
      createdAt: new Date('2026-05-01T00:00:00.000Z'),
    });
    const service = createSampleCompatibilityService(fake.prisma as any);

    const workspace = await (service as any).listSupplierWorkspace({
      actorRole: 'supplier',
      actorEmail: 'dane@sonicline.test',
      actorName: 'SonicLine Technicals',
    });

    expect(workspace.supplier.id).toBe('sup_sonicline');
    expect(workspace.supplier.reviews).toBeUndefined();
    expect(JSON.stringify(workspace)).not.toContain('Private PMCM note about late setup.');
    expect(JSON.stringify(workspace)).not.toContain('acceptableMin');
    expect(JSON.stringify(workspace)).not.toContain('acceptableMax');
    expect(JSON.stringify(workspace)).not.toContain('outsideAcceptableRange');
  });

  it('stores submitted supplier quotes and flags prices outside the category acceptable range', async () => {
    const fake = createPrisma();
    fake.state.events.push({
      id: 'evt_sample',
      inquiryId: 'inq_sample',
      clientName: 'Ana Reyes',
      eventName: 'Ayala Summit',
      eventDate: new Date('2026-06-18T00:00:00.000Z'),
      status: 'planning',
      clientPortalStatus: 'unlocked',
      readiness: 'Supplier quotes pending',
      archived: false,
      floorPlanStatus: 'not_started',
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    fake.state.quoteRequests.push({
      id: 'qr_sample',
      eventId: 'evt_sample',
      categoryId: 'supcat_technicals',
      supplierId: 'sup_sonicline',
      supplierName: 'SonicLine Technicals',
      category: 'Technicals',
      accessToken: 'token-sample',
      confidentialBid: true,
      status: 'open',
      createdAt: new Date(),
    });
    const service = createSampleCompatibilityService(fake.prisma as any);

    const quote = await (service as any).submitSupplierQuoteByToken('token-sample', {
      amount: 210000,
      inclusions: ['Audio system', 'LED wall'],
      paymentTerms: '50% reservation, 50% before ingress',
      notes: 'Extended LED wall package',
    });

    expect(quote.outsideAcceptableRange).toBeUndefined();
    expect(quote.inclusions).toEqual(['Audio system', 'LED wall']);
    expect(fake.state.supplierQuotes[0].outsideAcceptableRange).toBe(true);
    expect(fake.state.quoteRequests[0].status).toBe('submitted');
  });

  it('reads confidential quote requests by token without exposing client or event details', async () => {
    const fake = createPrisma();
    fake.state.events.push({
      id: 'evt_sample',
      inquiryId: 'inq_sample',
      clientName: 'Ana Reyes',
      eventName: 'Ayala Summit',
      eventDate: new Date('2026-06-18T00:00:00.000Z'),
      status: 'planning',
      clientPortalStatus: 'unlocked',
      readiness: 'Supplier quotes pending',
      archived: false,
      floorPlanStatus: 'not_started',
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    fake.state.quoteRequests.push({
      id: 'qr_sample',
      eventId: 'evt_sample',
      categoryId: 'supcat_technicals',
      supplierId: 'sup_sonicline',
      supplierName: 'SonicLine Technicals',
      category: 'Technicals',
      accessToken: 'token-sample',
      confidentialBid: true,
      status: 'open',
      dueDate: new Date('2026-05-05T00:00:00.000Z'),
      createdAt: new Date(),
    });
    const service = createSampleCompatibilityService(fake.prisma as any);

    const request = await (service as any).getQuoteRequestByToken('token-sample');

    expect(request.eventName).toBe('Confidential event');
    expect(request.clientName).toBeNull();
    expect(request.request.accessToken).toBe('token-sample');
  });

  it('allows supplier quote revision before selection and blocks revision after selection', async () => {
    const fake = createPrisma();
    fake.state.events.push({
      id: 'evt_sample',
      inquiryId: 'inq_sample',
      clientName: 'Ana Reyes',
      eventName: 'Ayala Summit',
      eventDate: new Date('2026-06-18T00:00:00.000Z'),
      status: 'planning',
      clientPortalStatus: 'unlocked',
      readiness: 'Supplier quotes pending',
      archived: false,
      floorPlanStatus: 'not_started',
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    fake.state.quoteRequests.push({
      id: 'qr_sample',
      eventId: 'evt_sample',
      categoryId: 'supcat_technicals',
      supplierId: 'sup_sonicline',
      supplierName: 'SonicLine Technicals',
      category: 'Technicals',
      accessToken: 'token-sample',
      confidentialBid: false,
      status: 'submitted',
      createdAt: new Date(),
    });
    fake.state.supplierQuotes.push({
      id: 'quote_sample',
      eventId: 'evt_sample',
      requestId: 'qr_sample',
      supplierId: 'sup_sonicline',
      categoryId: 'supcat_technicals',
      supplierName: 'SonicLine Technicals',
      category: 'Technicals',
      amount: 150000,
      inclusions: ['Audio'],
      paymentTerms: '50/50',
      notes: 'Initial',
      acceptableMin: 120000,
      acceptableMax: 180000,
      outsideAcceptableRange: false,
      status: 'received',
      selectedAt: null,
      createdAt: new Date(),
    });
    const service = createSampleCompatibilityService(fake.prisma as any);

    const revised = await (service as any).reviseSupplierQuoteByToken('token-sample', {
      amount: 160000,
      inclusions: ['Audio', 'LED wall'],
      paymentTerms: '40/60',
      notes: 'Revised package',
    });
    await (service as any).selectSupplierQuote('evt_sample', revised.id);

    expect(revised.status).toBe('revised');
    expect(fake.state.quoteRequests[0].status).toBe('selected');
    await expect((service as any).reviseSupplierQuoteByToken('token-sample', { amount: 155000 })).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('selects one quote, marks competitors not selected, and closes competing requests in the same category', async () => {
    const fake = createPrisma();
    fake.state.events.push({
      id: 'evt_sample',
      inquiryId: 'inq_sample',
      clientName: 'Ana Reyes',
      eventName: 'Ayala Summit',
      eventDate: new Date('2026-06-18T00:00:00.000Z'),
      status: 'planning',
      clientPortalStatus: 'unlocked',
      readiness: 'Supplier quotes pending',
      archived: false,
      floorPlanStatus: 'not_started',
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    fake.state.quoteRequests.push(
      {
        id: 'qr_selected',
        eventId: 'evt_sample',
        categoryId: 'supcat_technicals',
        supplierId: 'sup_sonicline',
        supplierName: 'SonicLine Technicals',
        category: 'Technicals',
        accessToken: 'token-selected',
        confidentialBid: false,
        status: 'submitted',
        createdAt: new Date(),
      },
      {
        id: 'qr_other',
        eventId: 'evt_sample',
        categoryId: 'supcat_technicals',
        supplierId: 'sup_avbackup',
        supplierName: 'AV Backup Crew',
        category: 'Technicals',
        accessToken: 'token-other',
        confidentialBid: false,
        status: 'submitted',
        createdAt: new Date(),
      },
    );
    fake.state.supplierQuotes.push(
      {
        id: 'quote_selected',
        eventId: 'evt_sample',
        requestId: 'qr_selected',
        supplierId: 'sup_sonicline',
        categoryId: 'supcat_technicals',
        supplierName: 'SonicLine Technicals',
        category: 'Technicals',
        amount: 150000,
        inclusions: ['Audio'],
        paymentTerms: '50/50',
        notes: '',
        acceptableMin: 120000,
        acceptableMax: 180000,
        outsideAcceptableRange: false,
        status: 'received',
        selectedAt: null,
        createdAt: new Date(),
      },
      {
        id: 'quote_other',
        eventId: 'evt_sample',
        requestId: 'qr_other',
        supplierId: 'sup_avbackup',
        categoryId: 'supcat_technicals',
        supplierName: 'AV Backup Crew',
        category: 'Technicals',
        amount: 175000,
        inclusions: ['Backup AV'],
        paymentTerms: '50/50',
        notes: '',
        acceptableMin: 120000,
        acceptableMax: 180000,
        outsideAcceptableRange: false,
        status: 'received',
        selectedAt: null,
        createdAt: new Date(),
      },
    );
    const service = createSampleCompatibilityService(fake.prisma as any);

    const selected = await (service as any).selectSupplierQuote('evt_sample', 'quote_selected');

    expect(selected.status).toBe('selected');
    expect(selected.lockedAt).toBeTruthy();
    expect(fake.state.supplierQuotes.find((quote) => quote.id === 'quote_other')?.status).toBe('not_selected');
    expect(fake.state.quoteRequests.find((request) => request.id === 'qr_selected')?.status).toBe('selected');
    expect(fake.state.quoteRequests.find((request) => request.id === 'qr_other')?.status).toBe('closed');
  });

  it('records partial milestone payments and calculates remaining balance', async () => {
    const fake = createPrisma();
    fake.state.events.push({
      id: 'evt_sample',
      inquiryId: 'inq_sample',
      clientName: 'Ana Reyes',
      eventName: 'Ayala Summit',
      eventDate: new Date('2026-06-18T00:00:00.000Z'),
      status: 'planning',
      clientPortalStatus: 'unlocked',
      readiness: 'Payment pending',
      archived: false,
      floorPlanStatus: 'not_started',
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    fake.state.milestones.push({
      id: 'pay_balance',
      eventId: 'evt_sample',
      label: 'Balance',
      amount: 260000,
      dueDate: new Date('2026-06-11T00:00:00.000Z'),
      status: 'pending',
      createdAt: new Date(),
    });
    const service = createSampleCompatibilityService(fake.prisma as any);

    const payment = await (service as any).recordPayment('evt_sample', 'pay_balance', {
      amountReceived: 100000,
      paymentDate: '2026-05-20',
      paymentMethod: 'Bank Transfer',
      referenceNumber: 'BPI-123',
    });

    expect(payment.status).toBe('partially_paid');
    expect(payment.amountPaid).toBe(100000);
    expect(payment.remainingBalance).toBe(160000);
    expect(payment.history).toHaveLength(1);
  });

  it('rejects payment records that would overpay a milestone', async () => {
    const fake = createPrisma();
    fake.state.events.push({
      id: 'evt_sample',
      inquiryId: 'inq_sample',
      clientName: 'Ana Reyes',
      eventName: 'Ayala Summit',
      eventDate: new Date('2026-06-18T00:00:00.000Z'),
      status: 'planning',
      clientPortalStatus: 'unlocked',
      readiness: 'Payment pending',
      archived: false,
      floorPlanStatus: 'not_started',
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    fake.state.milestones.push({
      id: 'pay_balance',
      eventId: 'evt_sample',
      label: 'Balance',
      amount: 260000,
      amountPaid: 200000,
      remainingBalance: 60000,
      dueDate: new Date('2026-06-11T00:00:00.000Z'),
      status: 'partially_paid',
      createdAt: new Date(),
    });
    fake.state.paymentRecords.push({
      id: 'payrec_existing',
      eventId: 'evt_sample',
      milestoneId: 'pay_balance',
      amountReceived: 200000,
      paymentDate: new Date('2026-05-20T00:00:00.000Z'),
      paymentMethod: 'Bank Transfer',
      referenceNumber: 'BPI-123',
      recordedAt: new Date(),
    });
    const service = createSampleCompatibilityService(fake.prisma as any);

    await expect(
      (service as any).recordPayment('evt_sample', 'pay_balance', {
        amountReceived: 70000,
        paymentDate: '2026-05-21',
        paymentMethod: 'GCash',
        referenceNumber: 'GCASH-456',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('persists submitted and approved official floorplan snapshots from the live plan', async () => {
    const fake = createPrisma();
    fake.state.events.push({
      id: 'evt_sample',
      inquiryId: 'inq_sample',
      clientName: 'Ana Reyes',
      eventName: 'Ayala Summit',
      eventDate: new Date('2026-06-18T00:00:00.000Z'),
      status: 'planning',
      clientPortalStatus: 'unlocked',
      readiness: 'Floorplan draft in progress',
      archived: false,
      floorPlanStatus: 'pmcm_draft',
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    fake.state.floorPlans.push({
      id: 'plan_sample',
      name: 'Official Layout',
      ownerId: 'sample-user',
      eventId: 'evt_sample',
      width: 1200,
      height: 800,
      gridSize: 20,
      objects: [{ id: 'stage', kind: 'stage', x: 10, y: 10 }],
      seats: [],
      seatCategories: [],
      updatedAt: new Date('2026-05-01T00:00:00.000Z'),
    });
    fake.state.floorPlanDrafts.push({
      id: 'fpd_sample',
      eventId: 'evt_sample',
      floorPlanId: 'plan_sample',
      name: 'Official Layout',
      status: 'pmcm_draft',
      isActive: false,
      sourceType: 'blank',
      createdByRole: 'pmcm-admin',
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    const service = createSampleCompatibilityService(fake.prisma as any);

    const submitted = await (service as any).submitFloorPlanDraft('evt_sample', 'fpd_sample', {
      actorRole: 'pmcm-admin',
    });
    fake.state.floorPlans[0].objects = [{ id: 'stage', kind: 'stage', x: 20, y: 20 }];
    const approved = await (service as any).approveFloorPlanDraft('evt_sample', 'fpd_sample', {
      actorRole: 'pmcm-admin',
    });
    const submittedSnapshot = await (service as any).getFloorPlanSnapshot('evt_sample', 'fpd_sample', 'submitted', {
      actorRole: 'client',
      clientName: 'Ana Reyes',
    });
    const approvedSnapshot = await (service as any).getFloorPlanSnapshot('evt_sample', 'fpd_sample', 'approved', {
      actorRole: 'client',
      clientName: 'Ana Reyes',
    });

    expect(submitted.submittedSnapshot.objects[0].x).toBe(10);
    expect(approved.approvedSnapshot.objects[0].x).toBe(20);
    expect(submittedSnapshot.objects[0].x).toBe(10);
    expect(approvedSnapshot.objects[0].x).toBe(20);
  });

  it('blocks client actors from creating PMCM official floorplan drafts', async () => {
    const fake = createPrisma();
    fake.state.events.push({
      id: 'evt_sample',
      inquiryId: 'inq_sample',
      clientName: 'Ana Reyes',
      eventName: 'Ayala Summit',
      eventDate: new Date('2026-06-18T00:00:00.000Z'),
      status: 'planning',
      clientPortalStatus: 'unlocked',
      readiness: 'Floorplan pending',
      archived: false,
      floorPlanStatus: 'not_started',
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    const service = createSampleCompatibilityService(fake.prisma as any);

    await expect(
      (service as any).createFloorPlanDraft(
        'evt_sample',
        { name: 'Client official attempt', sourceType: 'blank' },
        { actorRole: 'client', clientName: 'Ana Reyes', actorEmail: 'ana@ayala.test' },
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('sends a reminder only when the configured follow-up interval is due', async () => {
    const fake = createPrisma(
      inquiry({
        status: 'accepted',
        conformeSentAt: new Date('2026-04-01T00:00:00.000Z'),
        followUpIntervalDays: 3,
      }),
    );
    const service = createSampleCompatibilityService(fake.prisma as any);

    await (service as any).runConformeReminderSweep();

    expect(fake.state.inquiry.lastConformeReminderAt).toBeTruthy();
    expect(fake.state.notifications).toHaveLength(2);
    expect(fake.state.auditLogs).toHaveLength(1);
  });

  it('does not send conforme reminders before the follow-up interval is due', async () => {
    const fake = createPrisma(
      inquiry({
        status: 'accepted',
        conformeSentAt: new Date(),
        followUpIntervalDays: 3,
      }),
    );
    const service = createSampleCompatibilityService(fake.prisma as any);

    await (service as any).runConformeReminderSweep();

    expect(fake.state.inquiry.lastConformeReminderAt).toBeNull();
    expect(fake.state.notifications).toHaveLength(0);
  });

  it('marks client portal invitation opened on client login', async () => {
    const fake = createPrisma(
      inquiry({
        status: 'accepted',
        conformeSentAt: new Date('2026-04-29T00:00:00.000Z'),
        conformeSignedAt: new Date('2026-04-29T00:00:00.000Z'),
        portalInvitationStatus: 'sent',
        portalInvitationSentAt: new Date('2026-04-29T00:00:00.000Z'),
        portalInvitationOpenedAt: null,
        portalInvitationExpiresAt: new Date('2026-06-01T00:00:00.000Z'),
      }),
    );
    const service = createSampleCompatibilityService(fake.prisma as any);

    await (service as any).login('ana@ayala.test', 'prism-client');

    expect(fake.state.inquiry.portalInvitationStatus).toBe('opened');
    expect(fake.state.inquiry.portalInvitationOpenedAt).toBeTruthy();
  });

  it('accepts hashed sample passwords and keeps approval and login history behavior', async () => {
    const fake = createPrisma();
    fake.state.users[0].password = AuthSecurityService.hashPassword('prism-client', 'phase8_test_salt');
    const service = createSampleCompatibilityService(fake.prisma as any);

    const session = await (service as any).login('ana@ayala.test', 'prism-client');

    expect(session.email).toBe('ana@ayala.test');
    expect(fake.state.users[0].password).toMatch(/^scrypt\$/);
    expect(fake.state.loginHistory.some((entry) => entry.status === 'success')).toBe(true);
  });

  it('upgrades legacy plain-text sample passwords after a successful login', async () => {
    const fake = createPrisma();
    expect(fake.state.users[0].password).toBe('prism-client');
    const service = createSampleCompatibilityService(fake.prisma as any);

    await (service as any).login('ana@ayala.test', 'prism-client');

    expect(fake.state.users[0].password).toMatch(/^scrypt\$/);
    expect(fake.state.users[0].password).not.toContain('prism-client');
  });

  it('keeps wrong-password lockout counters and pending-account gates intact', async () => {
    const fake = createPrisma();
    const pendingUser = {
      ...fake.state.users[0],
      id: 'usr_pending_supplier',
      name: 'Pending Supplier',
      email: 'pending@vendor.test',
      password: AuthSecurityService.hashPassword('pending-pass', 'phase8_pending_salt'),
      role: 'supplier',
      approvalStatus: 'pending',
    };
    fake.state.users.push(pendingUser);
    const service = createSampleCompatibilityService(fake.prisma as any);

    await expect((service as any).login('ana@ayala.test', 'wrong-password')).rejects.toBeInstanceOf(UnauthorizedException);
    await expect((service as any).login('pending@vendor.test', 'pending-pass')).rejects.toBeInstanceOf(ForbiddenException);

    expect(fake.state.users[0].failedLoginCount).toBe(1);
    expect(fake.state.loginHistory.some((entry) => entry.status === 'failed')).toBe(true);
    expect(fake.state.loginHistory.some((entry) => entry.status === 'blocked')).toBe(true);
  });

  it('surfaces expired unopened portal invitations in inquiry reads', async () => {
    const fake = createPrisma(
      inquiry({
        status: 'accepted',
        portalInvitationStatus: 'sent',
        portalInvitationSentAt: new Date('2026-04-01T00:00:00.000Z'),
        portalInvitationOpenedAt: null,
        portalInvitationExpiresAt: new Date('2026-04-02T00:00:00.000Z'),
      }),
    );
    const service = createSampleCompatibilityService(fake.prisma as any);

    const inquiries = await (service as any).listInquiries({ actorRole: 'pmcm-admin' });

    expect(inquiries[0].portalInvitationStatus).toBe('expired');
  });

  it('allows PMCM actors to read inquiry and supplier operational scopes', async () => {
    const fake = createPrisma();
    const service = createSampleCompatibilityService(fake.prisma as any);
    const actor = { actorRole: 'pmcm-admin', actorEmail: 'mys@pmcm.test', actorName: 'Ms. Mys' };

    const inquiries = await (service as any).listInquiries(actor);
    const suppliers = await (service as any).listSuppliers(actor);

    expect(inquiries).toHaveLength(1);
    expect(inquiries[0].id).toBe('inq_sample');
    expect(suppliers).toHaveLength(2);
  });

  it('scopes client event and billing reads to the actor client name', async () => {
    const fake = createPrisma();
    fake.state.events.push(
      {
        id: 'evt_ana',
        inquiryId: 'inq_sample',
        clientName: 'Ana Reyes',
        eventName: 'Ayala Summit',
        eventDate: new Date('2026-06-18T00:00:00.000Z'),
        status: 'planning',
        clientPortalStatus: 'unlocked',
        readiness: 'Payment pending',
        archived: false,
        floorPlanStatus: 'not_started',
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: 'evt_other',
        inquiryId: 'inq_other',
        clientName: 'Other Client',
        eventName: 'Private Forum',
        eventDate: new Date('2026-06-20T00:00:00.000Z'),
        status: 'planning',
        clientPortalStatus: 'unlocked',
        readiness: 'Payment pending',
        archived: false,
        floorPlanStatus: 'not_started',
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    );
    fake.state.billings.push(
      {
        id: 'bill_ana',
        eventId: 'evt_ana',
        number: 'BS-2026-0001',
        clientName: 'Ana Reyes',
        clientContact: 'ana@ayala.test',
        eventName: 'Ayala Summit',
        eventDate: new Date('2026-06-18T00:00:00.000Z'),
        lineItems: [{ label: 'Approved event package', amount: 520000 }],
        paymentSchedule: [],
        paymentMethods: [],
        totalAmount: 520000,
        documentId: null,
        pdfUrl: null,
        storageKey: null,
        status: 'draft',
        sentAt: null,
        generatedAt: new Date('2026-04-29T00:00:00.000Z'),
      },
      {
        id: 'bill_other',
        eventId: 'evt_other',
        number: 'BS-2026-0002',
        clientName: 'Other Client',
        clientContact: 'other@test.local',
        eventName: 'Private Forum',
        eventDate: new Date('2026-06-20T00:00:00.000Z'),
        lineItems: [{ label: 'Approved event package', amount: 300000 }],
        paymentSchedule: [],
        paymentMethods: [],
        totalAmount: 300000,
        documentId: null,
        pdfUrl: null,
        storageKey: null,
        status: 'draft',
        sentAt: null,
        generatedAt: new Date('2026-04-30T00:00:00.000Z'),
      },
    );
    fake.state.milestones.push(
      {
        id: 'pay_ana',
        eventId: 'evt_ana',
        label: 'Downpayment',
        amount: 260000,
        dueDate: new Date('2026-05-01T00:00:00.000Z'),
        status: 'pending',
        createdAt: new Date(),
      },
      {
        id: 'pay_other',
        eventId: 'evt_other',
        label: 'Downpayment',
        amount: 150000,
        dueDate: new Date('2026-05-02T00:00:00.000Z'),
        status: 'pending',
        createdAt: new Date(),
      },
    );
    const service = createSampleCompatibilityService(fake.prisma as any);
    const actor = { actorRole: 'client', clientName: 'Ana Reyes', actorEmail: 'ana@ayala.test' };

    const events = await (service as any).listEvents(actor as any);
    const billing = await (service as any).listBilling(actor);

    expect(events.map((event: any) => event.id)).toEqual(['evt_ana']);
    expect(billing.billingStatements.map((statement: any) => statement.id)).toEqual(['bill_ana']);
    expect(billing.paymentMilestones.map((payment: any) => payment.id)).toEqual(['pay_ana']);
  });

  it('returns a client workspace without PMCM inquiry metadata or other-client records', async () => {
    const fake = createPrisma();
    fake.state.events.push(
      {
        id: 'evt_ana',
        inquiryId: 'inq_sample',
        clientName: 'Ana Reyes',
        eventName: 'Ayala Summit',
        eventDate: new Date('2026-06-18T00:00:00.000Z'),
        status: 'planning',
        clientPortalStatus: 'unlocked',
        readiness: 'Payment pending',
        archived: false,
        floorPlanStatus: 'not_started',
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: 'evt_other',
        inquiryId: 'inq_other',
        clientName: 'Other Client',
        eventName: 'Private Forum',
        eventDate: new Date('2026-06-20T00:00:00.000Z'),
        status: 'planning',
        clientPortalStatus: 'unlocked',
        readiness: 'Payment pending',
        archived: false,
        floorPlanStatus: 'not_started',
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    );
    fake.state.documents.push(
      { id: 'doc_ana', eventId: 'evt_ana', type: 'signed_conforme', fileName: 'ana.pdf', status: 'approved', uploadedAt: new Date() },
      { id: 'doc_other', eventId: 'evt_other', type: 'signed_conforme', fileName: 'other.pdf', status: 'approved', uploadedAt: new Date() },
    );
    const service = createSampleCompatibilityService(fake.prisma as any);

    const workspace = await (service as any).listClientWorkspace({
      actorRole: 'client',
      clientName: 'Ana Reyes',
      actorEmail: 'ana@ayala.test',
    });

    expect(workspace.inquiries).toEqual([]);
    expect(workspace.events.map((event: any) => event.id)).toEqual(['evt_ana']);
    expect(workspace.documents.map((document: any) => document.id)).toEqual(['doc_ana']);
  });

  it('blocks out-of-scope client reads and records forbidden access', async () => {
    const fake = createPrisma();
    fake.state.events.push({
      id: 'evt_other',
      inquiryId: 'inq_other',
      clientName: 'Other Client',
      eventName: 'Private Forum',
      eventDate: new Date('2026-06-20T00:00:00.000Z'),
      status: 'planning',
      clientPortalStatus: 'unlocked',
      readiness: 'Payment pending',
      archived: false,
      floorPlanStatus: 'not_started',
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    const service = createSampleCompatibilityService(fake.prisma as any);

    await expect(
      (service as any).getEventDetail('evt_other', {
        actorRole: 'client',
        clientName: 'Ana Reyes',
        actorEmail: 'ana@ayala.test',
      } as any),
    ).rejects.toBeInstanceOf(ForbiddenException);

    expect(fake.state.auditLogs.some((log) => log.actionType === 'forbidden_access')).toBe(true);
  });

  it('returns a role-filtered file requirements matrix for readable client events', async () => {
    const fake = createPrisma();
    fake.state.events.push({
      id: 'evt_ana',
      inquiryId: 'inq_sample',
      clientName: 'Ana Reyes',
      eventName: 'Ayala Summit',
      eventDate: new Date('2026-06-18T00:00:00.000Z'),
      status: 'planning',
      clientPortalStatus: 'unlocked',
      readiness: 'Planning in progress',
      archived: false,
      floorPlanStatus: 'approved',
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    fake.state.documents.push({
      id: 'doc_conforme',
      eventId: 'evt_ana',
      type: 'signed_conforme',
      fileName: 'signed-conforme.pdf',
      status: 'approved',
      uploadedAt: new Date(),
    });
    fake.state.supplierReviews.push({
      id: 'rev_private',
      supplierId: 'sup_sonicline',
      eventId: 'evt_ana',
      rating: 5,
      notes: 'Internal private review.',
      reviewedBy: 'PMCM Admin',
      createdAt: new Date(),
    });
    const service = createSampleCompatibilityService(fake.prisma as any);

    const matrix = await (service as any).getFileRequirements('evt_ana', {
      actorRole: 'client',
      clientName: 'Ana Reyes',
      actorEmail: 'ana@ayala.test',
    });

    expect(matrix.eventId).toBe('evt_ana');
    expect(matrix.items.map((item: any) => item.key)).toContain('signed_conforme');
    expect(matrix.items.map((item: any) => item.key)).not.toContain('supplier_reviews');
  });
  it('returns PMCM-only file requirements for PMCM actors', async () => {
    const fake = createPrisma();
    fake.state.events.push({
      id: 'evt_ana',
      inquiryId: 'inq_sample',
      clientName: 'Ana Reyes',
      eventName: 'Ayala Summit',
      eventDate: new Date('2026-06-18T00:00:00.000Z'),
      status: 'planning',
      clientPortalStatus: 'unlocked',
      readiness: 'Planning in progress',
      archived: false,
      floorPlanStatus: 'approved',
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    fake.state.supplierReviews.push({
      id: 'rev_private',
      supplierId: 'sup_sonicline',
      eventId: 'evt_ana',
      rating: 5,
      notes: 'Internal private review.',
      reviewedBy: 'PMCM Admin',
      createdAt: new Date(),
    });
    const service = createSampleCompatibilityService(fake.prisma as any);

    const matrix = await (service as any).getFileRequirements('evt_ana', {
      actorRole: 'pmcm-admin',
      actorName: 'Ms. Mys',
      actorEmail: 'mys@pmcm.test',
    });

    expect(matrix.items).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          key: 'supplier_reviews',
          visibleToRoles: ['pmcm-admin'],
          status: 'complete',
        }),
      ]),
    );
  });

  it('blocks client actors from PMCM-only supplier reads and records the denial', async () => {
    const fake = createPrisma();
    const service = createSampleCompatibilityService(fake.prisma as any);

    await expect(
      (service as any).listSuppliers({
        actorRole: 'client',
        clientName: 'Ana Reyes',
        actorEmail: 'ana@ayala.test',
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);

    expect(fake.state.auditLogs.some((log) => log.actionType === 'forbidden_access')).toBe(true);
  });

  it('generates compliance checks from active matching rules and ignores inactive or unmatched rules', async () => {
    const fake = createPrisma();
    fake.state.events.push({
      id: 'evt_sample',
      inquiryId: 'inq_sample',
      clientName: 'Ana Reyes',
      eventName: 'Ayala Summit',
      eventDate: new Date('2026-06-18T00:00:00.000Z'),
      status: 'planning',
      clientPortalStatus: 'unlocked',
      readiness: 'Planning',
      archived: false,
      floorPlanStatus: 'not_started',
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    fake.state.complianceRules.push(
      {
        id: 'rule_contract',
        eventType: 'Corporate Summit',
        phase: 'planning',
        severity: 'must_fix',
        layer: 'Must-Fix',
        conditionKey: 'supplier_contracts_ready',
        title: 'Supplier contracts ready',
        note: 'Attach final supplier quotation before event lock.',
        active: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: 'rule_all',
        eventType: '',
        phase: 'planning',
        severity: 'watch_out',
        layer: 'Should-Fix',
        conditionKey: 'ingress_timing_ready',
        title: 'Ingress timing ready',
        note: 'Confirm guest arrival window.',
        active: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: 'rule_inactive',
        eventType: '',
        phase: 'planning',
        severity: 'must_fix',
        layer: 'Must-Fix',
        conditionKey: 'inactive_rule',
        title: 'Inactive rule',
        note: 'Should not be emitted.',
        active: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: 'rule_wrong_type',
        eventType: 'Wedding',
        phase: 'planning',
        severity: 'must_fix',
        layer: 'Must-Fix',
        conditionKey: 'wrong_event_type',
        title: 'Wrong type',
        note: 'Should not be emitted.',
        active: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    );
    const service = createSampleCompatibilityService(fake.prisma as any);

    const checks = await (service as any).runCompliance('evt_sample', { phase: 'planning' });

    expect(checks.map((check: any) => check.title)).toEqual(['Supplier contracts ready', 'Ingress timing ready']);
    expect(checks[0]).toMatchObject({
      ruleId: 'rule_contract',
      severity: 'must_fix',
      phase: 'planning',
      conditionKey: 'supplier_contracts_ready',
      status: 'open',
    });
  });

  it('requires an override reason before overriding a compliance check', async () => {
    const fake = createPrisma();
    fake.state.events.push({
      id: 'evt_sample',
      inquiryId: 'inq_sample',
      clientName: 'Ana Reyes',
      eventName: 'Ayala Summit',
      eventDate: new Date('2026-06-18T00:00:00.000Z'),
      status: 'planning',
      clientPortalStatus: 'unlocked',
      readiness: 'Must-Fix item open',
      archived: false,
      floorPlanStatus: 'not_started',
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    fake.state.complianceChecks.push({
      id: 'chk_contract',
      eventId: 'evt_sample',
      ruleId: 'rule_contract',
      layer: 'Must-Fix',
      severity: 'must_fix',
      phase: 'planning',
      conditionKey: 'supplier_contracts_ready',
      title: 'Supplier contracts ready',
      status: 'open',
      note: 'Attach final supplier quotation before event lock.',
      createdAt: new Date(),
    });
    const service = createSampleCompatibilityService(fake.prisma as any);

    await expect(
      (service as any).resolveCompliance('evt_sample', 'chk_contract', { action: 'override' }),
    ).rejects.toBeInstanceOf(BadRequestException);

    const check = await (service as any).resolveCompliance('evt_sample', 'chk_contract', {
      action: 'override',
      overrideReason: 'Venue contract arrives on event morning; PMCM accepted the risk.',
      actorName: 'Ms. Mys',
    });

    expect(check.status).toBe('overridden');
    expect(check.overrideReason).toContain('PMCM accepted the risk');
    expect(fake.state.auditLogs.some((log) => log.actionType === 'resolve' && log.metadata?.overrideReason)).toBe(true);
  });

  it('generates billing statements only from approved CE/proposal billing sources', async () => {
    const fake = createPrisma();
    fake.state.events.push({
      id: 'evt_sample',
      inquiryId: 'inq_sample',
      clientName: 'Ana Reyes',
      eventName: 'Ayala Summit',
      eventDate: new Date('2026-06-18T00:00:00.000Z'),
      status: 'planning',
      clientPortalStatus: 'unlocked',
      readiness: 'Billing source pending',
      archived: false,
      floorPlanStatus: 'not_started',
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    const service = createSampleCompatibilityService(fake.prisma as any);
    const source = await (service as any).createBillingSource('evt_sample', {
      sourceLabel: 'Approved CE v1',
      lineItems: [
        { label: 'Program management', amount: 350000 },
        { label: 'Technical package', amount: 170000 },
      ],
      paymentSchedule: [
        { label: 'Downpayment', percentage: 50 },
        { label: 'Balance', percentage: 50 },
      ],
    }, { actorRole: OpsUserRole.PmcmAdmin, actorName: 'Ms. Mys' });

    await expect((service as any).generateBillingStatement('evt_sample', source.id)).rejects.toBeInstanceOf(BadRequestException);

    await (service as any).approveBillingSource('evt_sample', source.id, {
      approvedBy: 'Ms. Mys',
      approvalNotes: 'Client approved proposal total.',
    }, { actorRole: OpsUserRole.PmcmAdmin, actorName: 'Ms. Mys' });
    const statement = await (service as any).generateBillingStatement('evt_sample', source.id);

    expect(statement.sourceId).toBe(source.id);
    expect(statement.totalAmount).toBe(520000);
    expect(statement.lineItems).toEqual([
      { label: 'Program management', amount: 350000 },
      { label: 'Technical package', amount: 170000 },
    ]);
    expect(fake.state.milestones.map((item) => [item.label, item.amount])).toEqual([
      ['Downpayment', 260000],
      ['Balance', 260000],
    ]);
  });

  it('keeps unsupported logistics blocked and requires an explicit archive override', async () => {
    const fake = createPrisma();
    fake.state.events.push({
      id: 'evt_sample',
      inquiryId: 'inq_sample',
      clientName: 'Ana Reyes',
      eventName: 'Ayala Summit',
      eventDate: new Date('2026-06-18T00:00:00.000Z'),
      status: 'event_day',
      clientPortalStatus: 'unlocked',
      readiness: 'Close pending',
      archived: false,
      floorPlanStatus: 'approved',
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    fake.state.billings.push({
      id: 'bill_sample',
      eventId: 'evt_sample',
      number: 'BS-2026-0001',
      clientName: 'Ana Reyes',
      clientContact: 'ana@ayala.test',
      eventName: 'Ayala Summit',
      eventDate: new Date('2026-06-18T00:00:00.000Z'),
      lineItems: [{ label: 'Approved CE', amount: 520000 }],
      paymentSchedule: [],
      paymentMethods: [],
      totalAmount: 520000,
      pdfUrl: '/documents/billing.pdf',
      storageKey: 'events/evt_sample/billing.pdf',
      status: 'issued',
      generatedAt: new Date(),
    });
    fake.state.milestones.push({ id: 'pay_balance', eventId: 'evt_sample', label: 'Balance', percentage: 50, amount: 260000, amountPaid: 0, remainingBalance: 260000, dueDate: new Date(), status: 'pending', createdAt: new Date() });
    const service = createSampleCompatibilityService(fake.prisma as any);

    const blocked = await (service as any).getCloseGates('evt_sample');
    expect(blocked.ready).toBe(false);
    await expect((service as any).archiveEvent('evt_sample', { actorRole: OpsUserRole.PmcmAdmin })).rejects.toBeInstanceOf(BadRequestException);

    fake.state.documents.push({ id: 'doc_close', eventId: 'evt_sample', type: 'post_event_report', fileName: 'report.pdf', status: 'submitted', uploadedAt: new Date() });
    fake.state.postEventDocuments.push({ id: 'ped_feedback', eventId: 'evt_sample', title: 'Client feedback form', status: 'submitted' });
    fake.state.supplierReviews.push({ id: 'rev_sample', supplierId: 'sup_sonicline', eventId: 'evt_sample', rating: 5, notes: 'Excellent show calling.', reviewedBy: 'PMCM Admin', createdAt: new Date() });
    fake.state.milestones[0] = { ...fake.state.milestones[0], status: 'paid', amountPaid: 260000, remainingBalance: 0 };

    const ready = await (service as any).getCloseGates('evt_sample');
    expect(ready.ready).toBe(false);
    expect(ready.missingKeys).toEqual(['logistics']);
    const archiveCommands = service as unknown as {
      archiveEvent(eventId: string, input: { actorRole: string; overrideReason: string }): Promise<{ archived: boolean }>;
    };
    const archived = await archiveCommands.archiveEvent('evt_sample', { actorRole: OpsUserRole.PmcmAdmin, overrideReason: 'Logistics verified offline; asset return confirmation retained by PMCM.' });
    expect(archived.archived).toBe(true);
  });

  it('denies non-PMCM actors from archiving an event', async () => {
    const fake = createPrisma();
    fake.state.events.push({
      id: 'evt_sample',
      inquiryId: 'inq_sample',
      clientName: 'Ana Reyes',
      eventName: 'Ayala Summit',
      eventDate: new Date('2026-06-18T00:00:00.000Z'),
      status: 'event_day',
      clientPortalStatus: 'unlocked',
      readiness: 'Close pending',
      archived: false,
      floorPlanStatus: 'approved',
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    const service = createSampleCompatibilityService(fake.prisma as any);

    await expect(
      (service as any).archiveEvent('evt_sample', { actorRole: 'client', clientName: 'Ana Reyes' }),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });
  it('allows archive override only with a documented PMCM reason', async () => {
    const fake = createPrisma();
    fake.state.events.push({
      id: 'evt_sample',
      inquiryId: 'inq_sample',
      clientName: 'Ana Reyes',
      eventName: 'Ayala Summit',
      eventDate: new Date('2026-06-18T00:00:00.000Z'),
      status: 'event_day',
      clientPortalStatus: 'unlocked',
      readiness: 'Close pending',
      archived: false,
      floorPlanStatus: 'not_started',
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    const service = createSampleCompatibilityService(fake.prisma as any);

    await expect((service as any).archiveEvent('evt_sample', { overrideReason: '', actorRole: OpsUserRole.PmcmAdmin })).rejects.toBeInstanceOf(BadRequestException);

    const archived = await (service as any).archiveEvent('evt_sample', {
      overrideReason: 'Client feedback will arrive after holiday closure.',
      actorName: 'Ms. Mys', actorRole: OpsUserRole.PmcmAdmin,
    });

    expect(archived.archived).toBe(true);
    expect(fake.state.events[0].archiveOverrideReason).toContain('holiday closure');
    expect(fake.state.auditLogs.some((log) => log.actionType === 'archive' && log.metadata?.overrideReason)).toBe(true);
  });

  it('generates deterministic Event Insights and keeps them PMCM-only', async () => {
    const fake = createPrisma();
    fake.state.events.push({
      id: 'evt_sample',
      inquiryId: 'inq_sample',
      clientName: 'Ana Reyes',
      eventName: 'Ayala Summit',
      eventDate: new Date('2026-06-18T00:00:00.000Z'),
      status: 'closed',
      clientPortalStatus: 'unlocked',
      readiness: 'Closed',
      archived: true,
      floorPlanStatus: 'approved',
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    fake.state.supplierReviews.push({ id: 'rev_sample', supplierId: 'sup_sonicline', eventId: 'evt_sample', rating: 5, notes: 'Excellent show calling.', reviewedBy: 'PMCM Admin', createdAt: new Date() });
    fake.state.complianceChecks.push({ id: 'chk_sample', eventId: 'evt_sample', layer: 'Must-Fix', severity: 'must_fix', phase: 'planning', conditionKey: 'contracts', title: 'Supplier contracts ready', status: 'resolved', note: 'Resolved.', createdAt: new Date() });
    fake.state.billings.push({ id: 'bill_sample', eventId: 'evt_sample', number: 'BS-2026-0001', clientName: 'Ana Reyes', clientContact: 'ana@ayala.test', eventName: 'Ayala Summit', lineItems: [], paymentSchedule: [], paymentMethods: [], totalAmount: 520000, pdfUrl: '', storageKey: '', status: 'sent', generatedAt: new Date() });
    fake.state.documents.push({ id: 'doc_sample', eventId: 'evt_sample', type: 'post_event_report', fileName: 'report.pdf', status: 'submitted', uploadedAt: new Date() });
    const service = createSampleCompatibilityService(fake.prisma as any);

    const insight = await (service as any).generateEventInsights('evt_sample', { actorRole: OpsUserRole.PmcmAdmin, actorName: 'Ms. Mys' });

    expect(insight.summary).toContain('Ayala Summit');
    expect(insight.supplierNotes[0].notes).toContain('Excellent');
    expect(insight.financialSummary.totalBilled).toBe(520000);

    await expect(
      (service as any).listEventInsights('evt_sample', { actorRole: 'client', clientName: 'Ana Reyes' }),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('queues notifications without presenting sample processing as delivery', async () => {
    const fake = createPrisma();
    const service = createSampleCompatibilityService(fake.prisma as never);
    await service['queueNotification']('evt_sample', 'client@example.test', 'Balance due', 'email');
    expect(fake.state.notifications[0]).toMatchObject({ status: 'queued', attempts: 0, failureReason: 'Delivery provider is not configured' });
    await expect(service['acknowledgeNotification'](fake.state.notifications[0].id)).rejects.toThrow(/provider-accepted/);
  });
  it('validates upload metadata and generates safe storage names', async () => {
    const fake = createPrisma();
    const service = createSampleCompatibilityService(fake.prisma as any);

    const accepted = (service as any).validateUploadMetadata({
      fileName: '../../contract final.PDF',
      mimeType: 'application/pdf',
      sizeBytes: 1024,
    }, 'events/evt_sample/documents');

    expect(accepted.generatedFileName).toMatch(/^[a-f0-9-]+\.pdf$/);
    expect(accepted.storageKey).toContain('events/evt_sample/documents/');

    expect(() =>
      (service as any).validateUploadMetadata({
        fileName: 'malware.exe',
        mimeType: 'application/x-msdownload',
        sizeBytes: 1024,
      }, 'events/evt_sample/documents'),
    ).toThrow(BadRequestException);

    expect(() =>
      (service as any).validateUploadMetadata({
        fileName: 'huge.pdf',
        mimeType: 'application/pdf',
        sizeBytes: 50 * 1024 * 1024,
      }, 'events/evt_sample/documents'),
    ).toThrow(BadRequestException);
  });

  it('lets only the scoped supplier confirm assignment, readiness, contract, and event-day status', async () => {
    const fake = createPrisma();
    fake.state.events.push({
      id: 'evt_sample',
      inquiryId: 'inq_sample',
      clientName: 'Ana Reyes',
      eventName: 'Ayala Summit',
      eventDate: new Date('2026-06-18T00:00:00.000Z'),
      status: 'planning',
      clientPortalStatus: 'unlocked',
      readiness: 'Supplier assigned',
      archived: false,
      floorPlanStatus: 'approved',
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    fake.state.quoteRequests.push({
      id: 'qr_sonic',
      eventId: 'evt_sample',
      supplierId: 'sup_sonicline',
      categoryId: 'supcat_technicals',
      supplierName: 'SonicLine Technicals',
      category: 'Technicals',
      message: 'Selected assignment',
      dueDate: new Date('2026-06-01T00:00:00.000Z'),
      accessToken: 'token-sonic',
      confidentialBid: false,
      status: 'selected',
      assignmentStatus: 'pending_confirmation',
      readinessStatus: 'not_requested',
      eventDayStatus: 'not_started',
      createdAt: new Date(),
    });
    const service = createSampleCompatibilityService(fake.prisma as any);

    await expect(
      (service as any).confirmSupplierAssignment('qr_sonic', {
        actorRole: 'supplier',
        actorEmail: 'quotes@avbackup.test',
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);

    const actor = { actorRole: 'supplier', actorEmail: 'dane@sonicline.test', actorName: 'SonicLine Technicals' };
    expect((await (service as any).confirmSupplierAssignment('qr_sonic', actor)).assignmentStatus).toBe('confirmed');
    expect((await (service as any).confirmSupplierReadiness('qr_sonic', { notes: 'Ready for ingress' }, actor)).readinessStatus).toBe('confirmed');
    expect((await (service as any).uploadSupplierContract('qr_sonic', {
      fileName: 'terms.pdf',
      mimeType: 'application/pdf',
      sizeBytes: 2048,
    }, actor)).contractDocumentId).toBeTruthy();
    expect((await (service as any).updateSupplierEventStatus('qr_sonic', {
      status: 'arrived',
      notes: 'At loading bay',
    }, actor)).eventDayStatus).toBe('arrived');
  });

  it('records guest name check-ins, walk-in flags, attendance counts, and moderated feedback', async () => {
    const fake = createPrisma();
    fake.state.events.push({
      id: 'evt_sample',
      inquiryId: 'inq_sample',
      clientName: 'Ana Reyes',
      eventName: 'Ayala Tech Summit',
      eventDate: new Date('2026-06-18T00:00:00.000Z'),
      status: 'event_day',
      clientPortalStatus: 'unlocked',
      readiness: 'Registration open',
      archived: false,
      floorPlanStatus: 'approved',
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    const service = createSampleCompatibilityService(fake.prisma as any);

    const event = await (service as any).getGuestEventByAccessCode('AYALA-TECH-MPLE');
    expect(event.attendanceCount).toBe(0);

    const checkIn = await (service as any).checkInGuestByAccessCode('AYALA-TECH-MPLE', {
      guestName: 'Sofia Lim',
      checkInMode: 'name_search',
      privacyConsentAccepted: true,
    });
    const walkIn = await (service as any).checkInGuestByAccessCode('AYALA-TECH-MPLE', {
      guestName: 'Walk In Guest',
      checkInMode: 'walk_in',
      walkIn: true,
      verificationStatus: 'flagged',
      privacyConsentAccepted: true,
    });
    const feedback = await (service as any).submitGuestFeedbackByAccessCode('AYALA-TECH-MPLE', {
      guestName: 'Sofia Lim',
      rating: 5,
      comment: 'Smooth registration.',
      privacyConsentAccepted: true,
      marketingConsentAccepted: false,
    });

    expect(checkIn.status).toBe('checked_in');
    expect(walkIn.walkIn).toBe(true);
    expect(feedback.moderationStatus).toBe('pending_review');
    expect(feedback.privacyConsentAccepted).toBe(true);
    expect((await (service as any).getGuestEventByAccessCode('AYALA-TECH-MPLE')).attendanceCount).toBe(2);
  });

  it('requires and persists privacy consent on public inquiry, approval, guest check-in, and guest feedback writes', async () => {
    const fake = createPrisma();
    fake.state.events.push({
      id: 'evt_sample',
      inquiryId: 'inq_sample',
      clientName: 'Ana Reyes',
      eventName: 'Ayala Tech Summit',
      eventDate: new Date('2026-06-18T00:00:00.000Z'),
      status: 'event_day',
      clientPortalStatus: 'unlocked',
      readiness: 'Registration open',
      archived: false,
      floorPlanStatus: 'approved',
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    const service = createSampleCompatibilityService(fake.prisma as any);

    await expect((service as any).createInquiry({
      clientName: 'Mia Cruz',
      email: 'mia@example.test',
      eventName: 'Privacy Event',
      eventDate: '2026-07-01',
      clientType: 'Corporate',
      message: 'Planning inquiry',
    })).rejects.toBeInstanceOf(BadRequestException);
    await expect((service as any).requestApproval({ email: 'ana@ayala.test' })).rejects.toBeInstanceOf(BadRequestException);
    await expect((service as any).checkInGuestByAccessCode('AYALA-TECH-MPLE', { guestName: 'Sofia Lim' })).rejects.toBeInstanceOf(BadRequestException);
    await expect((service as any).submitGuestFeedbackByAccessCode('AYALA-TECH-MPLE', { guestName: 'Sofia Lim', rating: 5 })).rejects.toBeInstanceOf(BadRequestException);

    const inquiryRecord = await (service as any).createInquiry({
      clientName: 'Mia Cruz',
      email: 'mia@example.test',
      eventName: 'Privacy Event',
      eventDate: '2026-07-01',
      clientType: 'Corporate',
      message: 'Planning inquiry',
      privacyConsentAccepted: true,
      privacyNoticeVersion: '2026-05-01',
    });
    const approval = await (service as any).requestApproval({
      email: 'ana@ayala.test',
      privacyConsentAccepted: true,
      privacyNoticeVersion: '2026-05-01',
    });
    const checkIn = await (service as any).checkInGuestByAccessCode('AYALA-TECH-MPLE', {
      guestName: 'Sofia Lim',
      privacyConsentAccepted: true,
    });
    const feedback = await (service as any).submitGuestFeedbackByAccessCode('AYALA-TECH-MPLE', {
      guestName: 'Sofia Lim',
      rating: 5,
      privacyConsentAccepted: true,
      marketingConsentAccepted: true,
    });

    expect(inquiryRecord.privacyConsentAccepted).toBe(true);
    expect(approval.privacyConsentAccepted).toBe(true);
    expect(checkIn.privacyConsentAccepted).toBe(true);
    expect(feedback.marketingConsentAccepted).toBe(true);
  });

  it('verifies audit integrity and reports the first tampered row', async () => {
    const fake = createPrisma();
    const service = createSampleCompatibilityService(fake.prisma as any);

    await (service as any).audit('evt_sample', 'PMCM Admin', 'First audit row', { actionType: 'create' });
    await (service as any).audit('evt_sample', 'PMCM Admin', 'Second audit row', { actionType: 'update' });

    const valid = await (service as any).verifyAuditIntegrity({ actorRole: 'pmcm-admin' });
    expect(valid).toMatchObject({ valid: true, checkedCount: 2, firstBrokenLogId: null });

    fake.state.auditLogs[1].action = 'Tampered audit row';
    const tampered = await (service as any).verifyAuditIntegrity({ actorRole: 'pmcm-admin' });

    expect(tampered.valid).toBe(false);
    expect(tampered.firstBrokenLogId).toBe(fake.state.auditLogs[1].id);
    await expect((service as any).verifyAuditIntegrity({ actorRole: 'supplier' })).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('returns a PMCM-only privacy inventory without exposing it to portal actors', async () => {
    const fake = createPrisma();
    fake.state.events.push({
      id: 'evt_sample',
      inquiryId: 'inq_sample',
      clientName: 'Ana Reyes',
      eventName: 'Ayala Tech Summit',
      eventDate: new Date('2026-06-18T00:00:00.000Z'),
      status: 'event_day',
      clientPortalStatus: 'unlocked',
      readiness: 'Registration open',
      archived: false,
      floorPlanStatus: 'approved',
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    fake.state.guestCheckIns.push({
      id: 'gci_1',
      eventId: 'evt_sample',
      guestName: 'Sofia Lim',
      checkInMode: 'name_search',
      status: 'checked_in',
      walkIn: false,
      verificationStatus: 'verified',
      privacyConsentAccepted: true,
      privacyNoticeVersion: '2026-05-01',
      marketingConsentAccepted: false,
      checkedInAt: new Date(),
    });
    fake.state.guestFeedback.push({
      id: 'gfb_1',
      eventId: 'evt_sample',
      guestName: 'Sofia Lim',
      rating: 5,
      comment: 'Great',
      privacyConsentAccepted: true,
      marketingConsentAccepted: false,
      moderationStatus: 'pending_review',
      submittedAt: new Date(),
    });
    const service = createSampleCompatibilityService(fake.prisma as any);

    const inventory = await (service as any).getPrivacyInventory({ eventId: 'evt_sample' }, { actorRole: 'pmcm-admin' });

    expect(inventory.events[0]).toMatchObject({ eventId: 'evt_sample', eventName: 'Ayala Tech Summit' });
    expect(inventory.events[0].surfaces.map((surface: any) => surface.surface)).toEqual(
      expect.arrayContaining(['inquiry', 'guest_check_in', 'guest_feedback']),
    );
    await expect((service as any).getPrivacyInventory({}, { actorRole: 'client', clientName: 'Ana Reyes' })).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('exposes PMCM-only retention policies and privacy request queue', async () => {
    const fake = createPrisma();
    const service = createSampleCompatibilityService(fake.prisma as any);

    const policies = await (service as any).listPrivacyRetentionPolicies({ actorRole: 'pmcm-admin' });
    expect(policies.map((policy: any) => policy.surface)).toEqual(
      expect.arrayContaining(['inquiry', 'approval_request', 'supplier', 'guest_check_in', 'guest_feedback', 'documents', 'audit']),
    );

    const request = await (service as any).createPrivacyRequest({
      subjectType: 'guest',
      subjectEmail: 'sofia@example.test',
      subjectName: 'Sofia Lim',
      eventId: 'evt_sample',
      requestType: 'deletion',
      requestNotes: 'Guest asked to redact check-in and feedback details.',
    }, { actorRole: 'pmcm-admin', actorName: 'Ms. Mys' });
    const requests = await (service as any).listPrivacyRequests({ actorRole: 'pmcm-admin' });

    expect(request).toMatchObject({ status: 'submitted', requestType: 'deletion', createdBy: 'Ms. Mys' });
    expect(requests[0].id).toBe(request.id);
    await expect((service as any).listPrivacyRetentionPolicies({ actorRole: 'supplier' })).rejects.toBeInstanceOf(ForbiddenException);
    await expect((service as any).listPrivacyRequests({ actorRole: 'guest' })).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('reviews and executes approved privacy deletion requests with soft redaction and intact audit chain', async () => {
    const fake = createPrisma();
    fake.state.inquiries[0] = {
      ...fake.state.inquiries[0],
      clientName: 'Sofia Lim',
      email: 'sofia@example.test',
      companyName: 'Sofia Events',
      message: 'Personal event notes',
      referralDetails: 'BNI referral',
      privacyConsentAccepted: true,
    };
    fake.state.approvalRequests.push({
      id: 'approval_sofia',
      userId: 'usr_client',
      name: 'Sofia Lim',
      email: 'sofia@example.test',
      role: 'client',
      organization: 'Sofia Events',
      status: 'pending',
      privacyConsentAccepted: true,
      requestedAt: new Date(),
    });
    fake.state.events.push({
      id: 'evt_sample',
      inquiryId: 'inq_sample',
      clientName: 'Sofia Lim',
      eventName: 'Sofia Launch',
      eventDate: new Date('2026-06-18T00:00:00.000Z'),
      status: 'event_day',
      clientPortalStatus: 'unlocked',
      readiness: 'Registration open',
      archived: false,
      floorPlanStatus: 'approved',
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    fake.state.guestCheckIns.push({
      id: 'gci_sofia',
      eventId: 'evt_sample',
      guestName: 'Sofia Lim',
      checkInMode: 'name_search',
      status: 'checked_in',
      walkIn: false,
      verificationStatus: 'verified',
      privacyConsentAccepted: true,
      checkedInAt: new Date(),
    });
    fake.state.guestFeedback.push({
      id: 'gfb_sofia',
      eventId: 'evt_sample',
      guestName: 'Sofia Lim',
      rating: 4,
      comment: 'Please improve signage.',
      moderationStatus: 'pending_review',
      privacyConsentAccepted: true,
      submittedAt: new Date(),
    });
    const service = createSampleCompatibilityService(fake.prisma as any);

    const request = await (service as any).createPrivacyRequest({
      subjectType: 'guest',
      subjectEmail: 'sofia@example.test',
      subjectName: 'Sofia Lim',
      eventId: 'evt_sample',
      requestType: 'deletion',
      requestNotes: 'Redact personal fields but keep event operations history.',
    }, { actorRole: 'pmcm-admin', actorName: 'Ms. Mys' });

    await expect((service as any).executePrivacyRequest(request.id, {}, { actorRole: 'pmcm-admin' })).rejects.toBeInstanceOf(BadRequestException);

    const approved = await (service as any).reviewPrivacyRequest(request.id, {
      status: 'approved',
      reviewReason: 'Valid deletion request from data subject.',
    }, { actorRole: 'pmcm-admin', actorName: 'Ms. Mys' });
    const executed = await (service as any).executePrivacyRequest(request.id, {
      executionNotes: 'Soft redaction complete.',
    }, { actorRole: 'pmcm-admin', actorName: 'Ms. Mys' });

    expect(approved.status).toBe('approved');
    expect(executed.status).toBe('executed');
    expect(fake.state.inquiries[0].clientName).toBe('Sofia Lim');
    expect(fake.state.approvalRequests[0].name).toBe('Sofia Lim');
    expect(fake.state.guestCheckIns[0].guestName).toBe('Redacted guest');
    expect(fake.state.guestFeedback[0]).toMatchObject({
      guestName: 'Redacted guest',
      comment: '[redacted by privacy request]',
    });
    expect(fake.state.auditLogs).toHaveLength(3);
    await expect((service as any).verifyAuditIntegrity({ actorRole: 'pmcm-admin' })).resolves.toMatchObject({ valid: true });
  });

  it('rejects non-PMCM privacy request writes and invalid review states', async () => {
    const fake = createPrisma();
    const service = createSampleCompatibilityService(fake.prisma as any);

    await expect((service as any).createPrivacyRequest({
      subjectType: 'client',
      subjectEmail: 'ana@ayala.test',
      subjectName: 'Ana Reyes',
      requestType: 'access',
    }, { actorRole: 'client', clientName: 'Ana Reyes' })).rejects.toBeInstanceOf(ForbiddenException);

    const request = await (service as any).createPrivacyRequest({
      subjectType: 'client',
      subjectEmail: 'ana@ayala.test',
      subjectName: 'Ana Reyes',
      requestType: 'access',
    }, { actorRole: 'pmcm-admin' });

    await expect((service as any).reviewPrivacyRequest(request.id, {
      status: 'submitted',
      reviewReason: 'Invalid transition.',
    }, { actorRole: 'pmcm-admin' })).rejects.toBeInstanceOf(BadRequestException);
    await expect((service as any).executePrivacyRequest(request.id, {}, { actorRole: 'coordinator' })).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('sanitizes AI payloads, blocks unconfirmed ZDR, and records audit plus approval gates', async () => {
    const fake = createPrisma();
    const service = createSampleCompatibilityService(fake.prisma as any);

    const sanitized = (service as any).sanitizeAiPayload({
      clientName: 'Ana Reyes',
      email: 'ana@ayala.test',
      phone: '+63 917 111 2222',
      supplierName: 'SonicLine Technicals',
      totalAmount: 520000,
      notes: 'Client Ana Reyes prefers SonicLine.',
    });

    expect(JSON.stringify(sanitized)).not.toContain('Ana Reyes');
    expect(JSON.stringify(sanitized)).not.toContain('ana@ayala.test');
    expect(JSON.stringify(sanitized)).toContain('Client A');

    await expect((service as any).runAiGovernanceDryRun({
      featureName: 'PEIL',
      modelVersion: 'claude-sonnet-sample',
      zdrConfirmed: false,
      payload: { clientName: 'Ana Reyes' },
    })).rejects.toBeInstanceOf(BadRequestException);
    expect(fake.state.aiAuditLogs[0].status).toBe('ZDR_UNCONFIRMED');

    const result = await (service as any).runAiGovernanceDryRun({
      featureName: 'PEIL',
      modelVersion: 'claude-sonnet-sample',
      zdrConfirmed: true,
      payload: { clientName: 'Ana Reyes', supplierName: 'SonicLine Technicals' },
    });
    expect(result.audit.zdrConfirmed).toBe(true);
    expect(result.approval.humanApproved).toBe(false);
  });

  it('blocks client, supplier, and guest actors from internal staffing directory payloads', async () => {
    const fake = createPrisma();
    const service = createSampleCompatibilityService(fake.prisma as any);

    await expect(
      (service as any).listCoordinators({ actorRole: 'client', clientName: 'Ana Reyes' }),
    ).rejects.toBeInstanceOf(ForbiddenException);
    await expect(
      (service as any).listCoordinators({ actorRole: 'supplier', supplierId: 'sup_sonicline' }),
    ).rejects.toBeInstanceOf(ForbiddenException);
    await expect(
      (service as any).listCoordinators({ actorRole: 'guest', actorName: 'Guest User' }),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });
  it('returns PMCM live ops and role-safe coordinator live ops without private data leakage', async () => {
    const fake = createPrisma();
    fake.state.events.push({
      id: 'evt_sample',
      inquiryId: 'inq_sample',
      clientName: 'Ana Reyes',
      eventName: 'Ayala Summit',
      eventDate: new Date('2026-06-18T00:00:00.000Z'),
      status: 'event_day',
      clientPortalStatus: 'unlocked',
      readiness: 'Event day live',
      archived: false,
      floorPlanStatus: 'approved',
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    fake.state.quoteRequests.push({
      id: 'qr_sonic',
      eventId: 'evt_sample',
      supplierId: 'sup_sonicline',
      categoryId: 'supcat_technicals',
      supplierName: 'SonicLine Technicals',
      category: 'Technicals',
      message: 'Selected assignment',
      dueDate: new Date('2026-06-01T00:00:00.000Z'),
      accessToken: 'token-sonic',
      confidentialBid: false,
      status: 'selected',
      assignmentStatus: 'confirmed',
      readinessStatus: 'confirmed',
      eventDayStatus: 'set_up_ready',
      eventDayNotes: 'Supplier says setup is ready.',
      createdAt: new Date(),
    });
    fake.state.supplierReviews.push({
      id: 'rev_private',
      supplierId: 'sup_sonicline',
      eventId: 'evt_sample',
      rating: 2,
      notes: 'Private PMCM review should not leak.',
      reviewedBy: 'PMCM Admin',
      createdAt: new Date(),
    });
    fake.state.coordinatorAssignments.push({
      id: 'coord_asg_reg',
      eventId: 'evt_sample',
      coordinatorId: 'coord_marco',
      coordinatorName: 'Marco Santos',
      role: 'Registration Staff',
      status: 'acknowledged',
      eventDate: new Date('2026-06-18T00:00:00.000Z'),
      createdAt: new Date(),
    });
    fake.state.guestCheckIns.push({
      id: 'gci_1',
      eventId: 'evt_sample',
      guestName: 'Sofia Lim',
      checkInMode: 'name_search',
      status: 'checked_in',
      walkIn: false,
      verificationStatus: 'verified',
      checkedInAt: new Date(),
    });
    const service = createSampleCompatibilityService(fake.prisma as any);

    const pmcmLive = await (service as any).getEventLiveOps('evt_sample', { actorRole: 'pmcm-admin' });
    expect(pmcmLive.guestAttendanceCount).toBe(1);
    expect(pmcmLive.supplierStatuses[0].verificationStatus).toBe('self_reported');
    expect(JSON.stringify(pmcmLive)).not.toContain('Private PMCM review should not leak.');

    const coordinatorLive = await (service as any).getEventLiveOps('evt_sample', {
      actorRole: 'coordinator',
      actorName: 'Marco Santos',
      actorEmail: 'marco@pmcm.test',
    });
    expect(coordinatorLive.coordinatorAssignments).toHaveLength(1);
    expect(coordinatorLive.billingStatements).toBeUndefined();

    await expect(
      (service as any).getEventLiveOps('evt_sample', {
        actorRole: 'coordinator',
        actorName: 'Ina Cruz',
        actorEmail: 'ina@pmcm.test',
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('creates event-day tasks and urgent issues with event-day logs and audit records', async () => {
    const fake = createPrisma();
    fake.state.events.push({
      id: 'evt_sample',
      inquiryId: 'inq_sample',
      clientName: 'Ana Reyes',
      eventName: 'Ayala Summit',
      eventDate: new Date('2026-06-18T00:00:00.000Z'),
      status: 'event_day',
      clientPortalStatus: 'unlocked',
      readiness: 'Event day live',
      archived: false,
      floorPlanStatus: 'approved',
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    const service = createSampleCompatibilityService(fake.prisma as any);

    const task = await (service as any).createEventDayTask('evt_sample', {
      title: 'Open registration counters',
      assignedRole: 'Registration Staff',
      priority: 'high',
    }, { actorRole: OpsUserRole.PmcmAdmin, actorName: 'Ms. Mys' });
    expect(task.status).toBe('open');

    const completed = await (service as any).updateEventDayTask('evt_sample', task.id, {
      status: 'done',
      notes: 'All counters open.',
    }, { actorRole: OpsUserRole.PmcmAdmin, actorName: 'Ms. Mys' });
    expect(completed.completedAt).toBeTruthy();

    const issue = await (service as any).createUrgentIssue('evt_sample', {
      title: 'VIP entrance queue overflow',
      severity: 'high',
      ownerRole: 'Ingress and Egress Assistant',
      description: 'Queue exceeds holding area.',
    }, { actorRole: OpsUserRole.PmcmAdmin, actorName: 'Ms. Mys' });
    const resolved = await (service as any).updateUrgentIssue('evt_sample', issue.id, {
      status: 'resolved',
      resolution: 'Opened second VIP entrance lane.',
    }, { actorRole: OpsUserRole.PmcmAdmin, actorName: 'Ms. Mys' });

    expect(resolved.status).toBe('resolved');
    expect(fake.state.eventDayLogs.map((log) => log.actionType)).toEqual(
      expect.arrayContaining(['task_created', 'task_updated', 'urgent_issue_created', 'urgent_issue_updated']),
    );
    expect(fake.state.auditLogs.some((log) => log.affectedType === 'urgent_issue')).toBe(true);
  });

  it('tracks coordinator late and absent status with reliability notes', async () => {
    const fake = createPrisma();
    fake.state.events.push({
      id: 'evt_sample',
      inquiryId: 'inq_sample',
      clientName: 'Ana Reyes',
      eventName: 'Ayala Summit',
      eventDate: new Date('2026-06-18T00:00:00.000Z'),
      status: 'event_day',
      clientPortalStatus: 'unlocked',
      readiness: 'Event day live',
      archived: false,
      floorPlanStatus: 'approved',
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    fake.state.coordinatorAssignments.push({
      id: 'coord_asg_reg',
      eventId: 'evt_sample',
      coordinatorId: 'coord_marco',
      coordinatorName: 'Marco Santos',
      role: 'Registration Staff',
      status: 'acknowledged',
      eventDate: new Date('2026-06-18T00:00:00.000Z'),
      createdAt: new Date(),
    });
    const service = createSampleCompatibilityService(fake.prisma as any);

    const late = await (service as any).updateCoordinatorAttendance('evt_sample', 'coord_asg_reg', {
      status: 'late',
      notes: 'Arrived 18 minutes after call time.',
    }, { actorRole: OpsUserRole.PmcmAdmin, actorName: 'Ms. Mys' });

    expect(late.attendanceStatus).toBe('late');
    expect(fake.state.coordinatorReliabilityNotes).toHaveLength(1);
    expect(fake.state.coordinatorReliabilityNotes[0].note).toContain('late');
    expect(fake.state.eventDayLogs.some((log) => log.actionType === 'coordinator_status_updated')).toBe(true);
  });

  it('rejects a coordinator marking another coordinator attendance on the same event', async () => {
    const fake = createPrisma();
    fake.state.events.push({
      id: 'evt_sample',
      inquiryId: 'inq_sample',
      clientName: 'Ana Reyes',
      eventName: 'Ayala Summit',
      eventDate: new Date('2026-06-18T00:00:00.000Z'),
      status: 'event_day',
      clientPortalStatus: 'unlocked',
      readiness: 'Event day live',
      archived: false,
      floorPlanStatus: 'approved',
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    fake.state.coordinatorAssignments.push(
      {
        id: 'coord_asg_reg',
        eventId: 'evt_sample',
        coordinatorId: 'coord_marco',
        coordinatorName: 'Marco Santos',
        role: 'Registration Staff',
        status: 'acknowledged',
        eventDate: new Date('2026-06-18T00:00:00.000Z'),
        createdAt: new Date(),
      },
      {
        id: 'coord_asg_floor',
        eventId: 'evt_sample',
        coordinatorId: 'coord_ina',
        coordinatorName: 'Ina Cruz',
        role: 'Floor Director',
        status: 'acknowledged',
        eventDate: new Date('2026-06-18T00:00:00.000Z'),
        createdAt: new Date(),
      },
    );
    const service = createSampleCompatibilityService(fake.prisma as any);

    // Actor is identified by coordinatorId and email, not display name, so this test does
    // not depend on findAssignmentForEventActor's coordinatorName fallback.
    await expect(
      (service as any).updateCoordinatorAttendance('evt_sample', 'coord_asg_floor', {
        status: 'absent',
      }, { actorRole: OpsUserRole.Coordinator, coordinatorId: 'coord_marco', actorEmail: 'marco@pmcm.test' }),
    ).rejects.toBeInstanceOf(ForbiddenException);

    const target = fake.state.coordinatorAssignments.find((assignment) => assignment.id === 'coord_asg_floor');
    expect(target.attendanceStatus).toBeUndefined();
    expect(fake.state.coordinatorReliabilityNotes).toHaveLength(0);
  });

  it('shows registration coordinator role view with attendance data but no PMCM-only records', async () => {
    const fake = createPrisma();
    fake.state.events.push({
      id: 'evt_sample',
      inquiryId: 'inq_sample',
      clientName: 'Ana Reyes',
      eventName: 'Ayala Summit',
      eventDate: new Date('2026-06-18T00:00:00.000Z'),
      status: 'event_day',
      clientPortalStatus: 'unlocked',
      readiness: 'Event day live',
      archived: false,
      floorPlanStatus: 'approved',
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    fake.state.coordinatorAssignments.push({
      id: 'coord_asg_reg',
      eventId: 'evt_sample',
      coordinatorId: 'coord_marco',
      coordinatorName: 'Marco Santos',
      role: 'Registration Staff',
      status: 'acknowledged',
      eventDate: new Date('2026-06-18T00:00:00.000Z'),
      createdAt: new Date(),
    });
    fake.state.guestCheckIns.push({
      id: 'gci_1',
      eventId: 'evt_sample',
      guestName: 'Sofia Lim',
      checkInMode: 'name_search',
      status: 'checked_in',
      walkIn: false,
      verificationStatus: 'verified',
      checkedInAt: new Date(),
    });
    fake.state.complianceChecks.push({
      id: 'chk_override',
      eventId: 'evt_sample',
      layer: 'Must-Fix',
      severity: 'must_fix',
      phase: 'planning',
      conditionKey: 'supplier_contracts',
      title: 'Supplier contracts',
      status: 'overridden',
      note: 'PMCM accepted risk.',
      overrideReason: 'Private override reason',
      createdAt: new Date(),
    });
    const service = createSampleCompatibilityService(fake.prisma as any);

    const workspace = await (service as any).listCoordinatorWorkspace({
      actorRole: 'coordinator',
      actorName: 'Marco Santos',
      actorEmail: 'marco@pmcm.test',
    });
    const roleView = await (service as any).getCoordinatorRoleView('evt_sample', {
      actorRole: 'coordinator',
      actorName: 'Marco Santos',
      actorEmail: 'marco@pmcm.test',
    });

    expect(workspace.assignments).toHaveLength(1);
    expect(roleView.role).toBe('Registration Staff');
    expect(roleView.guestAttendanceCount).toBe(1);
    expect(roleView.guestCheckIns).toHaveLength(1);
    expect(roleView.complianceChecks).toBeUndefined();
    expect(JSON.stringify(roleView)).not.toContain('Private override reason');
  });

  it('lets PMCM verify or dispute supplier event-day status without leaking private review data', async () => {
    const fake = createPrisma();
    fake.state.events.push({
      id: 'evt_sample',
      inquiryId: 'inq_sample',
      clientName: 'Ana Reyes',
      eventName: 'Ayala Summit',
      eventDate: new Date('2026-06-18T00:00:00.000Z'),
      status: 'event_day',
      clientPortalStatus: 'unlocked',
      readiness: 'Event day live',
      archived: false,
      floorPlanStatus: 'approved',
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    fake.state.quoteRequests.push({
      id: 'qr_sonic',
      eventId: 'evt_sample',
      supplierId: 'sup_sonicline',
      categoryId: 'supcat_technicals',
      supplierName: 'SonicLine Technicals',
      category: 'Technicals',
      message: 'Selected assignment',
      dueDate: new Date('2026-06-01T00:00:00.000Z'),
      accessToken: 'token-sonic',
      confidentialBid: false,
      status: 'selected',
      assignmentStatus: 'confirmed',
      readinessStatus: 'confirmed',
      eventDayStatus: 'set_up_ready',
      eventDayNotes: 'Supplier says setup is ready.',
      createdAt: new Date(),
    });
    fake.state.supplierReviews.push({
      id: 'rev_private',
      supplierId: 'sup_sonicline',
      eventId: 'evt_sample',
      rating: 2,
      notes: 'Private setup problem note.',
      reviewedBy: 'PMCM Admin',
      createdAt: new Date(),
    });
    const service = createSampleCompatibilityService(fake.prisma as any);

    const verified = await (service as any).verifySupplierEventStatus('evt_sample', 'qr_sonic', {
      verificationStatus: 'verified',
      verifiedBy: 'Marco Santos',
      notes: 'Physically checked at stage left.',
    }, { actorRole: OpsUserRole.PmcmAdmin, actorName: 'Ms. Mys' });

    expect(verified.eventDayVerificationStatus).toBe('verified');
    expect(verified.eventDayVerifiedBy).toBe('Ms. Mys');
    expect(verified.eventDayVerifiedBy).not.toBe('Marco Santos');
    expect(JSON.stringify(verified)).not.toContain('Private setup problem note.');
    expect(fake.state.eventDayLogs.some((log) => log.actionType === 'supplier_status_verified')).toBe(true);
  });

  it('computes overdue SLA status for event-day tasks and urgent issues', async () => {
    const fake = createPrisma();
    fake.state.events.push({
      id: 'evt_sample',
      inquiryId: 'inq_sample',
      clientName: 'Ana Reyes',
      eventName: 'Ayala Summit',
      eventDate: new Date('2026-06-18T00:00:00.000Z'),
      status: 'event_day',
      clientPortalStatus: 'unlocked',
      readiness: 'Event day live',
      archived: false,
      floorPlanStatus: 'approved',
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    fake.state.eventDayTasks.push({
      id: 'edt_overdue',
      eventId: 'evt_sample',
      title: 'Open registration counters',
      assignedRole: 'Registration Staff',
      ownerName: '',
      priority: 'high',
      status: 'open',
      notes: '',
      slaDueAt: new Date('2020-01-01T00:00:00.000Z'),
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    fake.state.urgentIssues.push({
      id: 'urg_overdue',
      eventId: 'evt_sample',
      title: 'VIP entrance queue overflow',
      description: '',
      severity: 'high',
      status: 'open',
      ownerRole: 'Ingress and Egress Assistant',
      ownerName: '',
      resolution: '',
      openedBy: 'PMCM Admin',
      slaDueAt: new Date('2020-01-01T00:00:00.000Z'),
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    const service = createSampleCompatibilityService(fake.prisma as any);

    const live = await (service as any).getEventLiveOps('evt_sample', { actorRole: 'pmcm-admin' });

    expect(live.tasks[0]).toMatchObject({ id: 'edt_overdue', slaStatus: 'overdue' });
    expect(live.urgentIssues[0]).toMatchObject({ id: 'urg_overdue', slaStatus: 'overdue' });
  });

  it('escalates live-ops records with event-day logs, audit logs, and queued notifications', async () => {
    const fake = createPrisma();
    fake.state.events.push({
      id: 'evt_sample',
      inquiryId: 'inq_sample',
      clientName: 'Ana Reyes',
      eventName: 'Ayala Summit',
      eventDate: new Date('2026-06-18T00:00:00.000Z'),
      status: 'event_day',
      clientPortalStatus: 'unlocked',
      readiness: 'Event day live',
      archived: false,
      floorPlanStatus: 'approved',
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    fake.state.eventDayTasks.push({
      id: 'edt_escalate',
      eventId: 'evt_sample',
      title: 'Open registration counters',
      assignedRole: 'Registration Staff',
      ownerName: 'Marco Santos',
      priority: 'high',
      status: 'open',
      notes: '',
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    fake.state.urgentIssues.push({
      id: 'urg_escalate',
      eventId: 'evt_sample',
      title: 'VIP entrance queue overflow',
      description: '',
      severity: 'high',
      status: 'open',
      ownerRole: 'Ingress and Egress Assistant',
      ownerName: '',
      resolution: '',
      openedBy: 'PMCM Admin',
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    const service = createSampleCompatibilityService(fake.prisma as any);

    const task = await (service as any).escalateEventDayTask('evt_sample', 'edt_escalate', {
      escalationLevel: 'pmcm',
      notes: 'Registration has not opened by call time.',
      ownerName: 'Marco Santos',
    }, { actorRole: OpsUserRole.PmcmAdmin, actorName: 'PMCM Admin' });
    const issue = await (service as any).escalateUrgentIssue('evt_sample', 'urg_escalate', {
      escalationLevel: 'critical',
      notes: 'Queue is blocking VIP ingress.',
      ownerRole: 'Event Day System Operator',
    }, { actorRole: OpsUserRole.PmcmAdmin, actorName: 'PMCM Admin' });

    expect(task).toMatchObject({ escalationLevel: 'pmcm', escalatedBy: 'PMCM Admin' });
    expect(issue).toMatchObject({ escalationLevel: 'critical', ownerRole: 'Event Day System Operator' });
    expect(fake.state.eventDayLogs.map((log) => log.actionType)).toEqual(
      expect.arrayContaining(['task_escalated', 'urgent_issue_escalated']),
    );
    expect(fake.state.auditLogs.some((log) => log.affectedType === 'event_day_task' && log.actionType === 'update')).toBe(true);
    expect(fake.state.notifications.filter((notification) => notification.status === 'queued')).toHaveLength(2);
  });

  it('replaces a coordinator assignment and records reliability, audit, live-log, and queued notifications', async () => {
    const fake = createPrisma();
    fake.state.events.push({
      id: 'evt_sample',
      inquiryId: 'inq_sample',
      clientName: 'Ana Reyes',
      eventName: 'Ayala Summit',
      eventDate: new Date('2026-06-18T00:00:00.000Z'),
      status: 'event_day',
      clientPortalStatus: 'unlocked',
      readiness: 'Event day live',
      archived: false,
      floorPlanStatus: 'approved',
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    fake.state.coordinatorAssignments.push({
      id: 'coord_asg_reg',
      eventId: 'evt_sample',
      coordinatorId: 'coord_marco',
      coordinatorName: 'Marco Santos',
      role: 'Registration Staff',
      status: 'acknowledged',
      attendanceStatus: 'late',
      eventDate: new Date('2026-06-18T00:00:00.000Z'),
      createdAt: new Date(),
    });
    const service = createSampleCompatibilityService(fake.prisma as any);

    const replacement = await (service as any).replaceCoordinatorAssignment('evt_sample', 'coord_asg_reg', {
      replacementCoordinatorId: 'coord_ina',
      role: 'Stage Director',
      reason: 'Marco cannot reach the venue before doors open.',
    }, { actorRole: OpsUserRole.PmcmAdmin, actorName: 'Ms. Mys' });

    expect(replacement.replacedAssignment).toMatchObject({
      id: 'coord_asg_reg',
      status: 'replaced',
      attendanceStatus: 'replaced',
    });
    expect(replacement.replacementAssignment).toMatchObject({
      coordinatorId: 'coord_ina',
      coordinatorName: 'Ina Cruz',
      role: 'Stage Director',
      status: 'pending_acknowledgement',
    });
    expect(fake.state.coordinatorReliabilityNotes[0].note).toContain('replaced');
    expect(fake.state.eventDayLogs.some((log) => log.actionType === 'coordinator_replaced')).toBe(true);
    expect(fake.state.auditLogs.some((log) => log.affectedType === 'coordinator_assignment')).toBe(true);
    expect(fake.state.notifications.filter((notification) => notification.status === 'queued')).toHaveLength(2);
  });

  it('returns role-safe status feeds and rejects non-live-ops actors', async () => {
    const fake = createPrisma();
    fake.state.events.push({
      id: 'evt_sample',
      inquiryId: 'inq_sample',
      clientName: 'Ana Reyes',
      eventName: 'Ayala Summit',
      eventDate: new Date('2026-06-18T00:00:00.000Z'),
      status: 'event_day',
      clientPortalStatus: 'unlocked',
      readiness: 'Event day live',
      archived: false,
      floorPlanStatus: 'approved',
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    fake.state.coordinatorAssignments.push({
      id: 'coord_asg_reg',
      eventId: 'evt_sample',
      coordinatorId: 'coord_marco',
      coordinatorName: 'Marco Santos',
      role: 'Registration Staff',
      status: 'acknowledged',
      eventDate: new Date('2026-06-18T00:00:00.000Z'),
      createdAt: new Date(),
    });
    fake.state.guestCheckIns.push({
      id: 'gci_1',
      eventId: 'evt_sample',
      guestName: 'Sofia Lim',
      checkInMode: 'walk_in',
      status: 'checked_in',
      walkIn: true,
      verificationStatus: 'flagged',
      checkedInAt: new Date(),
    });
    fake.state.complianceChecks.push({
      id: 'chk_override',
      eventId: 'evt_sample',
      title: 'Supplier contracts',
      status: 'overridden',
      overrideReason: 'Private PMCM override reason',
      createdAt: new Date(),
    });
    fake.state.supplierReviews.push({
      id: 'rev_private',
      supplierId: 'sup_sonicline',
      eventId: 'evt_sample',
      rating: 2,
      notes: 'Private review note',
      reviewedBy: 'PMCM Admin',
      createdAt: new Date(),
    });
    fake.state.auditLogs.push({
      id: 'aud_private',
      eventId: 'evt_sample',
      actor: 'PMCM Admin',
      action: 'Private audit',
      actionType: 'update',
      category: 'events',
      createdAt: new Date(),
    });
    const service = createSampleCompatibilityService(fake.prisma as any);

    const feed = await (service as any).getEventDayStatusFeed('evt_sample', {
      actorRole: 'coordinator',
      actorName: 'Marco Santos',
      actorEmail: 'marco@pmcm.test',
    });

    expect(feed.role).toBe('Registration Staff');
    expect(feed.guestAttendanceCount).toBe(1);
    expect(feed.guestCheckIns).toHaveLength(1);
    expect(JSON.stringify(feed)).not.toContain('Private PMCM override reason');
    expect(JSON.stringify(feed)).not.toContain('Private review note');
    expect(JSON.stringify(feed)).not.toContain('Private audit');

    await expect((service as any).getEventDayStatusFeed('evt_sample', { actorRole: 'client', clientName: 'Ana Reyes' })).rejects.toBeInstanceOf(ForbiddenException);
    await expect((service as any).escalateUrgentIssue('evt_sample', 'urg_missing', { escalationLevel: 'pmcm', notes: 'x' }, { actorRole: 'supplier' })).rejects.toBeInstanceOf(ForbiddenException);
  });

});
