/**
 * Single I/O boundary for PMCM event-portal product mutations and loads.
 * Feature views must not import `@/lib/prism-api` — go through use-cases / view-models.
 */
import { prismApi } from "@/lib/prism-api";

export const eventOpsRepository = {
  acceptInquiry: (...args: Parameters<typeof prismApi.acceptInquiry>) =>
    prismApi.acceptInquiry(...args),
  acknowledgeCoordinator: (...args: Parameters<typeof prismApi.acknowledgeCoordinator>) =>
    prismApi.acknowledgeCoordinator(...args),
  addSupplierCertification: (...args: Parameters<typeof prismApi.addSupplierCertification>) =>
    prismApi.addSupplierCertification(...args),
  addSupplierReview: (...args: Parameters<typeof prismApi.addSupplierReview>) =>
    prismApi.addSupplierReview(...args),
  approvalRequests: (...args: Parameters<typeof prismApi.approvalRequests>) =>
    prismApi.approvalRequests(...args),
  approveApprovalRequest: (...args: Parameters<typeof prismApi.approveApprovalRequest>) =>
    prismApi.approveApprovalRequest(...args),
  approveBillingSource: (...args: Parameters<typeof prismApi.approveBillingSource>) =>
    prismApi.approveBillingSource(...args),
  approveFloorPlanDraft: (...args: Parameters<typeof prismApi.approveFloorPlanDraft>) =>
    prismApi.approveFloorPlanDraft(...args),
  archiveEvent: (...args: Parameters<typeof prismApi.archiveEvent>) =>
    prismApi.archiveEvent(...args),
  assignCoordinator: (...args: Parameters<typeof prismApi.assignCoordinator>) =>
    prismApi.assignCoordinator(...args),
  changeSupplierTier: (...args: Parameters<typeof prismApi.changeSupplierTier>) =>
    prismApi.changeSupplierTier(...args),
  closeGates: (...args: Parameters<typeof prismApi.closeGates>) => prismApi.closeGates(...args),
  coordinatorRoleView: (...args: Parameters<typeof prismApi.coordinatorRoleView>) =>
    prismApi.coordinatorRoleView(...args),
  coordinatorWorkspace: (...args: Parameters<typeof prismApi.coordinatorWorkspace>) =>
    prismApi.coordinatorWorkspace(...args),
  createBillingSource: (...args: Parameters<typeof prismApi.createBillingSource>) =>
    prismApi.createBillingSource(...args),
  createComplianceRule: (...args: Parameters<typeof prismApi.createComplianceRule>) =>
    prismApi.createComplianceRule(...args),
  createEventDayTask: (...args: Parameters<typeof prismApi.createEventDayTask>) =>
    prismApi.createEventDayTask(...args),
  createFloorPlanDraft: (...args: Parameters<typeof prismApi.createFloorPlanDraft>) =>
    prismApi.createFloorPlanDraft(...args),
  createSupplier: (...args: Parameters<typeof prismApi.createSupplier>) =>
    prismApi.createSupplier(...args),
  createUrgentIssue: (...args: Parameters<typeof prismApi.createUrgentIssue>) =>
    prismApi.createUrgentIssue(...args),
  declineApprovalRequest: (...args: Parameters<typeof prismApi.declineApprovalRequest>) =>
    prismApi.declineApprovalRequest(...args),
  declineInquiry: (...args: Parameters<typeof prismApi.declineInquiry>) =>
    prismApi.declineInquiry(...args),
  defenseReadiness: (...args: Parameters<typeof prismApi.defenseReadiness>) =>
    prismApi.defenseReadiness(...args),
  escalateEventDayTask: (...args: Parameters<typeof prismApi.escalateEventDayTask>) =>
    prismApi.escalateEventDayTask(...args),
  escalateUrgentIssue: (...args: Parameters<typeof prismApi.escalateUrgentIssue>) =>
    prismApi.escalateUrgentIssue(...args),
  eventDayStatusFeed: (...args: Parameters<typeof prismApi.eventDayStatusFeed>) =>
    prismApi.eventDayStatusFeed(...args),
  eventInsights: (...args: Parameters<typeof prismApi.eventInsights>) =>
    prismApi.eventInsights(...args),
  generateBillingStatement: (...args: Parameters<typeof prismApi.generateBillingStatement>) =>
    prismApi.generateBillingStatement(...args),
  generateEventInsights: (...args: Parameters<typeof prismApi.generateEventInsights>) =>
    prismApi.generateEventInsights(...args),
  liveOps: (...args: Parameters<typeof prismApi.liveOps>) => prismApi.liveOps(...args),
  loadPlan: (...args: Parameters<typeof prismApi.loadPlan>) => prismApi.loadPlan(...args),
  pendInquiry: (...args: Parameters<typeof prismApi.pendInquiry>) => prismApi.pendInquiry(...args),
  pmcmCommandInbox: (...args: Parameters<typeof prismApi.pmcmCommandInbox>) =>
    prismApi.pmcmCommandInbox(...args),
  pmcmEventWorkspace: (...args: Parameters<typeof prismApi.pmcmEventWorkspace>) =>
    prismApi.pmcmEventWorkspace(...args),
  pmcmState: (...args: Parameters<typeof prismApi.pmcmState>) => prismApi.pmcmState(...args),
  recordPayment: (...args: Parameters<typeof prismApi.recordPayment>) =>
    prismApi.recordPayment(...args),
  replaceCoordinator: (...args: Parameters<typeof prismApi.replaceCoordinator>) =>
    prismApi.replaceCoordinator(...args),
  requestSupplierQuotes: (...args: Parameters<typeof prismApi.requestSupplierQuotes>) =>
    prismApi.requestSupplierQuotes(...args),
  reset: (...args: Parameters<typeof prismApi.reset>) => prismApi.reset(...args),
  resolveCompliance: (...args: Parameters<typeof prismApi.resolveCompliance>) =>
    prismApi.resolveCompliance(...args),
  runCompliance: (...args: Parameters<typeof prismApi.runCompliance>) =>
    prismApi.runCompliance(...args),
  savePlan: (...args: Parameters<typeof prismApi.savePlan>) => prismApi.savePlan(...args),
  selectSupplierQuote: (...args: Parameters<typeof prismApi.selectSupplierQuote>) =>
    prismApi.selectSupplierQuote(...args),
  sendBillingStatement: (...args: Parameters<typeof prismApi.sendBillingStatement>) =>
    prismApi.sendBillingStatement(...args),
  sendConformeReminder: (...args: Parameters<typeof prismApi.sendConformeReminder>) =>
    prismApi.sendConformeReminder(...args),
  submitBriefing: (...args: Parameters<typeof prismApi.submitBriefing>) =>
    prismApi.submitBriefing(...args),
  submitFloorPlanDraft: (...args: Parameters<typeof prismApi.submitFloorPlanDraft>) =>
    prismApi.submitFloorPlanDraft(...args),
  updateCoordinatorAttendance: (...args: Parameters<typeof prismApi.updateCoordinatorAttendance>) =>
    prismApi.updateCoordinatorAttendance(...args),
  updateEventDayTask: (...args: Parameters<typeof prismApi.updateEventDayTask>) =>
    prismApi.updateEventDayTask(...args),
  updateSupplier: (...args: Parameters<typeof prismApi.updateSupplier>) =>
    prismApi.updateSupplier(...args),
  updateUrgentIssue: (...args: Parameters<typeof prismApi.updateUrgentIssue>) =>
    prismApi.updateUrgentIssue(...args),
  uploadConforme: (...args: Parameters<typeof prismApi.uploadConforme>) =>
    prismApi.uploadConforme(...args),
  verifySupplierStatus: (...args: Parameters<typeof prismApi.verifySupplierStatus>) =>
    prismApi.verifySupplierStatus(...args),
  withdrawSupplier: (...args: Parameters<typeof prismApi.withdrawSupplier>) =>
    prismApi.withdrawSupplier(...args),
};

export type EventOpsRepository = typeof eventOpsRepository;
