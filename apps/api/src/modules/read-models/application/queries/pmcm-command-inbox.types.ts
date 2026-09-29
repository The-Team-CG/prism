import type {
  OpsCoordinatorAssignment,
  OpsEvent,
  OpsFloorPlanDraft,
  OpsInquiry,
  OpsPaymentMilestone,
  OpsPostEventDocument,
  OpsSupplierQuoteRequest,
} from '@prisma/client';

export type PmcmInboxEvent = Pick<OpsEvent, 'id' | 'eventName' | 'eventDate' | 'floorPlanStatus' | 'status' | 'clientName'>;
export type PmcmInboxInquiry = Pick<OpsInquiry, 'id' | 'status' | 'clientName' | 'eventName' | 'createdAt' | 'acceptedAt' | 'conformeSignedAt' | 'portalInvitationExpiresAt'>;
export type PmcmInboxPaymentMilestone = Pick<OpsPaymentMilestone, 'id' | 'eventId' | 'label' | 'status' | 'dueDate'>;
export type PmcmInboxQuoteRequest = Pick<OpsSupplierQuoteRequest, 'id' | 'eventId' | 'supplierName' | 'status' | 'dueDate'>;
export type PmcmInboxCoordinatorAssignment = Pick<OpsCoordinatorAssignment, 'id' | 'eventId' | 'coordinatorName' | 'status' | 'createdAt'>;
export type PmcmInboxFloorPlanDraft = Pick<OpsFloorPlanDraft, 'id' | 'eventId' | 'name' | 'status' | 'updatedAt'>;
export type PmcmInboxPostEventDocument = Pick<OpsPostEventDocument, 'id' | 'eventId' | 'title' | 'status'>;
