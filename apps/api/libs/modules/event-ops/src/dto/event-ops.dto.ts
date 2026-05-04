import {
  IsArray,
  IsEmail,
  IsIn,
  IsInt,
  IsISO8601,
  IsOptional,
  IsBoolean,
  IsObject,
  IsString,
  Min,
} from 'class-validator';

export class LoginDto {
  @IsEmail()
  email!: string;

  @IsString()
  password!: string;
}

export class RequestApprovalDto {
  @IsEmail()
  email!: string;

  @IsOptional()
  @IsBoolean()
  privacyConsentAccepted?: boolean;

  @IsOptional()
  @IsString()
  privacyNoticeVersion?: string;

  @IsOptional()
  @IsBoolean()
  marketingConsentAccepted?: boolean;
}

export class CreatePrivacyRequestDto {
  @IsString()
  subjectType!: string;

  @IsOptional()
  @IsEmail()
  subjectEmail?: string;

  @IsOptional()
  @IsString()
  subjectName?: string;

  @IsOptional()
  @IsString()
  eventId?: string;

  @IsIn(['access', 'correction', 'deletion', 'export'])
  requestType!: string;

  @IsOptional()
  @IsString()
  requestNotes?: string;
}

export class ReviewPrivacyRequestDto {
  @IsIn(['approved', 'rejected'])
  status!: string;

  @IsOptional()
  @IsString()
  reviewReason?: string;
}

export class ExecutePrivacyRequestDto {
  @IsOptional()
  @IsString()
  executionNotes?: string;
}

export class DemoActorDto {
  @IsOptional()
  @IsString()
  actorId?: string;

  @IsOptional()
  @IsIn(['pmcm-admin', 'client', 'supplier', 'coordinator', 'guest', 'system', 'unknown'])
  actorRole?: string;

  @IsOptional()
  @IsEmail()
  actorEmail?: string;

  @IsOptional()
  @IsString()
  actorName?: string;

  @IsOptional()
  @IsString()
  clientName?: string;

  @IsOptional()
  @IsString()
  supplierId?: string;

  @IsOptional()
  @IsString()
  coordinatorId?: string;

  @IsOptional()
  @IsString()
  eventId?: string;

  @IsOptional()
  @IsString()
  accessCode?: string;
}

export class FloorPlanSnapshotQueryDto extends DemoActorDto {
  @IsOptional()
  @IsIn(['submitted', 'approved'])
  type?: 'submitted' | 'approved';
}

export class CreateInquiryDto {
  @IsString()
  clientName!: string;

  @IsOptional()
  @IsString()
  companyName?: string;

  @IsEmail()
  email!: string;

  @IsString()
  eventName!: string;

  @IsOptional()
  @IsString()
  eventType?: string;

  @IsISO8601()
  eventDate!: string;

  @IsString()
  clientType!: string;

  @IsOptional()
  @IsIn(['Facebook', 'Website', 'BNI', 'Walk-In', 'Log on Behalf'])
  source?: string;

  @IsOptional()
  @IsString()
  referralDetails?: string;

  @IsOptional()
  @IsString()
  loggedByRole?: string;

  @IsOptional()
  @IsString()
  loggedByName?: string;

  @IsString()
  message!: string;

  @IsOptional()
  @IsBoolean()
  privacyConsentAccepted?: boolean;

  @IsOptional()
  @IsString()
  privacyNoticeVersion?: string;

  @IsOptional()
  @IsBoolean()
  marketingConsentAccepted?: boolean;
}

export class UpdateInquiryStatusDto {
  @IsIn(['new', 'accepted', 'pending', 'declined'])
  status!: string;

  @IsOptional()
  @IsIn(['Date Unavailable', 'Outside Service Scope', 'Budget Too Low', 'Prior Issue', 'Other'])
  declineReason?: string;
}

export class UploadConformeDto {
  @IsOptional()
  @IsString()
  type?: string;

  @IsString()
  fileName!: string;

