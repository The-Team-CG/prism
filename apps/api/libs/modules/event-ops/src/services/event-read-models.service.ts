import { NotFoundException } from '@nestjs/common';
import type {
  OpsAuditLog,
  OpsBillingSource,
  OpsBillingStatement,
  OpsBriefing,
  OpsComplianceCheck,
  OpsComplianceRule,
  OpsCoordinator,
  OpsCoordinatorAssignment,
  OpsDocument,
  OpsEvent,
  OpsEventInsight,
  OpsFloorPlanDraft,
  OpsInquiry,
  OpsNotificationLog,
  OpsPaymentMilestone,
  OpsPaymentRecord,
  OpsPostEventDocument,
  OpsSupplierQuote,
  OpsSupplierQuoteRequest,
  OpsUser,
} from '@prisma/client';
import type { PrismaService } from '@prism/database';
import { AuditCategory, OpsUserRole, SupplierQuoteRequestStatus } from '../ops.constants';
import { EventAccessPolicyService, type ResolvedEventOpsActor } from './event-access-policy.service';
import { SuppliersService } from './suppliers.service';

type EventWithDrafts = OpsEvent & { floorPlanDrafts?: OpsFloorPlanDraft[] };

type BillingReadModelMappers = {
  mapEvent: (event: EventWithDrafts) => unknown;
  mapBillingSource: (source: OpsBillingSource) => unknown;
  mapBillingStatement: (statement: OpsBillingStatement) => unknown;
  mapPaymentMilestone: (payment: OpsPaymentMilestone, history: OpsPaymentRecord[]) => unknown;
  mapPaymentRecord: (record: OpsPaymentRecord) => unknown;
};

type ClientWorkspaceMappers = {
  mapEvent: (event: EventWithDrafts) => unknown;
  mapDocument: (document: OpsDocument) => unknown;
  mapBriefing: (briefing: OpsBriefing) => unknown;
  mapBillingStatement: (statement: OpsBillingStatement) => unknown;
  mapPaymentMilestone: (payment: OpsPaymentMilestone, history: OpsPaymentRecord[]) => unknown;
  mapFloorPlanDraft: (draft: OpsFloorPlanDraft) => unknown;
  mapAuditLog: (log: OpsAuditLog) => unknown;
};

type SupplierWorkspaceMappers = {
  mapSupplierQuoteRequest: (request: OpsSupplierQuoteRequest) => unknown;
  mapSupplierQuoteForSupplier: (quote: OpsSupplierQuote) => unknown;
};

type PmcmDashboardMappers = {
  coordinatorRoleRequirements: unknown[];
  mapUser: (user: OpsUser) => unknown;
  mapInquiry: (inquiry: OpsInquiry) => unknown;
  mapEvent: (event: EventWithDrafts) => unknown;
  mapDocument: (document: OpsDocument) => unknown;
  mapBriefing: (briefing: OpsBriefing) => unknown;
  mapSupplierQuoteRequest: (request: OpsSupplierQuoteRequest) => unknown;
  mapSupplierQuote: (quote: OpsSupplierQuote) => unknown;
  mapCoordinator: (coordinator: OpsCoordinator) => unknown;
  mapCoordinatorAssignment: (assignment: OpsCoordinatorAssignment) => unknown;
  mapComplianceRule: (rule: OpsComplianceRule) => unknown;
  mapComplianceCheck: (check: OpsComplianceCheck) => unknown;
  mapBillingSource: (source: OpsBillingSource) => unknown;
  mapBillingStatement: (statement: OpsBillingStatement) => unknown;
  mapPaymentMilestone: (payment: OpsPaymentMilestone, history: OpsPaymentRecord[]) => unknown;
  mapPaymentRecord: (record: OpsPaymentRecord) => unknown;
  mapPostEventDocument: (document: OpsPostEventDocument) => unknown;
  mapEventInsight: (insight: OpsEventInsight) => unknown;
  mapFloorPlanDraft: (draft: OpsFloorPlanDraft) => unknown;
  mapAuditLog: (log: OpsAuditLog) => unknown;
  mapNotificationLog: (log: OpsNotificationLog) => unknown;
};

