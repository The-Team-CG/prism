import { ForbiddenException, Injectable } from '@nestjs/common';
import type { PrismaService } from '@prism/database';

type Mapper<TInput = unknown, TOutput = unknown> = (input: TInput) => TOutput;

export interface DemoStateContext {
  runConformeReminderSweep: () => Promise<void>;
  runPaymentRiskSweep: () => Promise<void>;
  listSupplierCategories: () => Promise<unknown[]>;
  listSuppliers: () => Promise<unknown[]>;
  coordinatorRoleRequirements: unknown[];
  mapUser: Mapper;
  mapInquiry: Mapper;
  mapEvent: Mapper;
  mapDocument: Mapper;
  mapBriefing: Mapper;
  mapSupplierQuoteRequest: Mapper;
  mapSupplierQuote: Mapper;
  mapCoordinator: Mapper;
  mapCoordinatorAssignment: Mapper;
  mapComplianceRule: Mapper;
  mapComplianceCheck: Mapper;
  mapBillingSource: Mapper;
  mapBillingStatement: Mapper;
  mapPaymentMilestone: (payment: unknown, history: unknown[]) => unknown;
  mapPaymentRecord: Mapper;
  mapPostEventDocument: Mapper;
  mapEventInsight: Mapper;
  mapFloorPlanDraft: Mapper;
  mapAuditLog: Mapper;
  mapNotificationLog: Mapper;
}

@Injectable()
export class DemoStateService {
  constructor(private readonly prisma: PrismaService) {}

  async state(context: DemoStateContext) {
    await context.runConformeReminderSweep();
    await context.runPaymentRiskSweep();

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
      context.listSupplierCategories(),
      context.listSuppliers(),
      this.prisma.opsAuditLog.findMany({ orderBy: { createdAt: 'desc' } }),
      this.prisma.opsNotificationLog.findMany({ orderBy: { createdAt: 'desc' } }),
    ]);

    return {
      users: users.map(context.mapUser),
      inquiries: inquiries.map(context.mapInquiry),
      events: events.map(context.mapEvent),
      documents: documents.map(context.mapDocument),
      briefings: briefings.map(context.mapBriefing),
      supplierQuoteRequests: supplierQuoteRequests.map(context.mapSupplierQuoteRequest),
      supplierQuotes: supplierQuotes.map(context.mapSupplierQuote),
      coordinators: coordinators.map(context.mapCoordinator),
      coordinatorRoleRequirements: context.coordinatorRoleRequirements,
      coordinatorAssignments: coordinatorAssignments.map(context.mapCoordinatorAssignment),
      complianceRules: complianceRules.map(context.mapComplianceRule),
      complianceChecks: complianceChecks.map(context.mapComplianceCheck),
      billingSources: billingSources.map(context.mapBillingSource),
      billingStatements: billingStatements.map(context.mapBillingStatement),
      paymentMilestones: paymentMilestones.map((payment: { id: string }) =>
        context.mapPaymentMilestone(
          payment,
          paymentRecords.filter((record: { milestoneId: string }) => record.milestoneId === payment.id),
        ),
      ),
      paymentRecords: paymentRecords.map(context.mapPaymentRecord),
      postEventDocuments: postEventDocuments.map(context.mapPostEventDocument),
      eventInsights: eventInsights.map(context.mapEventInsight),
      floorPlanDrafts: floorPlanDrafts.map(context.mapFloorPlanDraft),
      supplierCategories,
      suppliers,
      auditLogs: auditLogs.map(context.mapAuditLog),
      notificationLogs: notificationLogs.map(context.mapNotificationLog),
    };
  }

  async resetDemo(seedDemo: () => Promise<void>, readState: () => Promise<unknown>) {
    if (process.env.NODE_ENV === 'production' && process.env.PRISM_ALLOW_DEMO_RESET !== '1') {
      throw new ForbiddenException('Demo reset is disabled in production');
    }

    await this.prisma.$transaction(async (tx) => {
      const draftFloorPlanIds = (
        await tx.opsFloorPlanDraft.findMany({ select: { floorPlanId: true } })
      ).map((draft) => draft.floorPlanId);

      await tx.opsNotificationLog.deleteMany();
      await tx.opsAuditLog.deleteMany();
      await tx.opsEventInsight.deleteMany();
      await tx.opsEventDayLog.deleteMany();
      await tx.opsUrgentIssue.deleteMany();
      await tx.opsEventDayTask.deleteMany();
      await tx.opsCoordinatorReliabilityNote.deleteMany();
      await tx.opsPostEventDocument.deleteMany();
      await tx.opsPaymentRecord.deleteMany();
      await tx.opsPaymentMilestone.deleteMany();
      await tx.opsBillingStatement.deleteMany();
      await tx.opsBillingSource.deleteMany();
      await tx.opsComplianceCheck.deleteMany();
      await tx.opsComplianceRule.deleteMany();
      await tx.opsCoordinatorAssignment.deleteMany();
      await tx.opsCoordinator.deleteMany();
      await tx.opsSupplierQuote.deleteMany();
      await tx.opsSupplierQuoteRequest.deleteMany();
      await tx.opsSupplierCertification.deleteMany();
      await tx.opsSupplierReliabilityNote.deleteMany();
      await tx.opsSupplierReview.deleteMany();
      await tx.opsSupplier.deleteMany();
      await tx.opsSupplierCategory.deleteMany();
      await tx.opsBriefing.deleteMany();
      await tx.opsDocument.deleteMany();
      await tx.opsFloorPlanDraft.deleteMany();
      await tx.opsEvent.deleteMany();
      await tx.opsInquiry.deleteMany();
      await tx.opsApprovalRequest.deleteMany();
      await tx.opsUser.deleteMany();

      if (draftFloorPlanIds.length > 0) {
        await tx.floorPlanObject.deleteMany({
          where: { floorPlanId: { in: draftFloorPlanIds } },
        });
        await tx.floorPlan.deleteMany({ where: { id: { in: draftFloorPlanIds } } });
      }
    });

    await seedDemo();
    return readState();
  }

  async seedDemoState(ensureSeeded: () => Promise<void>, readState: () => Promise<unknown>) {
    await ensureSeeded();
    return readState();
  }
}
