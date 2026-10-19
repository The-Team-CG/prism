import type {
  OpsCoordinatorAssignment,
  OpsEvent,
  OpsEventDayTask,
  OpsFloorPlanDraft,
  OpsInquiry,
  OpsPaymentMilestone,
  OpsPostEventDocument,
  OpsSupplierQuoteRequest,
  OpsUrgentIssue,
} from '@prisma/client';

export type PmcmInboxEvent = Pick<OpsEvent, 'id' | 'eventName' | 'eventDate' | 'floorPlanStatus' | 'status' | 'clientName'>;
export type PmcmInboxInquiry = Pick<OpsInquiry, 'id' | 'status' | 'clientName' | 'eventName' | 'createdAt' | 'acceptedAt' | 'conformeSignedAt' | 'portalInvitationExpiresAt'>;
export type PmcmInboxPaymentMilestone = Pick<OpsPaymentMilestone, 'id' | 'eventId' | 'label' | 'status' | 'dueDate'>;
export type PmcmInboxQuoteRequest = Pick<OpsSupplierQuoteRequest, 'id' | 'eventId' | 'supplierName' | 'status' | 'dueDate'>;
export type PmcmInboxCoordinatorAssignment = Pick<OpsCoordinatorAssignment, 'id' | 'eventId' | 'coordinatorName' | 'status' | 'createdAt'>;
export type PmcmInboxFloorPlanDraft = Pick<OpsFloorPlanDraft, 'id' | 'eventId' | 'name' | 'status' | 'updatedAt'>;
export type PmcmInboxPostEventDocument = Pick<OpsPostEventDocument, 'id' | 'eventId' | 'title' | 'status'>;
export type PmcmInboxEventDayTask = Pick<OpsEventDayTask, 'id' | 'eventId' | 'title' | 'status' | 'assignedRole' | 'ownerName' | 'dueAt' | 'slaDueAt' | 'slaStatus'>;
export type PmcmInboxUrgentIssue = Pick<OpsUrgentIssue, 'id' | 'eventId' | 'title' | 'severity' | 'status' | 'slaDueAt' | 'slaStatus' | 'createdAt'>;