  @IsOptional()
  @IsString()
  mimeType?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  sizeBytes?: number;
}

export class UploadMetadataDto {
  @IsString()
  fileName!: string;

  @IsOptional()
  @IsString()
  mimeType?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  sizeBytes?: number;
}

export class SubmitBriefingDto {
  @IsString()
  venue!: string;

  @IsInt()
  @Min(1)
  guestCount!: number;

  @IsString()
  budgetRange!: string;

  @IsArray()
  @IsString({ each: true })
  serviceRequirements!: string[];

  @IsString()
  notes!: string;
}

export class AddSupplierQuoteDto {
  @IsOptional()
  @IsString()
  requestId?: string;

  @IsOptional()
  @IsString()
  supplierId?: string;

  @IsOptional()
  @IsString()
  categoryId?: string;

  @IsOptional()
  @IsString()
  supplierName?: string;

  @IsOptional()
  @IsString()
  category?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  amount?: number;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  inclusions?: string[];

  @IsOptional()
  @IsString()
  paymentTerms?: string;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsOptional()
  @IsString()
  status?: string;
}

export class RequestSupplierQuotesDto {
  @IsString()
  categoryId!: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  supplierIds?: string[];

  @IsOptional()
  @IsBoolean()
  confidentialBid?: boolean;

  @IsOptional()
  @IsISO8601()
  deadline?: string;
}

export class SubmitSupplierQuoteDto {
  @IsInt()
  @Min(0)
  amount!: number;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  inclusions?: string[];

  @IsOptional()
  @IsString()
  paymentTerms?: string;

  @IsOptional()
  @IsString()
  notes?: string;
}

export class SupplierReadinessDto {
  @IsOptional()
  @IsString()
  notes?: string;
}

export class SupplierEventStatusDto {
  @IsIn(['arrived', 'set_up_ready', 'done_leaving'])
  status!: string;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsOptional()
  @IsObject()
  photo?: UploadMetadataDto;
}

export class CreateEventDayTaskDto {
  @IsString()
  title!: string;

  @IsOptional()
  @IsString()
  assignedRole?: string;

  @IsOptional()
  @IsString()
  ownerName?: string;

  @IsOptional()
  @IsString()
  priority?: string;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsOptional()
  @IsISO8601()
  dueAt?: string;

  @IsOptional()
  @IsISO8601()
  slaDueAt?: string;
}

export class UpdateEventDayTaskDto {
  @IsOptional()
  @IsIn(['open', 'in_progress', 'done', 'blocked'])
  status?: string;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsOptional()
  @IsString()
  ownerName?: string;

  @IsOptional()
  @IsISO8601()
  slaDueAt?: string;
}

export class CreateUrgentIssueDto {
  @IsString()
  title!: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsIn(['low', 'medium', 'high', 'critical'])
  severity?: string;

  @IsOptional()
  @IsString()
  ownerRole?: string;

  @IsOptional()
  @IsString()
  ownerName?: string;

  @IsOptional()
  @IsString()
  openedBy?: string;

  @IsOptional()
  @IsISO8601()
  slaDueAt?: string;
}

export class UpdateUrgentIssueDto {
  @IsOptional()
  @IsIn(['open', 'assigned', 'resolved', 'cancelled'])
  status?: string;

  @IsOptional()
  @IsString()
  ownerRole?: string;

  @IsOptional()
  @IsString()
  ownerName?: string;

  @IsOptional()
  @IsString()
  resolution?: string;

  @IsOptional()
  @IsISO8601()
  slaDueAt?: string;
}

export class EscalateLiveOpsRecordDto {
  @IsIn(['role_lead', 'pmcm', 'critical'])
  escalationLevel!: string;

  @IsString()
  notes!: string;

  @IsOptional()
  @IsString()
  ownerRole?: string;

  @IsOptional()
  @IsString()
  ownerName?: string;
}

export class ReplaceCoordinatorAssignmentDto {
  @IsString()
  replacementCoordinatorId!: string;

  @IsString()
  role!: string;

