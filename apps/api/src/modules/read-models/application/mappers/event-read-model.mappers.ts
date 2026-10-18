import type {
  BillingReadModelMappers,
  ClientWorkspaceMappers,
  PmcmDashboardMappers,
  SupplierWorkspaceMappers,
} from '../services/event-read-models.service';

export type BillingReadModelMapperDependencies = BillingReadModelMappers;
export type ClientWorkspaceMapperDependencies = ClientWorkspaceMappers;
export type SupplierWorkspaceMapperDependencies = SupplierWorkspaceMappers;
export type PmcmDashboardMapperDependencies = PmcmDashboardMappers;

export function createBillingReadModelMappers(
  dependencies: BillingReadModelMapperDependencies,
): BillingReadModelMappers {
  return {
    mapEvent: dependencies.mapEvent,
    mapBillingSource: dependencies.mapBillingSource,
    mapBillingStatement: dependencies.mapBillingStatement,
    mapBillingCorrection: dependencies.mapBillingCorrection,
    mapBillingDispute: dependencies.mapBillingDispute,
    mapAdditionalBilling: dependencies.mapAdditionalBilling,
    mapPaymentMilestone: dependencies.mapPaymentMilestone,
    mapPaymentRecord: dependencies.mapPaymentRecord,
  };
}

export function createClientWorkspaceMappers(
  dependencies: ClientWorkspaceMapperDependencies,
): ClientWorkspaceMappers {
  return {
    mapEvent: dependencies.mapEvent,
    mapDocument: dependencies.mapDocument,
    mapBriefing: dependencies.mapBriefing,
    mapBillingStatement: dependencies.mapBillingStatement,
    mapClientBillingDispute: dependencies.mapClientBillingDispute,
    mapPaymentMilestone: dependencies.mapPaymentMilestone,
    mapFloorPlanDraft: dependencies.mapFloorPlanDraft,
    mapAuditLog: dependencies.mapAuditLog,
  };
}

export function createSupplierWorkspaceMappers(
  dependencies: SupplierWorkspaceMapperDependencies,
): SupplierWorkspaceMappers {
  return {
    mapSupplierQuoteRequest: dependencies.mapSupplierQuoteRequest,
    mapSupplierQuoteForSupplier: dependencies.mapSupplierQuoteForSupplier,
  };
}

export function createPmcmDashboardMappers(
  dependencies: PmcmDashboardMapperDependencies,
): PmcmDashboardMappers {
  return {
    coordinatorRoleRequirements: dependencies.coordinatorRoleRequirements,
    mapUser: dependencies.mapUser,
    mapInquiry: dependencies.mapInquiry,
    mapEvent: dependencies.mapEvent,
    mapDocument: dependencies.mapDocument,
    mapBriefing: dependencies.mapBriefing,
    mapSupplierQuoteRequest: dependencies.mapSupplierQuoteRequest,
    mapSupplierQuote: dependencies.mapSupplierQuote,
    mapCoordinator: dependencies.mapCoordinator,
    mapCoordinatorAssignment: dependencies.mapCoordinatorAssignment,
    mapComplianceRule: dependencies.mapComplianceRule,
    mapComplianceCheck: dependencies.mapComplianceCheck,
    mapBillingSource: dependencies.mapBillingSource,
    mapBillingStatement: dependencies.mapBillingStatement,
    mapPaymentMilestone: dependencies.mapPaymentMilestone,
    mapPaymentRecord: dependencies.mapPaymentRecord,
    mapPostEventDocument: dependencies.mapPostEventDocument,
    mapEventInsight: dependencies.mapEventInsight,
    mapFloorPlanDraft: dependencies.mapFloorPlanDraft,
    mapAuditLog: dependencies.mapAuditLog,
    mapNotificationLog: dependencies.mapNotificationLog,
    mapRegistrationPlatform: dependencies.mapRegistrationPlatform,
  };
}