export class EventReadModelsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly policy: EventAccessPolicyService,
    private readonly suppliersService: SuppliersService,
  ) {}

  async billing(actor: ResolvedEventOpsActor, mappers: BillingReadModelMappers) {
    await this.policy.requireActorRole(
      actor,
      [OpsUserRole.PmcmAdmin, OpsUserRole.System, OpsUserRole.Client],
      'billing',
    );

    const visibleEvents = await this.visibleEventsForActor(actor);
    const eventIds = visibleEvents.map((event) => event.id);

    if (eventIds.length === 0) {
      return {
        events: [],
        billingSources: [],
        billingStatements: [],
        paymentMilestones: [],
        paymentRecords: [],
      };
    }

    const [billingSources, billingStatements, paymentMilestones, paymentRecords] = await Promise.all([
      this.policy.canViewInternalCosts(actor)
        ? this.prisma.opsBillingSource.findMany({
            where: { eventId: { in: eventIds } },
            orderBy: { createdAt: 'desc' },
          })
        : Promise.resolve([] as OpsBillingSource[]),
      this.prisma.opsBillingStatement.findMany({
        where: { eventId: { in: eventIds } },
        orderBy: { generatedAt: 'desc' },
      }),
      this.prisma.opsPaymentMilestone.findMany({
        where: { eventId: { in: eventIds } },
        orderBy: { createdAt: 'asc' },
      }),
      this.prisma.opsPaymentRecord.findMany({
        where: { eventId: { in: eventIds } },
        orderBy: { recordedAt: 'desc' },
      }),
    ]);

    return {
      events: visibleEvents.map((event) => mappers.mapEvent(event)),
      billingSources: billingSources.map((source) => mappers.mapBillingSource(source)),
      billingStatements: billingStatements.map((statement) => mappers.mapBillingStatement(statement)),
      paymentMilestones: paymentMilestones.map((payment) =>
        mappers.mapPaymentMilestone(
          payment,
          paymentRecords.filter((record) => record.milestoneId === payment.id),
        ),
      ),
      paymentRecords: paymentRecords.map((record) => mappers.mapPaymentRecord(record)),
    };
  }

  async clientWorkspace(actor: ResolvedEventOpsActor, mappers: ClientWorkspaceMappers) {
    await this.policy.requireActorRole(actor, [OpsUserRole.Client], 'client workspace');

    const visibleEvents = await this.visibleEventsForActor(actor);
    const eventIds = visibleEvents.map((event) => event.id);

    if (eventIds.length === 0) {
      return {
        users: [],
        inquiries: [],
        events: [],
        documents: [],
        briefings: [],
        supplierQuotes: [],
        coordinatorAssignments: [],
        complianceChecks: [],
        billingStatements: [],
        paymentMilestones: [],
        postEventDocuments: [],
        floorPlanDrafts: [],
        auditLogs: [],
        notificationLogs: [],
      };
    }

    const [documents, briefings, floorPlanDrafts, billingStatements, paymentMilestones, paymentRecords, auditLogs] =
      await Promise.all([
        this.prisma.opsDocument.findMany({
          where: { eventId: { in: eventIds } },
          orderBy: { uploadedAt: 'desc' },
        }),
        this.prisma.opsBriefing.findMany({
          where: { eventId: { in: eventIds } },
          orderBy: { submittedAt: 'desc' },
        }),
        this.prisma.opsFloorPlanDraft.findMany({
          where: { eventId: { in: eventIds } },
          orderBy: { updatedAt: 'desc' },
        }),
        this.prisma.opsBillingStatement.findMany({
          where: { eventId: { in: eventIds } },
          orderBy: { generatedAt: 'desc' },
        }),
        this.prisma.opsPaymentMilestone.findMany({
          where: { eventId: { in: eventIds } },
          orderBy: { createdAt: 'asc' },
        }),
        this.prisma.opsPaymentRecord.findMany({
          where: { eventId: { in: eventIds } },
          orderBy: { recordedAt: 'desc' },
        }),
        this.prisma.opsAuditLog.findMany({
          where: {
            eventId: { in: eventIds },
            category: { not: AuditCategory.Access },
          },
          orderBy: { createdAt: 'desc' },
          take: 50,
        }),
      ]);

    return {
      users: [],
      inquiries: [],
      events: visibleEvents.map((event) => mappers.mapEvent(event)),
      documents: documents.map((document) => mappers.mapDocument(document)),
      briefings: briefings.map((briefing) => mappers.mapBriefing(briefing)),
      supplierQuotes: [],
      coordinatorAssignments: [],
      complianceChecks: [],
      billingStatements: billingStatements.map((statement) => mappers.mapBillingStatement(statement)),
      paymentMilestones: paymentMilestones.map((payment) =>
        mappers.mapPaymentMilestone(
          payment,
          paymentRecords.filter((record) => record.milestoneId === payment.id),
        ),
      ),
      postEventDocuments: [],
      floorPlanDrafts: floorPlanDrafts.map((draft) => mappers.mapFloorPlanDraft(draft)),
      auditLogs: auditLogs.map((log) => mappers.mapAuditLog(log)),
      notificationLogs: [],
    };
  }

  async supplierWorkspace(actor: ResolvedEventOpsActor, mappers: SupplierWorkspaceMappers) {
    await this.policy.requireActorRole(actor, [OpsUserRole.Supplier], 'supplier workspace');
    const supplier = await this.resolveSupplierForActor(actor);
    const [requests, quotes] = await Promise.all([
      this.prisma.opsSupplierQuoteRequest.findMany({
        where: { supplierId: supplier.id },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.opsSupplierQuote.findMany({
        where: { supplierId: supplier.id },
        orderBy: { createdAt: 'desc' },
      }),
    ]);

    return {
      supplier: this.sanitizeSupplierForSupplier(supplier),
      quoteRequests: requests.map((request) => mappers.mapSupplierQuoteRequest(this.withExpiredQuoteRequestStatus(request))),
      supplierQuotes: quotes.map((quote) => mappers.mapSupplierQuoteForSupplier(quote)),
    };
  }

  async pmcmDashboard(actor: ResolvedEventOpsActor, mappers: PmcmDashboardMappers) {
    await this.policy.requireActorRole(actor, [OpsUserRole.PmcmAdmin, OpsUserRole.System], 'PMCM dashboard');

    const [
      users,
      inquiries,
      events,
      documents,
      briefings,
      supplierQuoteRequests,
      supplierQuotes,
      coordinators,
      coordinatorAssignments,
      complianceRules,
      complianceChecks,
      billingSources,
      billingStatements,
      paymentMilestones,
      paymentRecords,
      postEventDocuments,
      eventInsights,
      floorPlanDrafts,
      supplierCategories,
      suppliers,
      auditLogs,
      notificationLogs,
    ] = await Promise.all([
      this.prisma.opsUser.findMany({ orderBy: { createdAt: 'asc' } }),
      this.prisma.opsInquiry.findMany({ orderBy: { createdAt: 'desc' } }),
      this.prisma.opsEvent.findMany({
        include: { floorPlanDrafts: { orderBy: { updatedAt: 'desc' } } },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.opsDocument.findMany({ orderBy: { uploadedAt: 'desc' } }),
      this.prisma.opsBriefing.findMany({ orderBy: { submittedAt: 'desc' } }),
      this.prisma.opsSupplierQuoteRequest.findMany({ orderBy: { createdAt: 'desc' } }),
      this.prisma.opsSupplierQuote.findMany({ orderBy: { createdAt: 'desc' } }),
      this.prisma.opsCoordinator.findMany({ where: { active: true }, orderBy: { name: 'asc' } }),
      this.prisma.opsCoordinatorAssignment.findMany({ orderBy: { createdAt: 'desc' } }),
      this.prisma.opsComplianceRule.findMany({ orderBy: { createdAt: 'desc' } }),
      this.prisma.opsComplianceCheck.findMany({ orderBy: { createdAt: 'desc' } }),
      this.prisma.opsBillingSource.findMany({ orderBy: { createdAt: 'desc' } }),
      this.prisma.opsBillingStatement.findMany({ orderBy: { generatedAt: 'desc' } }),
      this.prisma.opsPaymentMilestone.findMany({ orderBy: { createdAt: 'asc' } }),
      this.prisma.opsPaymentRecord.findMany({ orderBy: { recordedAt: 'desc' } }),
      this.prisma.opsPostEventDocument.findMany({ orderBy: { title: 'asc' } }),
      this.prisma.opsEventInsight.findMany({ orderBy: { generatedAt: 'desc' } }),
      this.prisma.opsFloorPlanDraft.findMany({ orderBy: { updatedAt: 'desc' } }),
      this.suppliersService.listSupplierCategories(),
      this.suppliersService.listSuppliers(),
      this.prisma.opsAuditLog.findMany({ orderBy: { createdAt: 'desc' } }),
      this.prisma.opsNotificationLog.findMany({ orderBy: { createdAt: 'desc' } }),
    ]);

    return {
      users: users.map(mappers.mapUser),
      inquiries: inquiries.map(mappers.mapInquiry),
      events: events.map(mappers.mapEvent),
      documents: documents.map(mappers.mapDocument),
      briefings: briefings.map(mappers.mapBriefing),
      supplierQuoteRequests: supplierQuoteRequests.map(mappers.mapSupplierQuoteRequest),
      supplierQuotes: supplierQuotes.map(mappers.mapSupplierQuote),
      coordinators: coordinators.map(mappers.mapCoordinator),
      coordinatorRoleRequirements: mappers.coordinatorRoleRequirements,
      coordinatorAssignments: coordinatorAssignments.map(mappers.mapCoordinatorAssignment),
      complianceRules: complianceRules.map(mappers.mapComplianceRule),
      complianceChecks: complianceChecks.map(mappers.mapComplianceCheck),
      billingSources: billingSources.map(mappers.mapBillingSource),
      billingStatements: billingStatements.map(mappers.mapBillingStatement),
      paymentMilestones: paymentMilestones.map((payment) =>
        mappers.mapPaymentMilestone(
          payment,
          paymentRecords.filter((record) => record.milestoneId === payment.id),
        ),
      ),
      paymentRecords: paymentRecords.map(mappers.mapPaymentRecord),
      postEventDocuments: postEventDocuments.map(mappers.mapPostEventDocument),
      eventInsights: eventInsights.map(mappers.mapEventInsight),
      floorPlanDrafts: floorPlanDrafts.map(mappers.mapFloorPlanDraft),
      supplierCategories,
      suppliers,
      auditLogs: auditLogs.map(mappers.mapAuditLog),
      notificationLogs: notificationLogs.map(mappers.mapNotificationLog),
    };
  }

  private async visibleEventsForActor(actor: ResolvedEventOpsActor) {
    const events = await this.prisma.opsEvent.findMany({
      where: { archived: false },
      include: { floorPlanDrafts: { orderBy: { updatedAt: 'desc' } } },
      orderBy: { eventDate: 'asc' },
    });
    return this.policy.filterEventsForActor(actor, events);
  }

  private async resolveSupplierForActor(actor: ResolvedEventOpsActor) {
    const suppliers = await this.suppliersService.listSuppliers();
    const supplier = suppliers.find(
      (item) =>
        this.policy.sameText(actor.supplierId, item.id) ||
        this.policy.sameText(actor.email, item.email) ||
        this.policy.sameText(actor.name, item.name),
    );
    if (!supplier) throw new NotFoundException('Supplier profile not found for actor');
    return supplier;
  }

  private sanitizeSupplierForSupplier(supplier: Awaited<ReturnType<SuppliersService['listSuppliers']>>[number]) {
    const { reviews, reliabilityNotes, performanceNotes, aggregateRating, lastEventDate, pastEvents, ...safeSupplier } =
      supplier;
    return safeSupplier;
  }

  private withExpiredQuoteRequestStatus(request: OpsSupplierQuoteRequest) {
    if (
      request.dueDate &&
      request.dueDate.getTime() < Date.now() &&
      [SupplierQuoteRequestStatus.Open, SupplierQuoteRequestStatus.RevisionRequested].includes(request.status as any)
    ) {
      return { ...request, status: SupplierQuoteRequestStatus.Expired } as OpsSupplierQuoteRequest;
    }
    return request;
  }
}
