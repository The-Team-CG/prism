export type SupplierContractReviewStatus = "submitted" | "accepted" | "changes_requested";
export type SupplierCreativeTaskStatus =
  | "open"
  | "in_progress"
  | "submitted"
  | "changes_requested"
  | "accepted"
  | "cancelled";
export type SupplierPayableStatus = "scheduled" | "partially_released" | "released" | "cancelled";
export type SupplierPayoutRecordKind = "release" | "reversal";

export interface PrismSupplierContractVersion {
  id: string;
  eventId: string;
  requestId: string;
  supplierId: string;
  version: number;
  storedObjectId: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  checksumSha256: string;
  reviewStatus: SupplierContractReviewStatus;
  reviewReason: string | null;
  uploadedAt: string;
  reviewedAt: string | null;
  reviewedBy: string | null;
}

export interface PrismSupplierCreativeSubmission {
  id: string;
  taskId: string;
  version: number;
  storedObjectId: string | null;
  note: string;
  submittedAt: string;
  submittedBy: string;
}

export interface PrismSupplierCreativeTask {
  id: string;
  eventId: string;
  requestId: string;
  supplierId: string;
  title: string;
  brief: string;
  dueAt: string | null;
  status: SupplierCreativeTaskStatus;
  supplierProgressNote: string;
  submissionVersion: number;
  submittedAt: string | null;
  reviewedAt: string | null;
  reviewedBy: string | null;
  reviewNote: string | null;
  submissions: PrismSupplierCreativeSubmission[];
  createdAt: string;
  updatedAt: string;
}

export interface PrismSupplierWorkflowSchedule {
  id: string;
  eventId: string;
  requestId: string;
  ingressAt: string;
  egressAt: string;
  location: string;
  notes: string;
  status: string;
  revision: number;
  acknowledgedRevision: number | null;
  acknowledgedAt: string | null;
  changeRequestedAt: string | null;
  changeRequestNote: string | null;
}

export interface PrismSupplierPayoutRecord {
  id: string;
  milestoneId: string;
  kind: SupplierPayoutRecordKind;
  amount: number;
  paymentDate: string;
  method: string;
  referenceNumber: string;
  notes: string | null;
  reversesRecordId: string | null;
  recordedAt: string;
}

export interface PrismSupplierPayableMilestone {
  id: string;
  eventId: string;
  requestId: string;
  quoteId: string;
  label: string;
  amount: number;
  dueDate: string | null;
  status: SupplierPayableStatus;
  amountReleased: number;
  remainingBalance: number;
  history: PrismSupplierPayoutRecord[];
  createdAt: string;
}

export interface PrismSupplierWorkflowWorkspace {
  schedules: PrismSupplierWorkflowSchedule[];
  contracts: PrismSupplierContractVersion[];
  creativeTasks: PrismSupplierCreativeTask[];
  payables: PrismSupplierPayableMilestone[];
}

export interface PrismPmcmSupplierWorkflowWorkspace {
  requestId: string;
  eventId: string;
  supplierId: string;
  supplierName: string;
  assignmentStatus: string;
  schedule: PrismSupplierWorkflowSchedule | null;
  contracts: PrismSupplierContractVersion[];
  creativeTasks: PrismSupplierCreativeTask[];
  payables: PrismSupplierPayableMilestone[];
}