  @IsString()
  reason!: string;
}

export class UpdateCoordinatorAttendanceDto {
  @IsIn(['present', 'late', 'absent', 'replaced'])
  status!: string;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsOptional()
  @IsString()
  markedBy?: string;
}

export class VerifySupplierStatusDto {
  @IsIn(['self_reported', 'verified', 'disputed'])
  verificationStatus!: string;

  @IsOptional()
  @IsString()
  verifiedBy?: string;

  @IsOptional()
  @IsString()
  notes?: string;
}

export class SupplierContractUploadDto extends UploadMetadataDto {}

export class GuestCheckInDto {
  @IsString()
  guestName!: string;

  @IsOptional()
  @IsIn(['name_search', 'walk_in'])
  checkInMode?: string;

  @IsOptional()
  @IsBoolean()
  walkIn?: boolean;

  @IsOptional()
  @IsIn(['verified', 'flagged'])
  verificationStatus?: string;

  @IsOptional()
  @IsBoolean()
  privacyConsentAccepted?: boolean;

  @IsOptional()
  @IsString()
  privacyNoticeVersion?: string;

  @IsOptional()
  @IsBoolean()
  marketingConsentAccepted?: boolean;
}

export class GuestFeedbackDto {
  @IsString()
  guestName!: string;

  @IsInt()
  @Min(1)
  rating!: number;

  @IsOptional()
  @IsString()
  comment?: string;

  @IsOptional()
  @IsObject()
  photo?: UploadMetadataDto;

  @IsOptional()
  @IsObject()
  video?: UploadMetadataDto;

  @IsOptional()
  @IsBoolean()
  privacyConsentAccepted?: boolean;

  @IsOptional()
  @IsString()
  privacyNoticeVersion?: string;

  @IsOptional()
  @IsBoolean()
  marketingConsentAccepted?: boolean;
}

export class AiGovernanceDryRunDto {
  @IsOptional()
  @IsString()
  eventId?: string;

  @IsString()
  featureName!: string;

  @IsString()
  modelVersion!: string;

  @IsBoolean()
  zdrConfirmed!: boolean;

  @IsObject()
  payload!: Record<string, unknown>;
}

export class CreateSupplierDto {
  @IsString()
  categoryId!: string;

  @IsString()
  name!: string;

  @IsOptional()
  @IsString()
  contactName?: string;

  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  @IsIn(['tier_1', 'tier_2', 'pending_first_event'])
  tier?: string;

  @IsOptional()
  @IsBoolean()
  bniMember?: boolean;

  @IsOptional()
  @IsString()
  serviceInclusions?: string;

  @IsOptional()
  @IsString()
  performanceNotes?: string;
}

export class UpdateSupplierDto {
  @IsOptional()
  @IsBoolean()
  bniMember?: boolean;

  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  categoryId?: string;

  @IsOptional()
  @IsString()
  contactName?: string;

  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  @IsString()
  serviceInclusions?: string;

  @IsOptional()
  @IsString()
  performanceNotes?: string;
}

export class ChangeSupplierTierDto {
  @IsIn(['tier_1', 'tier_2', 'pending_first_event'])
  tier!: string;

  @IsString()
  reason!: string;
}

export class CreateSupplierReviewDto {
  @IsOptional()
  @IsString()
  eventId?: string;

  @IsInt()
  @Min(1)
  rating!: number;

  @IsString()
  notes!: string;

  @IsOptional()
  @IsString()
  reviewedBy?: string;
}

export class CreateSupplierCertificationDto {
  @IsString()
  fileName!: string;

  @IsString()
  documentType!: string;

  @IsOptional()
  @IsString()
  issuer?: string;

  @IsOptional()
  @IsISO8601()
  expiresAt?: string;

  @IsOptional()
  @IsIn(['submitted', 'verified', 'expired', 'rejected'])
  status?: string;

  @IsOptional()
  @IsString()
  notes?: string;
}

