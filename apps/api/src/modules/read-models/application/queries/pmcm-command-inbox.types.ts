import type {
  OpsCoordinatorAssignment,
  OpsDocument,
  OpsEvent,
  OpsEventDayTask,
  OpsFloorPlanDraft,
  OpsInquiry,
  OpsBillingCorrection,
  OpsBillingDispute,
  OpsPaymentMilestone,
  OpsPaymentReceipt,
  OpsSupplierPayableMilestone,
  OpsPostEventDocument,
  OpsSupplierQuoteRequest,
  OpsUrgentIssue,
} from '@prisma/client';

export type PmcmInboxEvent = Pick<OpsEvent, 'id' | 'eventName' | 'eventDate' | 'floorPlanStatus' | 'status' | 'clientName'>;
export type PmcmInboxInquiry = Pick<OpsInquiry, 'id' | 'status' | 'clientName' | 'eventName' | 'createdAt' | 'acceptedAt' | 'conformeSignedAt' | 'portalInvitationExpiresAt'>;
export type PmcmInboxPaymentMilestone = Pick<OpsPaymentMilestone, 'id' | 'eventId' | 'label' | 'status' | 'dueDate'> & Partial<Pick<OpsPaymentMilestone, 'amount' | 'remainingBalance'>>;
/** Money that arrived and PMCM has not checked against the bank or wallet statement. */
export type PmcmInboxReceiptToVerify = Pick<OpsPaymentReceipt, 'id' | 'eventId' | 'amount' | 'method' | 'referenceNumber' | 'source' | 'receivedDate' | 'evidenceObjectId'>;
export type PmcmInboxBillingDispute = Pick<OpsBillingDispute, 'id' | 'eventId' | 'amount' | 'createdAt'>;
export type PmcmInboxBillingCorrection = Pick<OpsBillingCorrection, 'id' | 'eventId' | 'reason' | 'createdAt'>;
/** A supplier payment past its due date with money still to release. */
export type PmcmInboxSupplierPayout = Pick<OpsSupplierPayableMilestone, 'id' | 'eventId' | 'label' | 'amount' | 'dueDate'> & { supplier: { name: string } };
export type PmcmInboxQuoteRequest = Pick<OpsSupplierQuoteRequest, 'id' | 'eventId' | 'supplierName' | 'status' | 'dueDate'>;
export type PmcmInboxCoordinatorAssignment = Pick<OpsCoordinatorAssignment, 'id' | 'eventId' | 'coordinatorName' | 'status' | 'createdAt'>;
export type PmcmInboxFloorPlanDraft = Pick<OpsFloorPlanDraft, 'id' | 'eventId' | 'name' | 'status' | 'updatedAt'>;
export type PmcmInboxPostEventDocument = Pick<OpsPostEventDocument, 'id' | 'eventId' | 'title' | 'status'>;
export type PmcmInboxEventDayTask = Pick<OpsEventDayTask, 'id' | 'eventId' | 'title' | 'status' | 'assignedRole' | 'ownerName' | 'blockedReason' | 'dueAt' | 'slaDueAt' | 'slaStatus'>;
/** A file a client or supplier sent for a requirement that PMCM has not reviewed yet, with the requirement's label. */
export type PmcmInboxFileReview = Pick<OpsDocument, 'id' | 'eventId' | 'type' | 'fileName' | 'uploadedByRole' | 'uploadedAt'> & { requirementLabel?: string };
export type PmcmInboxUrgentIssue = Pick<OpsUrgentIssue, 'id' | 'eventId' | 'title' | 'severity' | 'status' | 'slaDueAt' | 'slaStatus' | 'createdAt'>;
