import { prismApi } from "@/lib/prism-api";

/**
 * Focused command port for the PMCM dashboard.
 *
 * The legacy portal adapter remains the transport composition root for now,
 * but the dashboard does not depend on its broad object surface.
 */
export type EventDashboardCommands = Pick<
  typeof prismApi,
  | "acceptInquiry"
  | "addSupplierCertification"
  | "addSupplierReview"
  | "approveApprovalRequest"
  | "approveBillingSource"
  | "approveFloorPlanDraft"
  | "archiveEvent"
  | "assignCoordinator"
  | "createBillingSource"
  | "createComplianceRule"
  | "createEventDayTask"
  | "createFloorPlanDraft"
  | "createSupplier"
  | "createUrgentIssue"
  | "changeSupplierTier"
  | "declineApprovalRequest"
  | "declineInquiry"
  | "escalateEventDayTask"
  | "escalateUrgentIssue"
  | "generateBillingStatement"
  | "generateEventInsights"
  | "loadPlan"
  | "logInquiryOnBehalf"
  | "pendInquiry"
  | "recordPayment"
  | "replaceCoordinator"
  | "requestSupplierQuotes"
  | "reset"
  | "resolveCompliance"
  | "runCompliance"
  | "savePlan"
  | "selectSupplierQuote"
  | "sendBillingStatement"
  | "sendConformeReminder"
  | "submitBriefing"
  | "submitFloorPlanDraft"
  | "updateCoordinatorAttendance"
  | "updateEventDayTask"
  | "updateSupplier"
  | "updateUrgentIssue"
  | "uploadConforme"
  | "verifySupplierStatus"
  | "withdrawSupplier"
  | "closeGates"
  | "eventInsights"
  | "pmcmEventWorkspace"
>;

/** Stable dashboard command adapter; individual features depend on this port. */
export const eventDashboardCommands = {
  acceptInquiry: prismApi.acceptInquiry,
  addSupplierCertification: prismApi.addSupplierCertification,
  addSupplierReview: prismApi.addSupplierReview,
  approveApprovalRequest: prismApi.approveApprovalRequest,
  approveBillingSource: prismApi.approveBillingSource,
  approveFloorPlanDraft: prismApi.approveFloorPlanDraft,
  archiveEvent: prismApi.archiveEvent,
  assignCoordinator: prismApi.assignCoordinator,
  createBillingSource: prismApi.createBillingSource,
  createComplianceRule: prismApi.createComplianceRule,
  createEventDayTask: prismApi.createEventDayTask,
  createFloorPlanDraft: prismApi.createFloorPlanDraft,
  createSupplier: prismApi.createSupplier,
  createUrgentIssue: prismApi.createUrgentIssue,
  changeSupplierTier: prismApi.changeSupplierTier,
  declineApprovalRequest: prismApi.declineApprovalRequest,
  declineInquiry: prismApi.declineInquiry,
  escalateEventDayTask: prismApi.escalateEventDayTask,
  escalateUrgentIssue: prismApi.escalateUrgentIssue,
  generateBillingStatement: prismApi.generateBillingStatement,
  generateEventInsights: prismApi.generateEventInsights,
  loadPlan: prismApi.loadPlan,
  logInquiryOnBehalf: prismApi.logInquiryOnBehalf,
  pendInquiry: prismApi.pendInquiry,
  recordPayment: prismApi.recordPayment,
  replaceCoordinator: prismApi.replaceCoordinator,
  requestSupplierQuotes: prismApi.requestSupplierQuotes,
  reset: prismApi.reset,
  resolveCompliance: prismApi.resolveCompliance,
  runCompliance: prismApi.runCompliance,
  savePlan: prismApi.savePlan,
  selectSupplierQuote: prismApi.selectSupplierQuote,
  sendBillingStatement: prismApi.sendBillingStatement,
  sendConformeReminder: prismApi.sendConformeReminder,
  submitBriefing: prismApi.submitBriefing,
  submitFloorPlanDraft: prismApi.submitFloorPlanDraft,
  updateCoordinatorAttendance: prismApi.updateCoordinatorAttendance,
  updateEventDayTask: prismApi.updateEventDayTask,
  updateSupplier: prismApi.updateSupplier,
  updateUrgentIssue: prismApi.updateUrgentIssue,
  uploadConforme: prismApi.uploadConforme,
  verifySupplierStatus: prismApi.verifySupplierStatus,
  withdrawSupplier: prismApi.withdrawSupplier,
  closeGates: prismApi.closeGates,
  eventInsights: prismApi.eventInsights,
  pmcmEventWorkspace: prismApi.pmcmEventWorkspace,
} satisfies EventDashboardCommands;