export class CreateCoordinatorAssignmentDto {
  @IsOptional()
  @IsString()
  coordinatorId?: string;

  @IsOptional()
  @IsString()
  coordinatorName?: string;

  @IsOptional()
  @IsString()
  role?: string;

  @IsOptional()
  @IsBoolean()
  overrideConflict?: boolean;
}

export class ResolveComplianceDto {
  @IsOptional()
  @IsIn(['resolve', 'override'])
  action?: string;

  @IsOptional()
  @IsString()
  note?: string;

  @IsOptional()
  @IsString()
  overrideReason?: string;

  @IsOptional()
  @IsString()
  actorName?: string;
}

export class CreateComplianceRuleDto {
  @IsOptional()
  @IsString()
  eventId?: string;

  @IsOptional()
  @IsString()
  eventType?: string;

  @IsOptional()
  @IsString()
  phase?: string;

  @IsOptional()
  @IsString()
  severity?: string;

  @IsOptional()
  @IsString()
  layer?: string;

  @IsString()
  conditionKey!: string;

  @IsString()
  title!: string;

  @IsOptional()
  @IsString()
  note?: string;

  @IsOptional()
  @IsBoolean()
  active?: boolean;
}

export class UpdateComplianceRuleDto extends CreateComplianceRuleDto {}

export class CreateBillingSourceDto {
  @IsOptional()
  @IsString()
  sourceType?: string;

  @IsString()
  sourceLabel!: string;

  @IsOptional()
  @IsString()
  sourceDocumentId?: string;

  @IsArray()
  lineItems!: Array<{ label: string; amount: number }>;

  @IsOptional()
  @IsArray()
  paymentSchedule?: Array<{ label: string; percentage: number; dueDate?: string }>;

  @IsOptional()
  @IsArray()
  paymentMethods?: Array<{ label: string; details: string }>;
}

export class ApproveBillingSourceDto {
  @IsOptional()
  @IsString()
  approvedBy?: string;

  @IsOptional()
  @IsString()
  approvalNotes?: string;
}

export class ArchiveEventDto {
  @IsOptional()
  @IsString()
  overrideReason?: string;

  @IsOptional()
  @IsString()
  actorName?: string;
}

export class MarkPaymentDto {
  @IsIn(['pending', 'paid', 'at_risk'])
  status!: string;
}

export class RecordPaymentDto {
  @IsInt()
  @Min(1)
  amountReceived!: number;

  @IsISO8601()
  paymentDate!: string;

  @IsIn(['Bank Transfer', 'GCash', 'Cheque'])
  paymentMethod!: string;

  @IsOptional()
  @IsString()
  referenceNumber?: string;
}

export class ListAuditLogsDto {
  @IsOptional()
  @IsString()
  query?: string;

  @IsOptional()
  @IsString()
  category?: string;

  @IsOptional()
  @IsString()
  eventId?: string;

  @IsOptional()
  @IsString()
  actor?: string;

  @IsOptional()
  @IsString()
  actionType?: string;

  @IsOptional()
  @IsString()
  severity?: string;

  @IsOptional()
  @IsString()
  dateRange?: string;

  @IsOptional()
  @IsString()
  from?: string;

  @IsOptional()
  @IsString()
  to?: string;

  @IsOptional()
  @IsString()
  limit?: string;
}

export class ExportAuditLogsDto extends ListAuditLogsDto {}

export class CreateFloorPlanDraftDto {
  @IsString()
  name!: string;

  @IsIn(['blank', 'preset', 'template', 'client_preference'])
  sourceType!: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  width?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  height?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  gridSize?: number;
}

export class CreateFloorPlanPreferenceDto {
  @IsString()
  name!: string;

  @IsString()
  seatingStyle!: string;

  @IsString()
  stagePreference!: string;

  @IsString()
  flowNotes!: string;

  @IsInt()
  @Min(1)
  guestCount!: number;

  @IsArray()
  @IsString({ each: true })
  constraints!: string[];

  @IsOptional()
  @IsString()
  notes?: string;
}
