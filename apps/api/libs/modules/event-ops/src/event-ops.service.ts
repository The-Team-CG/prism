import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import type {
  OpsAiApprovalRecord,
  OpsAiAuditLog,
  OpsBillingSource,
  OpsBriefing,
  OpsComplianceCheck,
  OpsComplianceRule,
  OpsDocument,
  OpsEvent,
  OpsEventInsight,
  OpsFloorPlanDraft,
  OpsGuestCheckIn,
  OpsGuestFeedback,
  OpsInquiry,
  OpsNotificationLog,
  OpsPostEventDocument,
  OpsSupplierQuote,
  OpsSupplierQuoteRequest,
  OpsUser,
} from '@prisma/client';
import { PrismaService, toPrismaJson } from '@prism/database';
import { DEFAULT_OWNER_ID, defaultSeatCategories } from '@prism/shared';
import { randomUUID } from 'node:crypto';
import { AuditService } from './services/audit.service';
import { AuthOperationsService } from './services/auth-operations.service';
import { AuthSecurityService } from './services/auth-security.service';
import {
  type AddSupplierQuoteInput,
  type ChangeSupplierTierInput,
  type CreateSupplierCertificationInput,
  type CreateSupplierInput,
  type CreateSupplierReviewInput,
  SuppliersService,
  type UpdateSupplierInput,
} from './services/suppliers.service';
import {
  type CreateCoordinatorAssignmentInput,
  CoordinatorsService,
} from './services/coordinators.service';
import { InquiriesService } from './services/inquiries.service';
import {
  AuditActionType,
  AuditCategory,
  CoordinatorAssignmentStatus,
  CoordinatorAttendanceStatus,
  EventDayTaskStatus,
  LiveOpsEscalationLevel,
  OpsUserRole,
  SupplierQuoteRequestStatus,
  SupplierQuoteStatus,
  SupplierVerificationStatus,
  UrgentIssueSeverity,
  UrgentIssueStatus,
  type OpsUserRole as OpsUserRoleValue,
} from './ops.constants';
import { LiveOperationsService } from './services/live-operations.service';
import { PrivacyOperationsService } from './services/privacy-operations.service';
import { SampleStateService } from './services/sample-state.service';
import { InquiryWorkflowService } from './services/inquiry-workflow.service';
import {
  EventAccessPolicyService,
  type EventOpsActorInput,
  type ResolvedEventOpsActor,
} from './services/event-access-policy.service';
import { EventLifecycleService } from './services/event-lifecycle.service';
import { FileRequirementsMatrixService } from './services/file-requirements-matrix.service';
import { NotificationOutboxService } from './services/notification-outbox.service';
import { WorkflowCommandService } from './services/workflow-command.service';
import { EventReadModelsService } from './services/event-read-models.service';
import { CommercialWorkflowService } from './services/commercial-workflow.service';
import { EventClosureService } from './services/event-closure.service';
import { PAREService } from './services/pare/pare.service';
import {
  type ApproveBillingSourceInput,
  BillingOperationsService,
  type CreateBillingSourceInput,
  type RecordPaymentInput,
} from './services/billing-operations.service';
import {
  type CreateFloorPlanDraftInput,
  type CreateFloorPlanPreferenceInput,
  FloorPlanWorkflowService,
} from './services/floor-plan-workflow.service';

type CreateInquiryInput = {
  clientName: string;
  companyName?: string;
  email: string;
  eventName: string;
  eventType?: string;
  eventDate: string;
  clientType: string;
  source?: string;
  referralDetails?: string;
  loggedByRole?: string;
  loggedByName?: string;
  message: string;
  privacyConsentAccepted?: boolean;
  privacyNoticeVersion?: string;
  marketingConsentAccepted?: boolean;
};

type RequestApprovalInput = {
  email: string;
  privacyConsentAccepted?: boolean;
  privacyNoticeVersion?: string;
  marketingConsentAccepted?: boolean;
};

type UpdateInquiryStatusInput = {
  status: string;
  declineReason?: string;
};

type SubmitBriefingInput = {
  venue: string;
  guestCount: number;
  budgetRange: string;
  serviceRequirements: string[];
  notes: string;
};

type RequestSupplierQuotesInput = {
  categoryId: string;
  supplierIds?: string[];
  confidentialBid?: boolean;
  deadline?: string;
};

type SubmitSupplierQuoteInput = {
  amount: number;
  inclusions?: string[];
  paymentTerms?: string;
  notes?: string;
};

type ComplianceRunInput = {
  phase?: string;
};

type ResolveComplianceInput = {
  action?: string;
  note?: string;
  overrideReason?: string;
  actorName?: string;
};

type CreateComplianceRuleInput = {
  eventId?: string;
  eventType?: string;
  phase?: string;
  severity?: string;
  layer?: string;
  conditionKey: string;
  title: string;
  note?: string;
  active?: boolean;
};

type UpdateComplianceRuleInput = Partial<CreateComplianceRuleInput>;

type ArchiveEventInput = {
  overrideReason?: string;
  actorName?: string;
};

type UploadMetadataInput = {
  fileName: string;
  mimeType?: string;
  sizeBytes?: number;
};

type SupplierReadinessInput = {
  notes?: string;
};

type SupplierEventStatusInput = {
  status: string;
  notes?: string;
  photo?: UploadMetadataInput;
};

type CreateEventDayTaskInput = {
  title: string;
  assignedRole?: string;
  ownerName?: string;
  priority?: string;
  notes?: string;
  dueAt?: string;
  slaDueAt?: string;
};

type UpdateEventDayTaskInput = {
  status?: string;
  notes?: string;
  ownerName?: string;
  slaDueAt?: string;
};

type CreateUrgentIssueInput = {
  title: string;
  description?: string;
  severity?: string;
  ownerRole?: string;
  ownerName?: string;
  openedBy?: string;
  slaDueAt?: string;
};

type UpdateUrgentIssueInput = {
  status?: string;
  ownerRole?: string;
  ownerName?: string;
  resolution?: string;
  slaDueAt?: string;
};

type UpdateCoordinatorAttendanceInput = {
  status: string;
  notes?: string;
  markedBy?: string;
};

type EscalateLiveOpsInput = {
  escalationLevel: string;
  notes: string;
  ownerRole?: string;
  ownerName?: string;
};

type ReplaceCoordinatorAssignmentInput = {
  replacementCoordinatorId: string;
  role: string;
  reason: string;
};

type VerifySupplierStatusInput = {
  verificationStatus: string;
  verifiedBy?: string;
  notes?: string;
};

type PrivacyInventoryInput = {
  eventId?: string;
};

type PrivacyRequestListInput = {
  eventId?: string;
  status?: string;
};

type CreatePrivacyRequestInput = {
  subjectType: string;
  subjectEmail?: string;
  subjectName?: string;
  eventId?: string;
  requestType: string;
  requestNotes?: string;
};

type ReviewPrivacyRequestInput = {
  status: string;
  reviewReason?: string;
};

type ExecutePrivacyRequestInput = {
  executionNotes?: string;
};

type GuestCheckInInput = {
  guestName: string;
  checkInMode?: string;
  walkIn?: boolean;
  verificationStatus?: string;
  privacyConsentAccepted?: boolean;
  privacyNoticeVersion?: string;
  marketingConsentAccepted?: boolean;
};

type GuestFeedbackInput = {
  guestName: string;
  rating: number;
  comment?: string;
  photo?: UploadMetadataInput;
  video?: UploadMetadataInput;
  privacyConsentAccepted?: boolean;
  privacyNoticeVersion?: string;
  marketingConsentAccepted?: boolean;
};

type AiGovernanceInput = {
  eventId?: string;
  featureName: string;
  modelVersion: string;
  zdrConfirmed: boolean;
  payload: Record<string, unknown>;
};

type AuditLogFilters = {
  query?: string;
  category?: string;
  eventId?: string;
  actor?: string;
  actionType?: string;
  severity?: string;
  dateRange?: string;
  from?: string;
  to?: string;
  limit?: string;
};

export type SampleActorInput = EventOpsActorInput;
type ResolvedSampleActor = ResolvedEventOpsActor;

type AuditLogInput = {
  eventId?: string;
  actor: string;
  actorRole?: string;
  actorEmail?: string;
  action: string;
  actionType?: string;
  category?: string;
  affectedType?: string;
  affectedId?: string;
  affectedLabel?: string;
  metadata?: Record<string, unknown>;
  ipAddress?: string;
  device?: string;
  severity?: string;
  previousHash?: string | null;
  createdAt?: Date;
};

type EventWithDrafts = OpsEvent & { floorPlanDrafts?: OpsFloorPlanDraft[] };

const MAX_UPLOAD_SIZE_BYTES = 25 * 1024 * 1024;
const ALLOWED_UPLOAD_TYPES: Record<string, string[]> = {
  'application/pdf': ['pdf'],
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['docx'],
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['xlsx'],
  'image/jpeg': ['jpg', 'jpeg'],
  'image/png': ['png'],
  'video/mp4': ['mp4'],
  'video/quicktime': ['mov'],
};

const SUPPLIER_CATEGORIES = [
  { id: 'supcat_production', slug: 'production', name: 'Production', acceptableMin: 180000, acceptableMax: 280000 },
  { id: 'supcat_technicals', slug: 'technicals', name: 'Technicals', acceptableMin: 120000, acceptableMax: 180000 },
  {
    id: 'supcat_digital_registration',
    slug: 'digital-registration',
    name: 'Digital Registration',
    acceptableMin: 45000,
    acceptableMax: 90000,
  },
  { id: 'supcat_documentation', slug: 'documentation', name: 'Documentation', acceptableMin: 65000, acceptableMax: 120000 },
  {
    id: 'supcat_food_beverages',
    slug: 'food-and-beverages',
    name: 'Food and Beverages',
    acceptableMin: 140000,
    acceptableMax: 220000,
  },
  { id: 'supcat_talents', slug: 'talents', name: 'Talents', acceptableMin: 50000, acceptableMax: 120000 },
  { id: 'supcat_logistics', slug: 'logistics', name: 'Logistics', acceptableMin: 30000, acceptableMax: 70000 },
  {
    id: 'supcat_program_manpower',
    slug: 'program-and-manpower',
    name: 'Program and Manpower',
    acceptableMin: 45000,
    acceptableMax: 95000,
  },
].map((category, index) => ({ ...category, sortOrder: index + 1 }));

const LOGIN_LOCKOUT_THRESHOLD = 5;
const LOGIN_LOCKOUT_MINUTES = 10;
const PERMANENT_LOCKOUT_THRESHOLD = 5;
const BULK_EXPORT_ALERT_THRESHOLD = 25;

const SEEDED_SUPPLIERS = [
  {
    id: 'sup_brightstage',
    categoryId: 'supcat_production',
    name: 'BrightStage Production',
    contactName: 'Ramon Cruz',
    email: 'ops@brightstage.test',
    phone: '+63 917 555 0101',
    tier: 'tier_1',
    bniMember: true,
    serviceInclusions: 'Stage fabrication, truss, production crew, ingress and egress supervision.',
    performanceNotes: 'Preferred production team for corporate ballrooms and controlled ingress windows.',
    certifications: ['DTI registration.pdf', 'Electrical safety clearance.pdf'],
  },
  {
    id: 'sup_northbay',
    categoryId: 'supcat_production',
    name: 'Northbay Builds',
    contactName: 'Paolo Reyes',
    email: 'hello@northbay.test',
    phone: '+63 917 555 0102',
    tier: 'tier_2',
    bniMember: false,
    serviceInclusions: 'Backup stage risers, scenic walls, carpentry support, and overnight setup crew.',
    performanceNotes: 'Reliable backup for smaller venue builds.',
    certifications: ['Warehouse safety checklist.pdf'],
  },
  {
    id: 'sup_sonicline',
    categoryId: 'supcat_technicals',
    name: 'SonicLine Technicals',
    contactName: 'Dane Villanueva',
    email: 'dane@sonicline.test',
    phone: '+63 917 555 0103',
    tier: 'tier_1',
    bniMember: false,
    serviceInclusions: 'Audio system, lights, LED wall, livestream feed, and technical director.',
    performanceNotes: 'Strong for keynote-heavy corporate programs.',
    certifications: ['AV crew roster.xlsx'],
  },
  {
    id: 'sup_stagepulse',
    categoryId: 'supcat_technicals',
    name: 'StagePulse AV',
    contactName: 'Mina Navarro',
    email: 'quotes@stagepulse.test',
    phone: '+63 917 555 0112',
    tier: 'tier_1',
    bniMember: false,
    serviceInclusions: 'Audio reinforcement, lighting board, LED wall operator, and technical standby.',
    performanceNotes: 'Competitive Tier 1 option for AV-heavy corporate programs.',
    certifications: ['Technical crew list.xlsx'],
  },
  {
    id: 'sup_xperto',
    categoryId: 'supcat_digital_registration',
    name: 'XPERTO Registration',
    contactName: 'Grace Lim',
    email: 'ops@xperto.test',
    phone: '+63 917 555 0104',
    tier: 'tier_1',
    bniMember: true,
    serviceInclusions: 'QR and name-search registration, device rental, registration staff briefing.',
    performanceNotes: 'Confirmed Tier 1 for digital registration.',
    certifications: ['Data privacy undertaking.pdf'],
  },
  {
    id: 'sup_clickpass',
    categoryId: 'supcat_digital_registration',
    name: 'Click Pass',
    contactName: 'Nico Uy',
    email: 'support@clickpass.test',
    phone: '+63 917 555 0105',
    tier: 'tier_2',
    bniMember: false,
    serviceInclusions: 'QR list import, on-site check-in laptop, and post-event attendance export.',
    performanceNotes: 'Confirmed Tier 2 backup for registration.',
    certifications: ['Sample attendance export.xlsx'],
  },
  {
    id: 'sup_lenscraft',
    categoryId: 'supcat_documentation',
    name: 'LensCraft Studios',
    contactName: 'Mika Santos',
    email: 'bookings@lenscraft.test',
    phone: '+63 917 555 0106',
    tier: 'tier_1',
    bniMember: false,
    serviceInclusions: 'Photo, video, same-day edit, highlight reel, and raw file turnover.',
    performanceNotes: 'Best fit for executive events with fast post-event deliverables.',
    certifications: ['Drone permit sample.pdf'],
  },
  {
    id: 'sup_harvesttable',
    categoryId: 'supcat_food_beverages',
    name: 'Harvest Table Catering',
    contactName: 'Lara Mendoza',
    email: 'events@harvesttable.test',
    phone: '+63 917 555 0107',
    tier: 'tier_1',
    bniMember: true,
    serviceInclusions: 'Buffet menu, VIP plated service, packed crew meals, and dietary tagging.',
    performanceNotes: 'Consistent client-facing service standards.',
    certifications: ['Sanitation permit.pdf'],
  },
  {
    id: 'sup_spotlight',
    categoryId: 'supcat_talents',
    name: 'Spotlight Talent Network',
    contactName: 'Iris Tan',
    email: 'talents@spotlight.test',
    phone: '+63 917 555 0108',
    tier: 'tier_1',
    bniMember: false,
    serviceInclusions: 'Hosts, performers, briefing coordination, call time reminders.',
    performanceNotes: 'Reliable for formal hosts and multilingual program needs.',
    certifications: ['Talent rate card.pdf'],
  },
  {
    id: 'sup_movefast',
    categoryId: 'supcat_logistics',
    name: 'MoveFast Logistics',
    contactName: 'Jun Ortiz',
    email: 'dispatch@movefast.test',
    phone: '+63 917 555 0109',
    tier: 'tier_1',
    bniMember: false,
    serviceInclusions: 'Transport booking, equipment pickup, egress dispatch, and delivery tracking.',
    performanceNotes: 'Strong for multi-stop equipment movement.',
    certifications: ['Vehicle list.xlsx'],
  },
  {
    id: 'sup_eventcore',
    categoryId: 'supcat_program_manpower',
    name: 'EventCore Manpower',
    contactName: 'Bea Garcia',
    email: 'team@eventcore.test',
    phone: '+63 917 555 0110',
    tier: 'tier_1',
    bniMember: false,
    serviceInclusions: 'Ushers, registration assistants, ingress runners, and program manpower.',
    performanceNotes: 'Dependable for medium-scale staffing grids.',
    certifications: ['Manpower briefing template.pdf'],
  },
  {
    id: 'sup_newwave',
    categoryId: 'supcat_documentation',
    name: 'New Wave Content',
    contactName: 'Toni Cruz',
    email: 'apply@newwave.test',
    phone: '+63 917 555 0111',
    tier: 'pending_first_event',
    bniMember: false,
    serviceInclusions: 'Short-form video capture, reels edit, and moderated content turnover.',
    performanceNotes: 'Approved application awaiting first PMCM event.',
    certifications: ['Portfolio links.pdf'],
  },
];

const COORDINATOR_ROLE_REQUIREMENTS = [
  { role: 'Floor Director', required: 1 },
  { role: 'Stage Director', required: 1 },
  { role: 'Registration Staff', required: 2 },
  { role: 'Ingress and Egress Assistant', required: 1 },
  { role: 'Event Day System Operator', required: 1 },
  { role: 'Usher', required: 2 },
  { role: 'General Coordinator', required: 1 },
];

const SEEDED_COORDINATORS = [
  {
    id: 'coord_marco',
    userId: 'usr_coord',
    name: 'Marco Santos',
    email: 'marco@pmcm.test',
    roleTags: ['Floor Director', 'Event Day System Operator', 'General Coordinator'],
    skillsTags: ['supplier coordination', 'client walkthrough', 'floorplan execution'],
  },
  {
    id: 'coord_bianca',
    name: 'Bianca Lim',
    email: 'bianca@pmcm.test',
    roleTags: ['Stage Director', 'Event Day System Operator'],
    skillsTags: ['program flow', 'AV cues', 'show calling'],
  },
  {
    id: 'coord_carla',
    name: 'Carla Dela Cruz',
    email: 'carla@pmcm.test',
    roleTags: ['Registration Staff', 'Usher'],
    skillsTags: ['guest verification', 'VIP handling', 'walk-in queue'],
  },
  {
    id: 'coord_juan',
    name: 'Juan Pascual',
    email: 'juan@pmcm.test',
    roleTags: ['Ingress and Egress Assistant', 'General Coordinator'],
    skillsTags: ['supplier ingress', 'logistics', 'vehicle dispatch'],
  },
  {
    id: 'coord_ana',
    name: 'Ana Macaraeg',
    email: 'ana.macaraeg@pmcm.test',
    roleTags: ['Registration Staff', 'Usher'],
    skillsTags: ['guest flow', 'name search', 'front desk'],
  },
  {
    id: 'coord_mark',
    name: 'Mark Reyes',
    email: 'mark.reyes@pmcm.test',
    roleTags: ['Floor Director', 'Stage Director'],
    skillsTags: ['venue layout', 'technical bridge', 'backstage'],
  },
];

function isoDate(value: Date) {
  return value.toISOString().slice(0, 10);
}

function timestamp(value: Date) {
  return value.toISOString();
}

function addDays(value: Date, days: number) {
  const next = new Date(value);
  next.setDate(next.getDate() + days);
  return next;
}

function parseDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) throw new BadRequestException('Invalid date');
  return date;
}

function addMinutes(value: Date, minutes: number) {
  const next = new Date(value);
  next.setMinutes(next.getMinutes() + minutes);
  return next;
}

@Injectable()
export class EventOpsService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(EventOpsService.name);
  private reminderTimer?: NodeJS.Timeout;
  private readonly auditService: AuditService;
  private readonly inquiriesService: InquiriesService;
  private readonly authOperationsService: AuthOperationsService;
  private readonly privacyOperationsService: PrivacyOperationsService;
  private readonly suppliersService: SuppliersService;
  private readonly coordinatorsService: CoordinatorsService;
  private readonly billingOperationsService: BillingOperationsService;
  private readonly floorPlanWorkflowService: FloorPlanWorkflowService;
  private readonly liveOperationsService: LiveOperationsService;
  private readonly eventAccessPolicyService: EventAccessPolicyService;
  private readonly eventLifecycleService: EventLifecycleService;
  private readonly fileRequirementsMatrixService: FileRequirementsMatrixService;
  private readonly notificationOutboxService: NotificationOutboxService;
  private readonly workflowCommandService: WorkflowCommandService;
  private readonly eventReadModelsService: EventReadModelsService;
  private readonly commercialWorkflowService: CommercialWorkflowService;
  private readonly eventClosureService: EventClosureService;
  private readonly pareService: PAREService;

  constructor(
    private readonly prisma: PrismaService,
    private readonly sampleStateService = new SampleStateService(prisma),
    private readonly inquiryWorkflowService = new InquiryWorkflowService(prisma),
  ) {
    this.auditService = new AuditService(prisma);
    this.eventAccessPolicyService = new EventAccessPolicyService(this.auditService);
    this.inquiriesService = new InquiriesService(prisma, this.auditService);
    this.authOperationsService = new AuthOperationsService(prisma, this.auditService, this.inquiriesService);
    this.privacyOperationsService = new PrivacyOperationsService(prisma, this.auditService);
    this.suppliersService = new SuppliersService(prisma);
    this.coordinatorsService = new CoordinatorsService(prisma);
    this.liveOperationsService = new LiveOperationsService();
    this.eventLifecycleService = new EventLifecycleService();
    this.fileRequirementsMatrixService = new FileRequirementsMatrixService(prisma);
    this.notificationOutboxService = new NotificationOutboxService(prisma);
    this.workflowCommandService = new WorkflowCommandService();
    this.floorPlanWorkflowService = new FloorPlanWorkflowService(
      prisma,
      this.auditService,
      this.notificationOutboxService,
      this.workflowCommandService,
    );
    this.billingOperationsService = new BillingOperationsService(
      prisma,
      this.auditService,
      this.notificationOutboxService,
      this.workflowCommandService,
    );
    this.eventReadModelsService = new EventReadModelsService(prisma, this.eventAccessPolicyService, this.suppliersService);
    this.commercialWorkflowService = new CommercialWorkflowService(
      prisma,
      this.auditService,
      this.notificationOutboxService,
      this.workflowCommandService,
    );
    this.eventClosureService = new EventClosureService(
      prisma,
      this.fileRequirementsMatrixService,
      this.eventLifecycleService,
      this.auditService,
      this.notificationOutboxService,
      this.workflowCommandService,
    );
    this.pareService = new PAREService(prisma);
  }

  private resolveActor(input: SampleActorInput = {}): ResolvedSampleActor {
    return this.eventAccessPolicyService.resolveActor(input);
  }

  private async requireActorRole(
    actor: ResolvedSampleActor,
    allowedRoles: OpsUserRoleValue[],
    resource: string,
    eventId?: string,
  ) {
    return this.eventAccessPolicyService.requireActorRole(actor, allowedRoles, resource, eventId);
  }

  private canReadEvent(actor: ResolvedSampleActor, event: Pick<OpsEvent, 'id' | 'clientName' | 'clientPortalStatus'>) {
    return this.eventAccessPolicyService.canReadEvent(actor, event);
  }

  private filterEventsForActor<T extends Pick<OpsEvent, 'id' | 'clientName' | 'clientPortalStatus'>>(
    actor: ResolvedSampleActor,
    events: T[],
  ) {
    return this.eventAccessPolicyService.filterEventsForActor(actor, events);
  }

  private sameText(left?: string | null, right?: string | null) {
    return this.eventAccessPolicyService.sameText(left, right);
  }

  private async recordForbiddenAccess(actor: ResolvedSampleActor, resource: string, eventId?: string) {
    return this.eventAccessPolicyService.recordForbiddenAccess(actor, resource, eventId);
  }

  async onModuleInit() {
    if (process.env.NODE_ENV !== 'production') {
      void this.ensureSeeded().catch((error: unknown) => {
        const message = error instanceof Error ? error.message : String(error);
        this.logger.warn(
          `Startup sample seed skipped; API will keep running, but data endpoints need the configured database. Reason: ${message}`,
        );
      });
    }

    if (process.env.PRISM_DISABLE_CONFORME_REMINDER_JOB === '1') return;

    this.reminderTimer = setInterval(() => {
      this.runConformeReminderSweep().catch(() => undefined);
    }, 60_000);
    this.reminderTimer.unref?.();
  }

  onModuleDestroy() {
    if (this.reminderTimer) clearInterval(this.reminderTimer);
  }

  private inquiryWorkflowContext() {
    return {
      inquiriesService: this.inquiriesService,
      resolveActor: (input?: SampleActorInput) => this.resolveActor(input),
      requireActorRole: (actor: ResolvedSampleActor, roles: OpsUserRoleValue[], resource: string) =>
        this.requireActorRole(actor, roles, resource),
      allowedAdminRoles: [OpsUserRole.PmcmAdmin, OpsUserRole.System],
      mapInquiry: (inquiry: unknown) => this.mapInquiry(inquiry as Parameters<typeof this.mapInquiry>[0]),
      mapDocument: (document: unknown) => this.mapDocument(document as Parameters<typeof this.mapDocument>[0]),
    };
  }

  async listPmcmDashboard(actorInput: SampleActorInput = {}) {
    const actor = this.resolveActor(actorInput);
    return this.eventReadModelsService.pmcmDashboard(actor, {
      coordinatorRoleRequirements: COORDINATOR_ROLE_REQUIREMENTS,
      mapUser: (user) => this.mapUser(user),
      mapInquiry: (inquiry) => this.mapInquiry(inquiry),
      mapEvent: (event) => this.mapEvent(event),
      mapDocument: (document) => this.mapDocument(document),
      mapBriefing: (briefing) => this.mapBriefing(briefing),
      mapSupplierQuoteRequest: (request) => this.mapSupplierQuoteRequest(request),
      mapSupplierQuote: (quote) => this.mapSupplierQuote(quote),
      mapCoordinator: (coordinator) => this.coordinatorsService.mapCoordinator(coordinator),
      mapCoordinatorAssignment: (assignment) => this.coordinatorsService.mapCoordinatorAssignment(assignment),
      mapComplianceRule: (rule) => this.mapComplianceRule(rule),
      mapComplianceCheck: (check) => this.mapComplianceCheck(check),
      mapBillingSource: (source) => this.billingOperationsService.mapBillingSource(source),
      mapBillingStatement: (statement) => this.billingOperationsService.mapBillingStatement(statement),
      mapPaymentMilestone: (payment, history) => this.billingOperationsService.mapPaymentMilestone(payment, history),
      mapPaymentRecord: (record) => this.billingOperationsService.mapPaymentRecord(record),
      mapPostEventDocument: (document) => this.mapPostEventDocument(document),
      mapEventInsight: (insight) => this.mapEventInsight(insight),
      mapFloorPlanDraft: (draft) => this.floorPlanWorkflowService.mapFloorPlanDraft(draft),
      mapAuditLog: (log) => this.auditService.mapAuditLog(log),
      mapNotificationLog: (log) => this.mapNotificationLog(log),
    });
  }

  async state() {
    return this.sampleStateService.state({
      runConformeReminderSweep: () => this.runConformeReminderSweep(),
      runPaymentRiskSweep: () => this.runPaymentRiskSweep(),
      listSupplierCategories: () => this.suppliersService.listSupplierCategories(),
      listSuppliers: () => this.suppliersService.listSuppliers(),
      coordinatorRoleRequirements: COORDINATOR_ROLE_REQUIREMENTS,
      mapUser: (user) => this.mapUser(user as Parameters<typeof this.mapUser>[0]),
      mapInquiry: (inquiry) => this.mapInquiry(inquiry as Parameters<typeof this.mapInquiry>[0]),
      mapEvent: (event) => this.mapEvent(event as Parameters<typeof this.mapEvent>[0]),
      mapDocument: (document) => this.mapDocument(document as Parameters<typeof this.mapDocument>[0]),
      mapBriefing: (briefing) => this.mapBriefing(briefing as Parameters<typeof this.mapBriefing>[0]),
      mapSupplierQuoteRequest: (request) =>
        this.mapSupplierQuoteRequest(request as Parameters<typeof this.mapSupplierQuoteRequest>[0]),
      mapSupplierQuote: (quote) => this.mapSupplierQuote(quote as Parameters<typeof this.mapSupplierQuote>[0]),
      mapCoordinator: (coordinator) =>
        this.coordinatorsService.mapCoordinator(coordinator as Parameters<typeof this.coordinatorsService.mapCoordinator>[0]),
      mapCoordinatorAssignment: (assignment) =>
        this.coordinatorsService.mapCoordinatorAssignment(
          assignment as Parameters<typeof this.coordinatorsService.mapCoordinatorAssignment>[0],
        ),
      mapComplianceRule: (rule) => this.mapComplianceRule(rule as Parameters<typeof this.mapComplianceRule>[0]),
      mapComplianceCheck: (check) => this.mapComplianceCheck(check as Parameters<typeof this.mapComplianceCheck>[0]),
      mapBillingSource: (source) =>
        this.billingOperationsService.mapBillingSource(
          source as Parameters<typeof this.billingOperationsService.mapBillingSource>[0],
        ),
      mapBillingStatement: (statement) =>
        this.billingOperationsService.mapBillingStatement(
          statement as Parameters<typeof this.billingOperationsService.mapBillingStatement>[0],
        ),
      mapPaymentMilestone: (payment, history) =>
        this.billingOperationsService.mapPaymentMilestone(
          payment as Parameters<typeof this.billingOperationsService.mapPaymentMilestone>[0],
          history as Parameters<typeof this.billingOperationsService.mapPaymentMilestone>[1],
        ),
      mapPaymentRecord: (record) =>
        this.billingOperationsService.mapPaymentRecord(
          record as Parameters<typeof this.billingOperationsService.mapPaymentRecord>[0],
        ),
      mapPostEventDocument: (document) =>
        this.mapPostEventDocument(document as Parameters<typeof this.mapPostEventDocument>[0]),
      mapEventInsight: (insight) => this.mapEventInsight(insight as Parameters<typeof this.mapEventInsight>[0]),
      mapFloorPlanDraft: (draft) =>
        this.floorPlanWorkflowService.mapFloorPlanDraft(
          draft as Parameters<typeof this.floorPlanWorkflowService.mapFloorPlanDraft>[0],
        ),
      mapAuditLog: (log) => this.auditService.mapAuditLog(log as Parameters<typeof this.auditService.mapAuditLog>[0]),
      mapNotificationLog: (log) => this.mapNotificationLog(log as Parameters<typeof this.mapNotificationLog>[0]),
    });
  }

  async resetSample() {
    return this.sampleStateService.resetSample(() => this.seedSample(), () => this.state());
  }

  async seedSampleState() {
    return this.sampleStateService.seedSampleState(() => this.ensureSeeded(), () => this.state());
  }

  async login(email: string, password: string) {
    return this.authOperationsService.login(email, password);
  }

  async requestApproval(input: string | RequestApprovalInput) {
    return this.authOperationsService.requestApproval(input);
  }

  async listApprovalRequests() {
    return this.authOperationsService.listApprovalRequests();
  }

  async listLoginHistory(userId: string) {
    return this.authOperationsService.listLoginHistory(userId);
  }

  async listAuditLogs(input: AuditLogFilters = {}, actorInput: SampleActorInput = input) {
    const actor = this.resolveActor(actorInput);
    await this.requireActorRole(actor, [OpsUserRole.PmcmAdmin, OpsUserRole.System], 'audit logs');

    return this.auditService.listAuditLogs(input);
  }

  async exportAuditLogs(input: AuditLogFilters = {}, actorInput: SampleActorInput = input) {
    const actor = this.resolveActor(actorInput);
    await this.requireActorRole(actor, [OpsUserRole.PmcmAdmin, OpsUserRole.System], 'audit export');

    return this.auditService.exportAuditLogs(input);
  }

  async listSecurityAlerts(actorInput: SampleActorInput = {}) {
    const actor = this.resolveActor(actorInput);
    await this.requireActorRole(actor, [OpsUserRole.PmcmAdmin, OpsUserRole.System], 'security alerts');

    return this.auditService.listSecurityAlerts();
  }

  async verifyAuditIntegrity(actorInput: SampleActorInput = {}) {
    const actor = this.resolveActor(actorInput);
    await this.requireActorRole(actor, [OpsUserRole.PmcmAdmin, OpsUserRole.System], 'audit integrity');

    return this.auditService.verifyIntegrity();
  }

  async getPrivacyInventory(input: PrivacyInventoryInput = {}, actorInput: SampleActorInput = input) {
    const actor = this.resolveActor(actorInput);
    await this.requireActorRole(actor, [OpsUserRole.PmcmAdmin, OpsUserRole.System], 'privacy inventory');
    const [events, inquiries, approvalRequests, guestCheckIns, guestFeedback] = await Promise.all([
      this.prisma.opsEvent.findMany({
        where: input.eventId ? { id: input.eventId } : {},
        orderBy: { eventDate: 'asc' },
      }),
      this.prisma.opsInquiry.findMany(),
      this.prisma.opsApprovalRequest.findMany(),
      this.prisma.opsGuestCheckIn.findMany({
        where: input.eventId ? { eventId: input.eventId } : {},
      }),
      this.prisma.opsGuestFeedback.findMany({
        where: input.eventId ? { eventId: input.eventId } : {},
      }),
    ]);

    const eventsInventory = events.map((event: OpsEvent) => {
      const inquiry = inquiries.find((item: OpsInquiry) => item.id === event.inquiryId);
      const checkIns = guestCheckIns.filter((item: OpsGuestCheckIn) => item.eventId === event.id);
      const feedback = guestFeedback.filter((item: OpsGuestFeedback) => item.eventId === event.id);
      const surfaces = [
        this.privacySurface('inquiry', inquiry ? 1 : 0, ['client_contact', 'event_details', 'consent'], [
          inquiry,
        ]),
        this.privacySurface('guest_check_in', checkIns.length, ['guest_name', 'attendance', 'consent'], checkIns),
        this.privacySurface('guest_feedback', feedback.length, ['guest_name', 'rating', 'comment', 'media_metadata', 'consent'], feedback),
      ];
      return {
        eventId: event.id,
        eventName: event.eventName,
        clientName: event.clientName,
        dataCategories: Array.from(new Set(surfaces.flatMap((surface) => surface.dataCategories))),
        recordCount: surfaces.reduce((total, surface) => total + surface.recordCount, 0),
        surfaces,
        retentionNotes: 'Event personal-data records stay with the event until PMCM defines the final archive retention policy.',
      };
    });

    return {
      generatedAt: new Date().toISOString(),
      events: eventsInventory,
      globalSurfaces: [
        this.privacySurface('account_approval_request', approvalRequests.length, ['email', 'role', 'organization', 'consent'], approvalRequests),
      ],
      retentionNotes: [
        'Sample personal-data records are retained with the event record until archive policy is finalized.',
        'Guest feedback remains moderated and is never published automatically.',
        'AI use remains blocked unless ZDR, sanitizer, audit, and human approval records are present.',
      ],
    };
  }

  async listPrivacyRetentionPolicies(actorInput: SampleActorInput = {}) {
    const actor = this.resolveActor(actorInput);
    await this.requireActorRole(actor, [OpsUserRole.PmcmAdmin, OpsUserRole.System], 'privacy retention policies');

    return this.privacyOperationsService.listRetentionPolicies();
  }

  async listPrivacyRequests(input: PrivacyRequestListInput = {}, actorInput: SampleActorInput = input) {
    const actor = this.resolveActor(actorInput);
    await this.requireActorRole(actor, [OpsUserRole.PmcmAdmin, OpsUserRole.System], 'privacy requests');

    return this.privacyOperationsService.listRequests(input);
  }

  async createPrivacyRequest(input: CreatePrivacyRequestInput, actorInput: SampleActorInput = {}) {
    const actor = this.resolveActor(actorInput);
    await this.requireActorRole(actor, [OpsUserRole.PmcmAdmin, OpsUserRole.System], 'privacy requests');

    return this.privacyOperationsService.createRequest(input, { name: actor.name, role: actor.role });
  }

  async reviewPrivacyRequest(requestId: string, input: ReviewPrivacyRequestInput, actorInput: SampleActorInput = {}) {
    const actor = this.resolveActor(actorInput);
    await this.requireActorRole(actor, [OpsUserRole.PmcmAdmin, OpsUserRole.System], 'privacy request review');

    return this.privacyOperationsService.reviewRequest(requestId, input, { name: actor.name, role: actor.role });
  }

  async executePrivacyRequest(requestId: string, input: ExecutePrivacyRequestInput = {}, actorInput: SampleActorInput = {}) {
    const actor = this.resolveActor(actorInput);
    await this.requireActorRole(actor, [OpsUserRole.PmcmAdmin, OpsUserRole.System], 'privacy request execution');

    return this.privacyOperationsService.executeRequest(requestId, input, { name: actor.name, role: actor.role });
  }

  async listInquiries(actorInput: SampleActorInput = {}) {
    return this.inquiryWorkflowService.listInquiries(actorInput, this.inquiryWorkflowContext());
  }

  async listOnboarding(actorInput: SampleActorInput = {}) {
    const actor = this.resolveActor(actorInput);
    await this.requireActorRole(actor, [OpsUserRole.PmcmAdmin, OpsUserRole.System], 'onboarding');

    const [inquiries, events, documents] = await Promise.all([
      this.prisma.opsInquiry.findMany({ orderBy: { createdAt: 'desc' } }),
      this.prisma.opsEvent.findMany({
        include: { floorPlanDrafts: { orderBy: { updatedAt: 'desc' } } },
        orderBy: { eventDate: 'asc' },
      }),
      this.prisma.opsDocument.findMany({ orderBy: { uploadedAt: 'desc' } }),
    ]);

    return {
      inquiries: inquiries.map((inquiry) => this.mapInquiry(inquiry)),
      events: events.map((event) => this.mapEvent(event)),
      documents: documents.map((document) => this.mapDocument(document)),
    };
  }

  async approveApprovalRequest(requestId: string) {
    return this.authOperationsService.approveApprovalRequest(requestId);
  }

  async declineApprovalRequest(requestId: string) {
    return this.authOperationsService.declineApprovalRequest(requestId);
  }

  async createInquiry(input: CreateInquiryInput) {
    return this.inquiryWorkflowService.createInquiry(input, this.inquiryWorkflowContext());
  }

  async logInquiryOnBehalf(input: CreateInquiryInput, actorInput: SampleActorInput = {}) {
    return this.inquiryWorkflowService.logInquiryOnBehalf(input, actorInput, this.inquiryWorkflowContext());
  }

  async updateInquiryStatus(inquiryId: string, input: UpdateInquiryStatusInput) {
    return this.inquiryWorkflowService.updateInquiryStatus(inquiryId, input, this.inquiryWorkflowContext());
  }

  async sendConformeReminder(inquiryId: string) {
    return this.inquiryWorkflowService.sendConformeReminder(inquiryId, this.inquiryWorkflowContext());
  }

  private async runConformeReminderSweep() {
    return this.inquiriesService.runConformeReminderSweep();
  }

  private async runPaymentRiskSweep() {
    const now = new Date();
    const threshold = addDays(now, 2);
    const events = await this.prisma.opsEvent.findMany({
      where: {
        archived: false,
        eventDate: {
          gte: now,
          lte: threshold,
        },
      },
      select: { id: true, eventName: true },
    });

    for (const event of events) {
      const milestones = await this.prisma.opsPaymentMilestone.findMany({
        where: { eventId: event.id },
      });
      const balance = milestones.find((milestone) => milestone.label.toLowerCase().includes('balance'));
      if (!balance || balance.status === 'paid' || balance.remainingBalance <= 0 || balance.status === 'at_risk') {
        continue;
      }

      await this.prisma.$transaction(async (tx) => {
        await tx.opsPaymentMilestone.update({
          where: { id: balance.id },
          data: { status: 'at_risk' },
        });
        await tx.opsAuditLog.create({
          data: {
            id: `aud_${randomUUID()}`,
            eventId: event.id,
            actor: 'System',
            action: `Payment at risk for ${event.eventName}`,
            category: 'finance',
            actionType: 'update',
            affectedType: 'payment_milestone',
            affectedId: balance.id,
            affectedLabel: balance.label,
            severity: 'warning',
          },
        });
      });
    }
  }

  async queueNotification(
    eventId: string | undefined,
    recipient: string,
    message: string,
    channel: 'email' | 'viber' = 'email',
    options: { forceFail?: boolean } = {},
  ) {
    return this.notificationOutboxService.queue(eventId, recipient, message, channel, options);
  }

  async processNotificationQueue() {
    const processed = await this.notificationOutboxService.processQueued();
    return processed.map((item) => this.mapNotificationLog(item));
  }

  async acknowledgeNotification(notificationId: string) {
    const notification = await this.notificationOutboxService.acknowledge(notificationId);
    return this.mapNotificationLog(notification);
  }

  validateUploadMetadata(input: UploadMetadataInput, prefix: string) {
    const fileName = input.fileName?.trim();
    if (!fileName) throw new BadRequestException('File name is required');
    const extension = fileName.split('.').pop()?.toLowerCase() ?? '';
    const mimeType = input.mimeType?.trim().toLowerCase() ?? '';
    const allowedExtensions = ALLOWED_UPLOAD_TYPES[mimeType];
    if (!allowedExtensions || !allowedExtensions.includes(extension)) {
      throw new BadRequestException('Unsupported file type');
    }
    const sizeBytes = input.sizeBytes ?? 0;
    if (sizeBytes <= 0) throw new BadRequestException('File size is required');
    if (sizeBytes > MAX_UPLOAD_SIZE_BYTES) {
      throw new BadRequestException('File exceeds allowed size');
    }
    const generatedFileName = `${randomUUID()}.${extension}`;
    const cleanPrefix = prefix.replace(/^\/+|\/+$/g, '');
    return {
      originalFileName: fileName.replace(/^.*[\\/]/, ''),
      generatedFileName,
      mimeType,
      sizeBytes,
      storageBucket: 'document-vault',
      storageKey: `${cleanPrefix}/${generatedFileName}`,
      validationStatus: 'accepted',
    };
  }

  async uploadConforme(
    inquiryId: string,
    input: { type?: string; fileName: string; mimeType?: string; sizeBytes?: number },
  ) {
    return this.inquiryWorkflowService.uploadConforme(inquiryId, input, this.inquiryWorkflowContext());
  }

  async listEvents(actorInput: SampleActorInput = {}) {
    const actor = this.resolveActor(actorInput);
    const events = await this.prisma.opsEvent.findMany({
      where: { archived: false },
      include: { floorPlanDrafts: { orderBy: { updatedAt: 'desc' } } },
      orderBy: { eventDate: 'asc' },
    });

    return this.filterEventsForActor(actor, events).map((event) => this.mapEvent(event));
  }

  async getEventDetail(eventId: string, actorInput: SampleActorInput = {}) {
    const actor = this.resolveActor(actorInput);
    const event = await this.prisma.opsEvent
      .findUnique({
        where: { id: eventId },
        include: { floorPlanDrafts: { orderBy: { updatedAt: 'desc' } } },
      })
      .catch(() => null);

    if (!event) throw new NotFoundException('Event not found');
    if (!this.canReadEvent(actor, event)) {
      await this.recordForbiddenAccess(actor, 'event detail', event.id);
      throw new ForbiddenException(`${actor.role} cannot access this event`);
    }

    return this.mapEvent(event);
  }

  async getDefenseReadiness(eventId: string, actorInput: SampleActorInput = {}) {
    const actor = this.resolveActor(actorInput);
    await this.requireActorRole(actor, [OpsUserRole.PmcmAdmin, OpsUserRole.System], 'defense readiness', eventId);
    const event = await this.requireEvent(eventId);
    const [
      briefings,
      floorPlanDrafts,
      quoteRequests,
      supplierQuotes,
      coordinatorAssignments,
      eventDayTasks,
      urgentIssues,
      billingStatements,
      paymentMilestones,
      guestCheckIns,
      guestFeedback,
      closeGates,
    ] = await Promise.all([
      this.prisma.opsBriefing.findMany({ where: { eventId }, orderBy: { submittedAt: 'desc' } }),
      this.prisma.opsFloorPlanDraft.findMany({ where: { eventId }, orderBy: { updatedAt: 'desc' } }),
      this.prisma.opsSupplierQuoteRequest.findMany({ where: { eventId }, orderBy: { createdAt: 'desc' } }),
      this.prisma.opsSupplierQuote.findMany({ where: { eventId }, orderBy: { createdAt: 'desc' } }),
      this.prisma.opsCoordinatorAssignment.findMany({ where: { eventId }, orderBy: { createdAt: 'desc' } }),
      this.prisma.opsEventDayTask.findMany({ where: { eventId }, orderBy: { createdAt: 'desc' } }),
      this.prisma.opsUrgentIssue.findMany({ where: { eventId }, orderBy: { createdAt: 'desc' } }),
      this.prisma.opsBillingStatement.findMany({ where: { eventId }, orderBy: { generatedAt: 'desc' } }),
      this.prisma.opsPaymentMilestone.findMany({ where: { eventId }, orderBy: { createdAt: 'asc' } }),
      this.prisma.opsGuestCheckIn.findMany({ where: { eventId }, orderBy: { checkedInAt: 'desc' } }),
      this.prisma.opsGuestFeedback.findMany({ where: { eventId }, orderBy: { submittedAt: 'desc' } }),
      this.getCloseGates(eventId),
    ]);

    const approvedFloorplan = floorPlanDrafts.find((draft: any) => draft.status === 'approved');
    const selectedSupplierCount = supplierQuotes.filter((quote: any) => ['selected', 'locked'].includes(quote.status)).length;
    const pendingCoordinatorCount = coordinatorAssignments.filter((assignment: any) =>
      ['pending', 'pending_acknowledgement'].includes(assignment.status),
    ).length;
    const openTaskCount = eventDayTasks.filter((task: any) => !['done', 'cancelled'].includes(task.status)).length;
    const openIssueCount = urgentIssues.filter((issue: any) => !['resolved', 'closed'].includes(issue.status)).length;
    const unpaidMilestoneCount = paymentMilestones.filter((milestone: any) =>
      milestone.status !== 'paid' || milestone.remainingBalance > 0,
    ).length;
    const pendingFeedbackCount = guestFeedback.filter((feedback: any) => feedback.moderationStatus === 'pending_review').length;

    const nextActions = [
      {
        key: 'briefing',
        label: 'Client briefing',
        detail: briefings.length > 0 ? 'Briefing is on file for planning.' : 'Submit the confirmed venue, pax, budget, and service notes.',
        status: briefings.length > 0 ? 'done' : 'blocked',
        targetTab: 'briefing',
      },
      {
        key: 'floorplan',
        label: 'Official floorplan',
        detail: approvedFloorplan ? 'Approved PMCM floorplan is ready for client review.' : 'Create, submit, and approve the official PMCM layout.',
        status: approvedFloorplan ? 'done' : floorPlanDrafts.length > 0 ? 'attention' : 'blocked',
        targetTab: 'floorplans',
      },
      {
        key: 'suppliers',
        label: 'Supplier selection',
        detail:
          selectedSupplierCount > 0
            ? `${selectedSupplierCount} selected supplier quote(s) are locked.`
            : quoteRequests.length > 0
              ? 'Quote requests are out; select winning supplier quotes.'
              : 'Send scoped quote requests to Tier 1 or backup suppliers.',
        status: selectedSupplierCount > 0 ? 'done' : quoteRequests.length > 0 ? 'attention' : 'blocked',
        targetTab: 'suppliers',
      },
      {
        key: 'coordinators',
        label: 'Coordinator readiness',
        detail:
          coordinatorAssignments.length === 0
            ? 'Assign event-day roles before the live run.'
            : pendingCoordinatorCount > 0
              ? `${pendingCoordinatorCount} coordinator assignment(s) still need acknowledgment.`
              : 'Coordinator assignments are acknowledged.',
        status: coordinatorAssignments.length === 0 ? 'blocked' : pendingCoordinatorCount > 0 ? 'attention' : 'done',
        targetTab: 'coordinators',
      },
      {
        key: 'billing',
        label: 'Billing and payments',
        detail:
          billingStatements.length === 0
            ? 'Generate a billing statement from the approved CE/proposal source.'
            : unpaidMilestoneCount > 0
              ? `${unpaidMilestoneCount} payment milestone(s) still need recording.`
              : 'Billing statement and payment schedule are closed.',
        status: billingStatements.length === 0 ? 'attention' : unpaidMilestoneCount > 0 ? 'attention' : 'done',
        targetTab: 'billing',
      },
      {
        key: 'live-ops',
        label: 'Event-day operations',
        detail:
          openTaskCount + openIssueCount > 0
            ? `${openTaskCount} open task(s) and ${openIssueCount} urgent issue(s) need attention.`
            : 'Live-ops board is ready for supplier, coordinator, and attendance signals.',
        status: openIssueCount > 0 ? 'attention' : 'done',
        targetTab: 'live-ops',
      },
      {
        key: 'closure',
        label: 'Closure and archive',
        detail: closeGates.ready
          ? 'Close gates are complete; archive can proceed.'
          : `Close gate(s) still open: ${closeGates.missingKeys.join(', ') || 'none'}.`,
        status: closeGates.ready ? 'done' : 'attention',
        targetTab: 'closure',
      },
    ];
    const doneCount = nextActions.filter((action) => action.status === 'done').length;
    const overallStatus = nextActions.some((action) => action.status === 'blocked')
      ? 'blocked'
      : nextActions.some((action) => action.status === 'attention')
        ? 'attention'
        : 'ready';
    const lifecycleStage =
      event.archived
        ? 'archive'
        : !briefings.length
          ? 'briefing'
          : !approvedFloorplan
            ? 'planning'
            : selectedSupplierCount === 0 || pendingCoordinatorCount > 0
              ? 'supplier-coordinator-setup'
              : openTaskCount + openIssueCount > 0
                ? 'event-day'
                : closeGates.ready
                  ? 'closure-ready'
                  : 'closure';

    return {
      eventId,
      eventName: event.eventName,
      overallStatus,
      lifecycleStage,
      score: Math.round((doneCount / nextActions.length) * 100),
      summary: {
        briefingSubmitted: briefings.length > 0,
        officialFloorplanApproved: Boolean(approvedFloorplan),
        quoteRequests: quoteRequests.length,
        selectedSuppliers: selectedSupplierCount,
        coordinatorAssignments: coordinatorAssignments.length,
        pendingCoordinatorAcknowledgments: pendingCoordinatorCount,
        openLiveOpsItems: openTaskCount + openIssueCount,
        billingStatements: billingStatements.length,
        unpaidMilestones: unpaidMilestoneCount,
        guestAttendanceCount: guestCheckIns.length,
        pendingFeedbackModeration: pendingFeedbackCount,
        closureReady: closeGates.ready,
      },
      nextActions,
      liveAiBlocked: true,
      deferredScope: [
        'Live AI calls',
        'QR scanning',
        'Production notification adapters',
        'External auth',
        'Canva/Zoom integrations',
      ],
      generatedAt: timestamp(new Date()),
    };
  }

  async listBilling(actorInput: SampleActorInput = {}) {
    const actor = this.resolveActor(actorInput);
    return this.eventReadModelsService.billing(actor, {
      mapEvent: (event) => this.mapEvent(event),
      mapBillingSource: (source) => this.billingOperationsService.mapBillingSource(source),
      mapBillingStatement: (statement) => this.billingOperationsService.mapBillingStatement(statement),
      mapPaymentMilestone: (payment, history) => this.billingOperationsService.mapPaymentMilestone(payment, history),
      mapPaymentRecord: (record) => this.billingOperationsService.mapPaymentRecord(record),
    });
  }

  async listClientWorkspace(actorInput: SampleActorInput = {}) {
    const actor = this.resolveActor(actorInput);
    return this.eventReadModelsService.clientWorkspace(actor, {
      mapEvent: (event) => this.mapEvent(event),
      mapDocument: (document) => this.mapDocument(document),
      mapBriefing: (briefing) => this.mapBriefing(briefing),
      mapBillingStatement: (statement) => this.billingOperationsService.mapBillingStatement(statement),
      mapPaymentMilestone: (payment, history) => this.billingOperationsService.mapPaymentMilestone(payment, history),
      mapFloorPlanDraft: (draft) => this.floorPlanWorkflowService.mapFloorPlanDraft(draft),
      mapAuditLog: (log) => this.auditService.mapAuditLog(log),
    });
  }

  async getGuestEventByAccessCode(accessCode: string) {
    const event = await this.resolveGuestEventByAccessCode(accessCode);
    const attendanceCount = await this.prisma.opsGuestCheckIn.count({ where: { eventId: event.id } });

    return this.mapGuestEvent(event, attendanceCount);
  }

  async checkInGuestByAccessCode(accessCode: string, input: GuestCheckInInput) {
    const event = await this.resolveGuestEventByAccessCode(accessCode);
    const guestName = input.guestName?.trim();
    if (!guestName) throw new BadRequestException('Guest name is required');
    if (!input.privacyConsentAccepted) {
      throw new BadRequestException('Privacy consent is required before guest check-in');
    }
    const checkIn = await this.prisma.opsGuestCheckIn.create({
      data: {
        id: `gci_${randomUUID()}`,
        eventId: event.id,
        guestName,
        checkInMode: input.checkInMode ?? (input.walkIn ? 'walk_in' : 'name_search'),
        status: 'checked_in',
        walkIn: Boolean(input.walkIn),
        verificationStatus: input.verificationStatus ?? (input.walkIn ? 'flagged' : 'verified'),
        privacyConsentAccepted: true,
        privacyNoticeVersion: input.privacyNoticeVersion ?? '2026-05-01',
        marketingConsentAccepted: Boolean(input.marketingConsentAccepted),
      },
    });
    await this.audit(event.id, guestName, `Guest checked in: ${guestName}`, {
      actorRole: OpsUserRole.Guest,
      category: AuditCategory.Events,
      actionType: AuditActionType.Update,
      affectedType: 'guest_check_in',
      affectedId: checkIn.id,
      affectedLabel: guestName,
      metadata: { walkIn: Boolean(input.walkIn), checkInMode: input.checkInMode ?? 'name_search' },
    });
    return this.mapGuestCheckIn(checkIn);
  }

  async submitGuestFeedbackByAccessCode(accessCode: string, input: GuestFeedbackInput) {
    const event = await this.resolveGuestEventByAccessCode(accessCode);
    const guestName = input.guestName?.trim();
    if (!guestName) throw new BadRequestException('Guest name is required');
    if (!input.privacyConsentAccepted) {
      throw new BadRequestException('Privacy consent is required before guest feedback submission');
    }
    if (!Number.isInteger(input.rating) || input.rating < 1 || input.rating > 5) {
      throw new BadRequestException('Rating must be between 1 and 5');
    }
    const photo = input.photo
      ? this.validateUploadMetadata(input.photo, `events/${event.id}/guest-feedback`)
      : null;
    const video = input.video
      ? this.validateUploadMetadata(input.video, `events/${event.id}/guest-feedback`)
      : null;
    const feedback = await this.prisma.opsGuestFeedback.create({
      data: {
        id: `gfb_${randomUUID()}`,
        eventId: event.id,
        guestName,
        rating: input.rating,
        comment: input.comment?.trim() ?? '',
        photoFileName: photo?.generatedFileName ?? null,
        videoFileName: video?.generatedFileName ?? null,
        privacyConsentAccepted: true,
        privacyNoticeVersion: input.privacyNoticeVersion ?? '2026-05-01',
        marketingConsentAccepted: Boolean(input.marketingConsentAccepted),
        moderationStatus: 'pending_review',
      },
    });
    await this.audit(event.id, guestName, `Guest feedback submitted: ${guestName}`, {
      actorRole: OpsUserRole.Guest,
      category: AuditCategory.Events,
      actionType: AuditActionType.Create,
      affectedType: 'guest_feedback',
      affectedId: feedback.id,
      affectedLabel: guestName,
      metadata: { rating: input.rating, moderationStatus: 'pending_review' },
    });
    return this.mapGuestFeedback(feedback);
  }

  async getEventLiveOps(eventId: string, actorInput: SampleActorInput = {}) {
    const actor = this.resolveActor(actorInput);
    await this.requireActorRole(
      actor,
      [OpsUserRole.PmcmAdmin, OpsUserRole.System, OpsUserRole.Coordinator],
      'event-day live operations',
      eventId,
    );

    const event = await this.requireEvent(eventId);
    let coordinatorAssignment: any | null = null;
    if (actor.role === OpsUserRole.Coordinator) {
      coordinatorAssignment = await this.requireCoordinatorAssignmentForEvent(eventId, actor);
    }

    const [tasks, urgentIssues, supplierRequests, coordinatorAssignments, guestCheckIns, eventDayLogs] =
      await Promise.all([
        this.prisma.opsEventDayTask.findMany({ where: { eventId }, orderBy: { createdAt: 'asc' } }),
        this.prisma.opsUrgentIssue.findMany({ where: { eventId }, orderBy: { createdAt: 'desc' } }),
        this.prisma.opsSupplierQuoteRequest.findMany({ where: { eventId }, orderBy: { createdAt: 'desc' } }),
        this.prisma.opsCoordinatorAssignment.findMany({ where: { eventId }, orderBy: { createdAt: 'asc' } }),
        this.prisma.opsGuestCheckIn.findMany({ where: { eventId }, orderBy: { checkedInAt: 'desc' } }),
        this.prisma.opsEventDayLog.findMany({ where: { eventId }, orderBy: { createdAt: 'desc' }, take: 50 }),
      ]);

    const roleScopedTasks = coordinatorAssignment
      ? tasks.filter(
          (task: any) =>
            this.sameText(task.assignedRole, coordinatorAssignment.role) ||
            this.sameText(task.ownerName, coordinatorAssignment.coordinatorName) ||
            this.sameText(task.assignedRole, 'General Coordinator'),
        )
      : tasks;
    const roleScopedIssues = coordinatorAssignment
      ? urgentIssues.filter(
          (issue: any) =>
            !issue.ownerRole ||
            this.sameText(issue.ownerRole, coordinatorAssignment.role) ||
            this.sameText(issue.ownerName, coordinatorAssignment.coordinatorName),
        )
      : urgentIssues;
    const mappedSupplierStatuses = supplierRequests.map((request: any) => ({
      ...this.mapSupplierQuoteRequest(this.withExpiredQuoteRequestStatus(request)),
      verificationStatus: request.eventDayVerificationStatus ?? SupplierVerificationStatus.SelfReported,
      verifiedAt: request.eventDayVerifiedAt ? timestamp(request.eventDayVerifiedAt) : null,
      verifiedBy: request.eventDayVerifiedBy ?? null,
      verificationNotes: request.eventDayVerificationNotes ?? '',
    }));

    const base = {
      event: this.mapEvent(event as EventWithDrafts),
      tasks: roleScopedTasks.map((task: any) => this.mapEventDayTask(task)),
      urgentIssues: roleScopedIssues.map((issue: any) => this.mapUrgentIssue(issue)),
      supplierStatuses: mappedSupplierStatuses,
      coordinatorAssignments: (coordinatorAssignment ? [coordinatorAssignment] : coordinatorAssignments).map(
        (assignment: any) => this.mapCoordinatorAssignmentForEventDay(assignment),
      ),
      guestAttendanceCount: guestCheckIns.length,
      guestCheckIns: guestCheckIns.map((checkIn: any) => this.mapGuestCheckIn(checkIn)),
      eventDayLogs: eventDayLogs.map((log: any) => this.mapEventDayLog(log)),
    };

    if (actor.role === OpsUserRole.Coordinator) {
      return {
        ...base,
        role: coordinatorAssignment.role,
        supplierStatuses: mappedSupplierStatuses.map((status) => ({
          id: status.id,
          eventId: status.eventId,
          supplierId: status.supplierId,
          supplierName: status.supplierName,
          category: status.category,
          assignmentStatus: status.assignmentStatus,
          readinessStatus: status.readinessStatus,
          eventDayStatus: status.eventDayStatus,
          eventDayNotes: status.eventDayNotes,
          verificationStatus: status.verificationStatus,
          verifiedAt: status.verifiedAt,
          verifiedBy: status.verifiedBy,
        })),
        guestCheckIns: this.isRegistrationRole(coordinatorAssignment.role)
          ? base.guestCheckIns
          : [],
      };
    }

    return base;
  }

  async listCoordinatorWorkspace(actorInput: SampleActorInput = {}) {
    const actor = this.resolveActor(actorInput);
    await this.requireActorRole(actor, [OpsUserRole.Coordinator], 'coordinator workspace');
    const coordinator = await this.resolveCoordinatorForActor(actor);
    const assignments = await this.prisma.opsCoordinatorAssignment.findMany({
      where: { coordinatorId: coordinator.id },
      orderBy: { eventDate: 'asc' },
    });
    const fallbackAssignments =
      assignments.length > 0
        ? []
        : await this.prisma.opsCoordinatorAssignment.findMany({
            where: { coordinatorName: coordinator.name },
            orderBy: { eventDate: 'asc' },
          });
    const visibleAssignments = [...assignments, ...fallbackAssignments];
    const eventIds = new Set(visibleAssignments.map((assignment: any) => assignment.eventId));
    const events = await this.prisma.opsEvent.findMany({
      where: { archived: false },
      include: { floorPlanDrafts: { orderBy: { updatedAt: 'desc' } } },
      orderBy: { eventDate: 'asc' },
    });

    return {
      coordinator: this.coordinatorsService.mapCoordinator(coordinator),
      assignments: visibleAssignments.map((assignment: any) => this.mapCoordinatorAssignmentForEventDay(assignment)),
      events: events.filter((event: OpsEvent) => eventIds.has(event.id)).map((event: any) => this.mapEvent(event)),
    };
  }

  async getCoordinatorRoleView(eventId: string, actorInput: SampleActorInput = {}) {
    const actor = this.resolveActor(actorInput);
    await this.requireActorRole(actor, [OpsUserRole.Coordinator], 'coordinator role view', eventId);
    const assignment = await this.requireCoordinatorAssignmentForEvent(eventId, actor);
    const liveOps = await this.getEventLiveOps(eventId, actorInput);

    return {
      event: liveOps.event,
      assignment: this.mapCoordinatorAssignmentForEventDay(assignment),
      role: assignment.role,
      tasks: liveOps.tasks,
      urgentIssues: liveOps.urgentIssues,
      supplierStatuses: liveOps.supplierStatuses,
      guestAttendanceCount: liveOps.guestAttendanceCount,
      guestCheckIns: this.isRegistrationRole(assignment.role) ? liveOps.guestCheckIns : [],
    };
  }

  async getEventDayStatusFeed(eventId: string, actorInput: SampleActorInput = {}) {
    const actor = this.resolveActor(actorInput);
    await this.requireActorRole(
      actor,
      [OpsUserRole.PmcmAdmin, OpsUserRole.System, OpsUserRole.Coordinator],
      'event-day status feed',
      eventId,
    );
    const liveOps = await this.getEventLiveOps(eventId, actorInput);
    const role = 'role' in liveOps ? liveOps.role : undefined;
    const includeGuestDetails =
      actor.role === OpsUserRole.PmcmAdmin ||
      actor.role === OpsUserRole.System ||
      Boolean(role && this.isRegistrationRole(role));

    return this.liveOperationsService.buildStatusFeed({
      event: liveOps.event,
      role,
      tasks: liveOps.tasks,
      urgentIssues: liveOps.urgentIssues,
      supplierStatuses: liveOps.supplierStatuses,
      coordinatorAssignments: liveOps.coordinatorAssignments,
      eventDayLogs: liveOps.eventDayLogs,
      guestAttendanceCount: liveOps.guestAttendanceCount,
      guestCheckIns: liveOps.guestCheckIns,
      includeGuestDetails,
    });
  }

  async createEventDayTask(
    eventId: string,
    input: CreateEventDayTaskInput,
    actorInput: SampleActorInput = {},
  ) {
    const { actor } = await this.requireEventDayWriteActor(eventId, actorInput, 'event-day tasks');
    const title = input.title?.trim();
    if (!title) throw new BadRequestException('Task title is required');
    const status = EventDayTaskStatus.Open;
    const task = await this.prisma.opsEventDayTask.create({
      data: {
        id: `edt_${randomUUID()}`,
        eventId,
        title,
        assignedRole: input.assignedRole?.trim() || 'General Coordinator',
        ownerName: input.ownerName?.trim() ?? '',
        priority: input.priority?.trim() || 'normal',
        status,
        notes: input.notes?.trim() ?? '',
        dueAt: input.dueAt ? new Date(input.dueAt) : null,
        slaDueAt: input.slaDueAt ? new Date(input.slaDueAt) : input.dueAt ? new Date(input.dueAt) : null,
      },
    });

    await Promise.all([
      this.recordEventDayLog(eventId, 'task_created', actor, `Created event-day task: ${title}`, 'event_day_task', task.id, {
        assignedRole: task.assignedRole,
        priority: task.priority,
      }),
      this.audit(eventId, actor.name, `Created event-day task: ${title}`, {
        actorRole: actor.role,
        actorEmail: actor.email,
        actionType: AuditActionType.Create,
        category: AuditCategory.Events,
        affectedType: 'event_day_task',
        affectedId: task.id,
        affectedLabel: title,
      }),
    ]);

    return this.mapEventDayTask(task);
  }

  async updateEventDayTask(
    eventId: string,
    taskId: string,
    input: UpdateEventDayTaskInput,
    actorInput: SampleActorInput = {},
  ) {
    const { actor } = await this.requireEventDayWriteActor(eventId, actorInput, 'event-day tasks');
    const current = (await this.prisma.opsEventDayTask.findMany({ where: { eventId } })).find(
      (task: any) => task.id === taskId,
    );
    if (!current) throw new NotFoundException('Event-day task not found');
    const status = input.status?.trim();
    if (status && !Object.values(EventDayTaskStatus).includes(status as any)) {
      throw new BadRequestException('Unsupported event-day task status');
    }

    const task = await this.prisma.opsEventDayTask.update({
      where: { id: taskId },
      data: {
        ...(status ? { status } : {}),
        ...(input.notes !== undefined ? { notes: input.notes.trim() } : {}),
        ...(input.ownerName !== undefined ? { ownerName: input.ownerName.trim() } : {}),
        ...(input.slaDueAt !== undefined ? { slaDueAt: input.slaDueAt ? new Date(input.slaDueAt) : null } : {}),
        ...(status === EventDayTaskStatus.Done && !current.completedAt ? { completedAt: new Date() } : {}),
      },
    });

    await Promise.all([
      this.recordEventDayLog(eventId, 'task_updated', actor, `Updated event-day task: ${task.title}`, 'event_day_task', task.id, {
        status: task.status,
      }),
      this.audit(eventId, actor.name, `Updated event-day task: ${task.title}`, {
        actorRole: actor.role,
        actorEmail: actor.email,
        actionType: AuditActionType.Update,
        category: AuditCategory.Events,
        affectedType: 'event_day_task',
        affectedId: task.id,
        affectedLabel: task.title,
        metadata: { status: task.status },
      }),
    ]);

    return this.mapEventDayTask(task);
  }

  async createUrgentIssue(
    eventId: string,
    input: CreateUrgentIssueInput,
    actorInput: SampleActorInput = {},
  ) {
    const { actor } = await this.requireEventDayWriteActor(eventId, actorInput, 'urgent issues');
    const title = input.title?.trim();
    if (!title) throw new BadRequestException('Issue title is required');
    const severity = input.severity?.trim() || UrgentIssueSeverity.Medium;
    if (!Object.values(UrgentIssueSeverity).includes(severity as any)) {
      throw new BadRequestException('Unsupported urgent issue severity');
    }
    const issue = await this.prisma.opsUrgentIssue.create({
      data: {
        id: `urg_${randomUUID()}`,
        eventId,
        title,
        description: input.description?.trim() ?? '',
        severity,
        status: input.ownerRole || input.ownerName ? UrgentIssueStatus.Assigned : UrgentIssueStatus.Open,
        ownerRole: input.ownerRole?.trim() ?? '',
        ownerName: input.ownerName?.trim() ?? '',
        openedBy: input.openedBy?.trim() || actor.name,
        slaDueAt: input.slaDueAt ? new Date(input.slaDueAt) : null,
      },
    });

    await Promise.all([
      this.recordEventDayLog(eventId, 'urgent_issue_created', actor, `Opened urgent issue: ${title}`, 'urgent_issue', issue.id, {
        severity: issue.severity,
        ownerRole: issue.ownerRole,
      }),
      this.audit(eventId, actor.name, `Opened urgent issue: ${title}`, {
        actorRole: actor.role,
        actorEmail: actor.email,
        actionType: AuditActionType.Create,
        category: AuditCategory.Events,
        affectedType: 'urgent_issue',
        affectedId: issue.id,
        affectedLabel: title,
        severity: issue.severity === UrgentIssueSeverity.Critical ? 'critical' : 'warning',
      }),
    ]);

    return this.mapUrgentIssue(issue);
  }

  async updateUrgentIssue(
    eventId: string,
    issueId: string,
    input: UpdateUrgentIssueInput,
    actorInput: SampleActorInput = {},
  ) {
    const { actor } = await this.requireEventDayWriteActor(eventId, actorInput, 'urgent issues');
    const current = (await this.prisma.opsUrgentIssue.findMany({ where: { eventId } })).find(
      (issue: any) => issue.id === issueId,
    );
    if (!current) throw new NotFoundException('Urgent issue not found');
    const status = input.status?.trim();
    if (status && !Object.values(UrgentIssueStatus).includes(status as any)) {
      throw new BadRequestException('Unsupported urgent issue status');
    }
    const issue = await this.prisma.opsUrgentIssue.update({
      where: { id: issueId },
      data: {
        ...(status ? { status } : {}),
        ...(input.ownerRole !== undefined ? { ownerRole: input.ownerRole.trim() } : {}),
        ...(input.ownerName !== undefined ? { ownerName: input.ownerName.trim() } : {}),
        ...(input.resolution !== undefined ? { resolution: input.resolution.trim() } : {}),
        ...(input.slaDueAt !== undefined ? { slaDueAt: input.slaDueAt ? new Date(input.slaDueAt) : null } : {}),
        ...(status === UrgentIssueStatus.Resolved && !current.resolvedAt ? { resolvedAt: new Date() } : {}),
      },
    });

    await Promise.all([
      this.recordEventDayLog(eventId, 'urgent_issue_updated', actor, `Updated urgent issue: ${issue.title}`, 'urgent_issue', issue.id, {
        status: issue.status,
        resolution: issue.resolution,
      }),
      this.audit(eventId, actor.name, `Updated urgent issue: ${issue.title}`, {
        actorRole: actor.role,
        actorEmail: actor.email,
        actionType: AuditActionType.Update,
        category: AuditCategory.Events,
        affectedType: 'urgent_issue',
        affectedId: issue.id,
        affectedLabel: issue.title,
        metadata: { status: issue.status, resolution: issue.resolution },
      }),
    ]);

    return this.mapUrgentIssue(issue);
  }

  async escalateEventDayTask(
    eventId: string,
    taskId: string,
    input: EscalateLiveOpsInput,
    actorInput: SampleActorInput = {},
  ) {
    const { actor } = await this.requireEventDayWriteActor(eventId, actorInput, 'event-day task escalation');
    const escalationLevel = this.validateEscalationLevel(input.escalationLevel);
    const notes = input.notes?.trim();
    if (!notes) throw new BadRequestException('Escalation notes are required');
    const current = (await this.prisma.opsEventDayTask.findMany({ where: { eventId } })).find(
      (task: any) => task.id === taskId,
    );
    if (!current) throw new NotFoundException('Event-day task not found');

    const task = await this.prisma.opsEventDayTask.update({
      where: { id: taskId },
      data: {
        ...(input.ownerRole !== undefined ? { assignedRole: input.ownerRole.trim() } : {}),
        ...(input.ownerName !== undefined ? { ownerName: input.ownerName.trim() } : {}),
        slaStatus: this.liveOperationsService.computeSlaStatus(current),
        escalationLevel,
        escalatedAt: new Date(),
        escalatedBy: actor.name,
        escalationNotes: notes,
      },
    });
    const recipient = input.ownerName?.trim() || task.ownerName || task.assignedRole || 'PMCM Live Ops';

    await Promise.all([
      this.recordEventDayLog(eventId, 'task_escalated', actor, `Escalated event-day task: ${task.title}`, 'event_day_task', task.id, {
        escalationLevel,
        notes,
        ownerRole: input.ownerRole ?? task.assignedRole,
        ownerName: input.ownerName ?? task.ownerName,
      }),
      this.audit(eventId, actor.name, `Escalated event-day task: ${task.title}`, {
        actorRole: actor.role,
        actorEmail: actor.email,
        actionType: AuditActionType.Update,
        category: AuditCategory.Events,
        affectedType: 'event_day_task',
        affectedId: task.id,
        affectedLabel: task.title,
        severity: escalationLevel === LiveOpsEscalationLevel.Critical ? 'critical' : 'warning',
        metadata: { escalationLevel, notes, ownerRole: input.ownerRole ?? task.assignedRole, ownerName: input.ownerName ?? task.ownerName },
      }),
      this.queueNotification(eventId, recipient, `Event-day task escalated: ${task.title}`, 'viber'),
    ]);

    return this.mapEventDayTask(task);
  }

  async escalateUrgentIssue(
    eventId: string,
    issueId: string,
    input: EscalateLiveOpsInput,
    actorInput: SampleActorInput = {},
  ) {
    const { actor } = await this.requireEventDayWriteActor(eventId, actorInput, 'urgent issue escalation');
    const escalationLevel = this.validateEscalationLevel(input.escalationLevel);
    const notes = input.notes?.trim();
    if (!notes) throw new BadRequestException('Escalation notes are required');
    const current = (await this.prisma.opsUrgentIssue.findMany({ where: { eventId } })).find(
      (issue: any) => issue.id === issueId,
    );
    if (!current) throw new NotFoundException('Urgent issue not found');

    const issue = await this.prisma.opsUrgentIssue.update({
      where: { id: issueId },
      data: {
        ...(input.ownerRole !== undefined ? { ownerRole: input.ownerRole.trim() } : {}),
        ...(input.ownerName !== undefined ? { ownerName: input.ownerName.trim() } : {}),
        ...(input.ownerRole || input.ownerName ? { status: UrgentIssueStatus.Assigned } : {}),
        slaStatus: this.liveOperationsService.computeSlaStatus(current),
        escalationLevel,
        escalatedAt: new Date(),
        escalatedBy: actor.name,
        escalationNotes: notes,
      },
    });
    const recipient = input.ownerName?.trim() || issue.ownerName || issue.ownerRole || 'PMCM Live Ops';

    await Promise.all([
      this.recordEventDayLog(eventId, 'urgent_issue_escalated', actor, `Escalated urgent issue: ${issue.title}`, 'urgent_issue', issue.id, {
        escalationLevel,
        notes,
        ownerRole: input.ownerRole ?? issue.ownerRole,
        ownerName: input.ownerName ?? issue.ownerName,
      }),
      this.audit(eventId, actor.name, `Escalated urgent issue: ${issue.title}`, {
        actorRole: actor.role,
        actorEmail: actor.email,
        actionType: AuditActionType.Update,
        category: AuditCategory.Events,
        affectedType: 'urgent_issue',
        affectedId: issue.id,
        affectedLabel: issue.title,
        severity: escalationLevel === LiveOpsEscalationLevel.Critical ? 'critical' : 'warning',
        metadata: { escalationLevel, notes, ownerRole: input.ownerRole ?? issue.ownerRole, ownerName: input.ownerName ?? issue.ownerName },
      }),
      this.queueNotification(eventId, recipient, `Urgent issue escalated: ${issue.title}`, 'viber'),
    ]);

    return this.mapUrgentIssue(issue);
  }

  async replaceCoordinatorAssignment(
    eventId: string,
    assignmentId: string,
    input: ReplaceCoordinatorAssignmentInput,
    actorInput: SampleActorInput = {},
  ) {
    const actor = this.resolveActor(actorInput);
    await this.requireActorRole(actor, [OpsUserRole.PmcmAdmin, OpsUserRole.System], 'coordinator replacement', eventId);
    const event = await this.requireEvent(eventId);
    const reason = input.reason?.trim();
    const role = input.role?.trim();
    if (!input.replacementCoordinatorId?.trim()) throw new BadRequestException('Replacement coordinator is required');
    if (!role) throw new BadRequestException('Replacement role is required');
    if (!reason) throw new BadRequestException('Replacement reason is required');
    const current = (await this.prisma.opsCoordinatorAssignment.findMany({ where: { eventId } })).find(
      (assignment: any) => assignment.id === assignmentId,
    );
    if (!current) throw new NotFoundException('Coordinator assignment not found');
    const coordinator = await this.prisma.opsCoordinator.findUnique({
      where: { id: input.replacementCoordinatorId.trim() },
    });
    if (!coordinator || !coordinator.active) throw new NotFoundException('Replacement coordinator not found');
    if (Array.isArray(coordinator.roleTags) && coordinator.roleTags.length > 0 && !coordinator.roleTags.includes(role)) {
      throw new BadRequestException(`${coordinator.name} is not tagged for ${role}`);
    }

    const replacementAssignment = await this.prisma.opsCoordinatorAssignment.create({
      data: {
        id: `coord_asg_${randomUUID()}`,
        eventId,
        coordinatorId: coordinator.id,
        coordinatorName: coordinator.name,
        role,
        status: CoordinatorAssignmentStatus.PendingAcknowledgement,
        attendanceStatus: CoordinatorAttendanceStatus.Pending,
        eventDate: current.eventDate ?? event.eventDate ?? null,
      },
    });
    const replacedAssignment = await this.prisma.opsCoordinatorAssignment.update({
      where: { id: assignmentId },
      data: {
        status: CoordinatorAssignmentStatus.Replaced,
        attendanceStatus: CoordinatorAttendanceStatus.Replaced,
        attendanceMarkedAt: new Date(),
        attendanceNotes: reason,
        replacedByAssignmentId: replacementAssignment.id,
        replacementReason: reason,
        replacedAt: new Date(),
        replacedBy: actor.name,
      },
    });

    await Promise.all([
      this.prisma.opsCoordinatorReliabilityNote.create({
        data: {
          id: `crn_${randomUUID()}`,
          eventId,
          coordinatorId: replacedAssignment.coordinatorId ?? null,
          assignmentId: replacedAssignment.id,
          note: `${replacedAssignment.coordinatorName} replaced for ${replacedAssignment.role}: ${reason}`,
          severity: 'warning',
        },
      }),
      this.recordEventDayLog(
        eventId,
        'coordinator_replaced',
        actor,
        `Replaced ${replacedAssignment.coordinatorName} with ${replacementAssignment.coordinatorName}`,
        'coordinator_assignment',
        replacedAssignment.id,
        {
          replacementAssignmentId: replacementAssignment.id,
          replacementCoordinatorId: replacementAssignment.coordinatorId,
          role,
          reason,
        },
      ),
      this.audit(eventId, actor.name, `Replaced coordinator: ${replacedAssignment.coordinatorName}`, {
        actorRole: actor.role,
        actorEmail: actor.email,
        actionType: AuditActionType.Update,
        category: AuditCategory.Events,
        affectedType: 'coordinator_assignment',
        affectedId: replacedAssignment.id,
        affectedLabel: `${replacedAssignment.coordinatorName} - ${replacedAssignment.role}`,
        severity: 'warning',
        metadata: {
          replacementAssignmentId: replacementAssignment.id,
          replacementCoordinatorId: replacementAssignment.coordinatorId,
          replacementCoordinatorName: replacementAssignment.coordinatorName,
          role,
          reason,
        },
      }),
      this.queueNotification(
        eventId,
        replacedAssignment.coordinatorName,
        `Coordinator replacement recorded for ${event.eventName}: ${reason}`,
        'viber',
      ),
      this.queueNotification(
        eventId,
        coordinator.email ?? coordinator.name,
        `Coordinator replacement assignment issued: ${event.eventName} (${role})`,
      ),
    ]);

    return {
      replacedAssignment: this.mapCoordinatorAssignmentForEventDay(replacedAssignment),
      replacementAssignment: this.mapCoordinatorAssignmentForEventDay(replacementAssignment),
    };
  }

  async updateCoordinatorAttendance(
    eventId: string,
    assignmentId: string,
    input: UpdateCoordinatorAttendanceInput,
    actorInput: SampleActorInput = {},
  ) {
    const { actor } = await this.requireEventDayWriteActor(eventId, actorInput, 'coordinator attendance');
    const status = input.status?.trim();
    if (!Object.values(CoordinatorAttendanceStatus).includes(status as any)) {
      throw new BadRequestException('Unsupported coordinator attendance status');
    }
    const current = (await this.prisma.opsCoordinatorAssignment.findMany({ where: { eventId } })).find(
      (assignment: any) => assignment.id === assignmentId,
    );
    if (!current) throw new NotFoundException('Coordinator assignment not found');
    const assignment = await this.prisma.opsCoordinatorAssignment.update({
      where: { id: assignmentId },
      data: {
        attendanceStatus: status,
        attendanceMarkedAt: new Date(),
        attendanceNotes: input.notes?.trim() ?? '',
      },
    });

    const reliabilityPromise =
      status === CoordinatorAttendanceStatus.Late ||
      status === CoordinatorAttendanceStatus.Absent ||
      status === CoordinatorAttendanceStatus.Replaced
        ? this.prisma.opsCoordinatorReliabilityNote.create({
            data: {
              id: `crn_${randomUUID()}`,
              eventId,
              coordinatorId: assignment.coordinatorId ?? null,
              assignmentId: assignment.id,
              note: `${assignment.coordinatorName} marked ${status}${input.notes ? `: ${input.notes.trim()}` : ''}`,
              severity: status === CoordinatorAttendanceStatus.Absent ? 'critical' : 'warning',
            },
          })
        : Promise.resolve(null);

    await Promise.all([
      reliabilityPromise,
      this.recordEventDayLog(
        eventId,
        'coordinator_status_updated',
        actor,
        `Marked ${assignment.coordinatorName} ${status}`,
        'coordinator_assignment',
        assignment.id,
        { status, notes: input.notes ?? '', markedBy: input.markedBy ?? actor.name },
      ),
      this.audit(eventId, actor.name, `Updated coordinator attendance: ${assignment.coordinatorName}`, {
        actorRole: actor.role,
        actorEmail: actor.email,
        actionType: AuditActionType.Update,
        category: AuditCategory.Events,
        affectedType: 'coordinator_assignment',
        affectedId: assignment.id,
        affectedLabel: `${assignment.coordinatorName} - ${assignment.role}`,
        metadata: { status, notes: input.notes ?? '', markedBy: input.markedBy ?? actor.name },
      }),
    ]);

    return this.mapCoordinatorAssignmentForEventDay(assignment);
  }

  async verifySupplierEventStatus(
    eventId: string,
    requestId: string,
    input: VerifySupplierStatusInput,
    actorInput: SampleActorInput = {},
  ) {
    const { actor } = await this.requireEventDayWriteActor(eventId, actorInput, 'supplier setup verification');
    const verificationStatus = input.verificationStatus?.trim();
    if (!Object.values(SupplierVerificationStatus).includes(verificationStatus as any)) {
      throw new BadRequestException('Unsupported supplier verification status');
    }
    const current = (await this.prisma.opsSupplierQuoteRequest.findMany({ where: { eventId } })).find(
      (request: any) => request.id === requestId,
    );
    if (!current) throw new NotFoundException('Supplier quote request not found');
    const verifiedBy = input.verifiedBy?.trim() || actor.name;
    const request = await this.prisma.opsSupplierQuoteRequest.update({
      where: { id: requestId },
      data: {
        eventDayVerificationStatus: verificationStatus,
        eventDayVerifiedAt: new Date(),
        eventDayVerifiedBy: verifiedBy,
        eventDayVerificationNotes: input.notes?.trim() ?? '',
      },
    });

    await Promise.all([
      this.recordEventDayLog(
        eventId,
        'supplier_status_verified',
        actor,
        `Marked supplier setup ${verificationStatus}: ${request.supplierName}`,
        'supplier_quote_request',
        request.id,
        { verificationStatus, verifiedBy, notes: input.notes ?? '' },
      ),
      this.audit(eventId, actor.name, `Marked supplier setup ${verificationStatus}: ${request.supplierName}`, {
        actorRole: actor.role,
        actorEmail: actor.email,
        actionType: AuditActionType.Update,
        category: AuditCategory.Suppliers,
        affectedType: 'supplier_quote_request',
        affectedId: request.id,
        affectedLabel: request.supplierName,
        metadata: { verificationStatus, verifiedBy, notes: input.notes ?? '' },
      }),
    ]);

    return this.mapSupplierQuoteRequest(request);
  }

  sanitizeAiPayload(payload: Record<string, unknown>) {
    const redactValue = (key: string, value: unknown): unknown => {
      if (Array.isArray(value)) return value.map((item) => redactValue(key, item));
      if (value && typeof value === 'object') {
        return Object.fromEntries(
          Object.entries(value as Record<string, unknown>).map(([childKey, childValue]) => [
            childKey,
            redactValue(childKey, childValue),
          ]),
        );
      }
      const normalizedKey = key.toLowerCase();
      if (normalizedKey.includes('email')) return '[email redacted]';
      if (normalizedKey.includes('phone') || normalizedKey.includes('mobile')) return '[phone redacted]';
      if (normalizedKey === 'clientname' || normalizedKey === 'client_name') return 'Client A';
      if (normalizedKey === 'suppliername' || normalizedKey === 'supplier_name') return 'Supplier X';
      if (typeof value !== 'string') return value;

      return value
        .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, '[email redacted]')
        .replace(/(\+?\d[\d\s().-]{7,}\d)/g, '[phone redacted]')
        .replace(/\bAna Reyes\b/g, 'Client A')
        .replace(/\bSonicLine Technicals\b/g, 'Supplier X');
    };

    return redactValue('payload', payload) as Record<string, unknown>;
  }

  async runAiGovernanceDryRun(input: AiGovernanceInput) {
    const sanitizedPayload = this.sanitizeAiPayload(input.payload ?? {});
    const dataCategories = this.detectAiDataCategories(input.payload ?? {});
    const baseData = {
      id: `aia_${randomUUID()}`,
      eventId: input.eventId ?? null,
      featureName: input.featureName,
      modelVersion: input.modelVersion,
      dataCategories: toPrismaJson(dataCategories),
      sanitizedPayload: toPrismaJson(sanitizedPayload),
      zdrConfirmed: Boolean(input.zdrConfirmed),
      humanApprovalRequired: true,
      humanApproved: false,
    };

    if (!input.zdrConfirmed) {
      await this.prisma.opsAiAuditLog.create({
        data: {
          ...baseData,
          status: 'ZDR_UNCONFIRMED',
        },
      });
      throw new BadRequestException('ZDR confirmation is required before AI can run');
    }

    const audit = await this.prisma.opsAiAuditLog.create({
      data: {
        ...baseData,
        status: 'pending_human_approval',
      },
    });
    const approval = await this.prisma.opsAiApprovalRecord.create({
      data: {
        id: `aip_${randomUUID()}`,
        aiAuditLogId: audit.id,
        eventId: input.eventId ?? null,
        featureName: input.featureName,
        requestedBy: 'PMCM Admin',
        humanApproved: false,
        status: 'pending_human_approval',
      },
    });

    return {
      audit: this.mapAiAuditLog(audit),
      approval: this.mapAiApprovalRecord(approval),
    };
  }

  private async resolveGuestEventByAccessCode(accessCode: string) {
    const normalizedCode = this.normalizeGuestAccessCode(accessCode);
    const events = await this.prisma.opsEvent.findMany({
      where: { archived: false },
      include: { floorPlanDrafts: { orderBy: { updatedAt: 'desc' } } },
      orderBy: { eventDate: 'asc' },
    });
    const event = events.find((item) => this.guestAccessCode(item) === normalizedCode);

    if (!event) {
      throw new NotFoundException('Guest event code was not found');
    }

    return event;
  }

  async createFloorPlanDraft(
    eventId: string,
    input: CreateFloorPlanDraftInput,
    actorInput: SampleActorInput = { actorRole: OpsUserRole.PmcmAdmin },
  ) {
    const actor = this.resolveActor(actorInput);
    await this.eventAccessPolicyService.requireCanMutateOfficialFloorplan(actor, eventId, 'official floorplan draft');
    return this.floorPlanWorkflowService.createFloorPlanDraft(eventId, input, {
      name: actor.name,
      role: actor.role,
    });
  }

  async createFloorPlanPreference(
    eventId: string,
    input: CreateFloorPlanPreferenceInput,
    actorInput: SampleActorInput = { actorRole: OpsUserRole.Client },
  ) {
    const actor = this.resolveActor(actorInput);
    await this.requireActorRole(
      actor,
      [OpsUserRole.Client, OpsUserRole.PmcmAdmin, OpsUserRole.System],
      'client floorplan preference',
      eventId,
    );
    const event = await this.requireEvent(eventId);
    if (!this.canReadEvent(actor, event) && actor.role === OpsUserRole.Client) {
      await this.recordForbiddenAccess(actor, 'client floorplan preference', eventId);
      throw new ForbiddenException('client cannot access this event floorplan preference');
    }
    return this.floorPlanWorkflowService.createFloorPlanPreference(eventId, input, {
      name: actor.name,
      role: actor.role,
    });
  }

  async submitFloorPlanDraft(
    eventId: string,
    draftId: string,
    actorInput: SampleActorInput = { actorRole: OpsUserRole.PmcmAdmin },
  ) {
    const actor = this.resolveActor(actorInput);
    await this.eventAccessPolicyService.requireCanMutateOfficialFloorplan(actor, eventId, 'official floorplan submit');
    return this.floorPlanWorkflowService.submitFloorPlanDraft(eventId, draftId, {
      name: actor.name,
      role: actor.role,
    });
  }

  async approveFloorPlanDraft(
    eventId: string,
    draftId: string,
    actorInput: SampleActorInput = { actorRole: OpsUserRole.PmcmAdmin },
  ) {
    const actor = this.resolveActor(actorInput);
    await this.eventAccessPolicyService.requireCanMutateOfficialFloorplan(actor, eventId, 'official floorplan approve');
    return this.floorPlanWorkflowService.approveFloorPlanDraft(eventId, draftId, {
      name: actor.name,
      role: actor.role,
    });
  }

  async getFloorPlanSnapshot(
    eventId: string,
    draftId: string,
    type: 'submitted' | 'approved' = 'approved',
    actorInput: SampleActorInput = { actorRole: OpsUserRole.PmcmAdmin },
  ) {
    const actor = this.resolveActor(actorInput);
    const event = await this.requireEvent(eventId);
    if (!this.canReadEvent(actor, event)) {
      await this.recordForbiddenAccess(actor, 'official floorplan snapshot', eventId);
      throw new ForbiddenException(`${actor.role} cannot access official floorplan snapshot`);
    }
    return this.floorPlanWorkflowService.getFloorPlanSnapshot(eventId, draftId, type);
  }

  async submitBriefing(eventId: string, input: SubmitBriefingInput) {
    await this.requireEvent(eventId);

    const briefing = await this.prisma.$transaction(async (tx) => {
      await tx.opsBriefing.deleteMany({ where: { eventId } });
      const saved = await tx.opsBriefing.create({
        data: {
          id: `brief_${randomUUID()}`,
          eventId,
          venue: input.venue,
          guestCount: input.guestCount,
          budgetRange: input.budgetRange,
          serviceRequirements: toPrismaJson(input.serviceRequirements),
          notes: input.notes,
        },
      });
      await tx.opsEvent.update({
        where: { id: eventId },
        data: { readiness: 'Supplier quotes pending', status: 'planning' },
      });
      await tx.opsAuditLog.create({
        data: {
          id: `aud_${randomUUID()}`,
          eventId,
          actor: 'Client',
          action: 'Submitted client briefing',
        },
      });
      await tx.opsNotificationLog.create({
        data: {
          id: `not_${randomUUID()}`,
          eventId,
          channel: 'email',
          recipient: 'PMCM Admin',
          message: 'Client briefing submitted',
          status: 'queued',
        },
      });
      return saved;
    });

    return this.mapBriefing(briefing);
  }

  async listSupplierCategories(actorInput: SampleActorInput = {}) {
    const actor = this.resolveActor(actorInput);
    await this.requireActorRole(
      actor,
      [OpsUserRole.PmcmAdmin, OpsUserRole.System, OpsUserRole.Supplier],
      'supplier categories',
    );

    return this.suppliersService.listSupplierCategories();
  }

  async listSuppliers(actorInput: SampleActorInput = {}) {
    const actor = this.resolveActor(actorInput);
    await this.requireActorRole(actor, [OpsUserRole.PmcmAdmin, OpsUserRole.System], 'supplier directory');

    return this.suppliersService.listSuppliers();
  }

  async createSupplier(input: CreateSupplierInput, actorInput: SampleActorInput = {}) {
    const actor = this.resolveActor(actorInput);
    await this.requireActorRole(actor, [OpsUserRole.PmcmAdmin, OpsUserRole.System], 'supplier creation');

    const supplier = await this.suppliersService.createSupplier(input);
    await this.audit(undefined, actor.name, `Created supplier profile: ${supplier.name}`, {
      actorRole: actor.role,
      actorEmail: actor.email,
      category: AuditCategory.Suppliers,
      actionType: AuditActionType.Create,
      affectedType: 'supplier',
      affectedId: supplier.id,
      affectedLabel: supplier.name,
    });

    return supplier;
  }

  async updateSupplier(supplierId: string, input: UpdateSupplierInput, actorInput: SampleActorInput = {}) {
    const actor = this.resolveActor(actorInput);
    await this.requireActorRole(actor, [OpsUserRole.PmcmAdmin, OpsUserRole.System], 'supplier update');

    const supplier = await this.suppliersService.updateSupplier(supplierId, input);

    await this.audit(undefined, actor.name, `Updated supplier profile: ${supplier.name}`, {
      actorRole: actor.role,
      actorEmail: actor.email,
      category: AuditCategory.Suppliers,
      actionType: AuditActionType.Update,
      affectedType: 'supplier',
      affectedId: supplier.id,
      affectedLabel: supplier.name,
      metadata: input,
    });

    return supplier;
  }

  async changeSupplierTier(supplierId: string, input: ChangeSupplierTierInput, actorInput: SampleActorInput = {}) {
    const actor = this.resolveActor(actorInput);
    await this.requireActorRole(actor, [OpsUserRole.PmcmAdmin, OpsUserRole.System], 'supplier tier change');

    const result = await this.suppliersService.changeSupplierTier(supplierId, input);
    await this.audit(undefined, actor.name, `Changed supplier tier: ${result.supplier.name}`, {
      actorRole: actor.role,
      actorEmail: actor.email,
      category: AuditCategory.Suppliers,
      actionType: AuditActionType.Update,
      affectedType: 'supplier',
      affectedId: result.supplier.id,
      affectedLabel: result.supplier.name,
      metadata: {
        oldTier: result.oldTier,
        newTier: input.tier,
        reason: input.reason,
      },
    });

    return result.supplier;
  }

  async addSupplierReview(supplierId: string, input: CreateSupplierReviewInput, actorInput: SampleActorInput = {}) {
    const actor = this.resolveActor(actorInput);
    await this.requireActorRole(actor, [OpsUserRole.PmcmAdmin, OpsUserRole.System], 'supplier private review');

    const supplier = await this.suppliersService.addSupplierReview(supplierId, {
      ...input,
      reviewedBy: input.reviewedBy ?? actor.name,
    });
    await this.audit(input.eventId, actor.name, `Added private supplier review: ${supplier.name}`, {
      actorRole: actor.role,
      actorEmail: actor.email,
      category: AuditCategory.Suppliers,
      actionType: AuditActionType.Create,
      affectedType: 'supplier_review',
      affectedId: supplier.id,
      affectedLabel: supplier.name,
      metadata: { rating: input.rating },
    });

    return supplier;
  }

  async addSupplierCertification(
    supplierId: string,
    input: CreateSupplierCertificationInput,
    actorInput: SampleActorInput = {},
  ) {
    const actor = this.resolveActor(actorInput);
    await this.requireActorRole(actor, [OpsUserRole.PmcmAdmin, OpsUserRole.System], 'supplier certification');

    const supplier = await this.suppliersService.addSupplierCertification(supplierId, input);
    await this.audit(undefined, actor.name, `Added supplier certification: ${supplier.name}`, {
      actorRole: actor.role,
      actorEmail: actor.email,
      category: AuditCategory.Suppliers,
      actionType: AuditActionType.Upload,
      affectedType: 'supplier_certification',
      affectedId: supplier.id,
      affectedLabel: input.fileName,
      metadata: {
        documentType: input.documentType,
        issuer: input.issuer ?? '',
        expiresAt: input.expiresAt ?? null,
        status: input.status ?? 'submitted',
      },
    });

    return supplier;
  }

  async listSupplierWorkspace(actorInput: SampleActorInput = {}) {
    const actor = this.resolveActor(actorInput);
    return this.eventReadModelsService.supplierWorkspace(actor, {
      mapSupplierQuoteRequest: (request) => this.mapSupplierQuoteRequest(request),
      mapSupplierQuoteForSupplier: (quote) => this.mapSupplierQuoteForSupplier(quote),
    });
  }

  async confirmSupplierAssignment(requestId: string, actorInput: SampleActorInput = {}) {
    const { request, actor } = await this.requireSupplierQuoteRequestForActor(requestId, actorInput);
    const updated = await this.prisma.opsSupplierQuoteRequest.update({
      where: { id: request.id },
      data: {
        assignmentStatus: 'confirmed',
        assignmentConfirmedAt: new Date(),
      },
    });
    await this.audit(request.eventId, actor.name, `Confirmed supplier assignment: ${request.supplierName}`, {
      actorRole: actor.role,
      actorEmail: actor.email,
      actionType: AuditActionType.Update,
      category: AuditCategory.Suppliers,
      affectedType: 'supplier_quote_request',
      affectedId: request.id,
      affectedLabel: request.supplierName,
    });
    return this.mapSupplierQuoteRequest(updated);
  }

  async withdrawSupplier(requestId: string, reason: string, actorInput: SampleActorInput = {}) {
    const actor = this.resolveActor(actorInput);
    await this.requireActorRole(actor, [OpsUserRole.PmcmAdmin, OpsUserRole.System], 'withdraw supplier');
    const request = await this.prisma.opsSupplierQuoteRequest.findUnique({ where: { id: requestId } });
    if (!request) throw new NotFoundException('Supplier quote request not found');

    let updated: typeof request;
    let event: any = null;
    try {
      [updated, event] = await Promise.all([
        this.prisma.opsSupplierQuoteRequest.update({
          where: { id: request.id },
          data: { assignmentStatus: 'withdrawn' },
          include: { supplier: true },
        }),
        this.prisma.opsEvent.findUnique({ where: { id: request.eventId } }),
      ]);
    } catch {
      updated = { ...request, assignmentStatus: 'withdrawn' };
    }

    try {
      await this.audit(request.eventId, actor.name, `Supplier withdrawn: ${request.supplierName}. Reason: ${reason}`, {
        actorRole: actor.role,
        actorEmail: actor.email,
        actionType: AuditActionType.Update,
        category: AuditCategory.Suppliers,
        affectedType: 'supplier_quote_request',
        affectedId: request.id,
        affectedLabel: request.supplierName,
      });
    } catch { /* audit failure is non-fatal */ }

    // Fire PARE — pass prefetched data so agents don't need DB
    const prefetched = event ? { request: updated, event } : undefined;
    this.pareService.handleEmergencyTrigger(request.id, prefetched)
      .then((approval) => {
        const candidate = approval.pareResult?.budgetAnalysis?.selectedCandidate;
        const label = candidate?.supplierName ? `Recommended: ${candidate.supplierName} (${approval.pareResult?.mode ?? 'mock'} mode)` : 'PARE engine completed';
        return this.audit(request.eventId, 'PARE Engine', `PARE triggered for ${request.supplierName} — ${label}`, {
          actorRole: OpsUserRole.System,
          actionType: 'pare_triggered',
          category: AuditCategory.Suppliers,
          affectedType: 'supplier_quote_request',
          affectedId: request.id,
          affectedLabel: request.supplierName,
          metadata: { approvalRecordId: approval.id, mode: approval.pareResult?.mode },
        });
      })
      .catch((err) => {
        this.logger.error(`PARE trigger failed for request ${request.id}: ${err?.message}`);
      });
    return this.mapSupplierQuoteRequest(updated);
  }

  async pareGetPendingApprovals(eventId?: string) {
    return this.pareService.getPendingApprovals(eventId);
  }

  async pareApprove(approvalRecordId: string, approvedBy: string) {
    const result = await this.pareService.approveRecommendation(approvalRecordId, approvedBy);
    try {
      const candidate = result.pareResult?.budgetAnalysis?.selectedCandidate;
      await this.audit(result.eventId, approvedBy, `PARE recommendation approved: ${candidate?.supplierName ?? 'unknown supplier'}`, {
        actorRole: OpsUserRole.PmcmAdmin,
        actionType: 'pare_approved',
        category: AuditCategory.Suppliers,
        affectedType: 'pare_approval',
        affectedId: approvalRecordId,
        affectedLabel: candidate?.supplierName,
        metadata: { approvalRecordId, candidate },
      });
    } catch { /* non-fatal */ }
    return result;
  }

  async pareReject(approvalRecordId: string, rejectedBy: string) {
    const result = await this.pareService.rejectRecommendation(approvalRecordId, rejectedBy);
    try {
      const candidate = result.pareResult?.budgetAnalysis?.selectedCandidate;
      await this.audit(result.eventId, rejectedBy, `PARE recommendation rejected: ${candidate?.supplierName ?? 'unknown supplier'}`, {
        actorRole: OpsUserRole.PmcmAdmin,
        actionType: 'pare_rejected',
        category: AuditCategory.Suppliers,
        affectedType: 'pare_approval',
        affectedId: approvalRecordId,
        affectedLabel: candidate?.supplierName,
        metadata: { approvalRecordId, candidate },
      });
    } catch { /* non-fatal */ }
    return result;
  }

  async confirmSupplierReadiness(
    requestId: string,
    input: SupplierReadinessInput = {},
    actorInput: SampleActorInput = {},
  ) {
    const { request, actor } = await this.requireSupplierQuoteRequestForActor(requestId, actorInput);
    const updated = await this.prisma.opsSupplierQuoteRequest.update({
      where: { id: request.id },
      data: {
        readinessStatus: 'confirmed',
        readinessConfirmedAt: new Date(),
        readinessNotes: input.notes?.trim() ?? '',
      },
    });
    await this.audit(request.eventId, actor.name, `Confirmed supplier readiness: ${request.supplierName}`, {
      actorRole: actor.role,
      actorEmail: actor.email,
      actionType: AuditActionType.Update,
      category: AuditCategory.Suppliers,
      affectedType: 'supplier_quote_request',
      affectedId: request.id,
      affectedLabel: request.supplierName,
      metadata: { notes: input.notes ?? '' },
    });
    return this.mapSupplierQuoteRequest(updated);
  }

  async updateSupplierEventStatus(
    requestId: string,
    input: SupplierEventStatusInput,
    actorInput: SampleActorInput = {},
  ) {
    const { request, actor } = await this.requireSupplierQuoteRequestForActor(requestId, actorInput);
    const allowed = ['arrived', 'set_up_ready', 'done_leaving'];
    if (!allowed.includes(input.status)) throw new BadRequestException('Unsupported supplier event-day status');
    const photo = input.photo
      ? this.validateUploadMetadata(input.photo, `events/${request.eventId}/supplier-status`)
      : null;
    const updated = await this.prisma.opsSupplierQuoteRequest.update({
      where: { id: request.id },
      data: {
        eventDayStatus: input.status,
        eventDayStatusAt: new Date(),
        eventDayNotes: input.notes?.trim() ?? '',
        statusPhotoFileName: photo?.generatedFileName ?? null,
      },
    });
    await this.audit(request.eventId, actor.name, `Supplier status update: ${input.status}`, {
      actorRole: actor.role,
      actorEmail: actor.email,
      actionType: AuditActionType.Update,
      category: AuditCategory.Suppliers,
      affectedType: 'supplier_quote_request',
      affectedId: request.id,
      affectedLabel: request.supplierName,
      metadata: { status: input.status, notes: input.notes ?? '', photoFileName: photo?.generatedFileName ?? null },
    });
    return this.mapSupplierQuoteRequest(updated);
  }

  async uploadSupplierContract(
    requestId: string,
    input: UploadMetadataInput,
    actorInput: SampleActorInput = {},
  ) {
    const { request, actor } = await this.requireSupplierQuoteRequestForActor(requestId, actorInput);
    const upload = this.validateUploadMetadata(input, `events/${request.eventId}/supplier-contracts`);
    const document = await this.prisma.opsDocument.create({
      data: {
        id: `doc_${randomUUID()}`,
        eventId: request.eventId,
        type: 'supplier_contract',
        fileName: upload.originalFileName,
        generatedFileName: upload.generatedFileName,
        status: 'submitted',
        mimeType: upload.mimeType,
        sizeBytes: upload.sizeBytes,
        validationStatus: upload.validationStatus,
        storageBucket: upload.storageBucket,
        storageKey: upload.storageKey,
        uploadedByRole: 'supplier',
      },
    });
    const updated = await this.prisma.opsSupplierQuoteRequest.update({
      where: { id: request.id },
      data: { contractDocumentId: document.id },
    });
    await this.audit(request.eventId, actor.name, `Uploaded supplier contract: ${request.supplierName}`, {
      actorRole: actor.role,
      actorEmail: actor.email,
      actionType: AuditActionType.Upload,
      category: AuditCategory.Documents,
      affectedType: 'document',
      affectedId: document.id,
      affectedLabel: document.fileName,
    });
    return this.mapSupplierQuoteRequest(updated);
  }

  async requestSupplierQuotes(eventId: string, input: RequestSupplierQuotesInput) {
    const event = await this.requireEvent(eventId);
    const category = await this.prisma.opsSupplierCategory.findUnique({ where: { id: input.categoryId } });
    if (!category) throw new NotFoundException('Supplier category not found');

    const selectedSuppliers =
      input.supplierIds && input.supplierIds.length > 0
        ? await this.prisma.opsSupplier.findMany({
            where: { id: { in: input.supplierIds }, categoryId: category.id },
            orderBy: { name: 'asc' },
          })
        : await this.prisma.opsSupplier.findMany({
            where: { categoryId: category.id, tier: 'tier_1' },
            orderBy: { name: 'asc' },
          });

    if (selectedSuppliers.length === 0) {
      throw new BadRequestException('Select at least one supplier for this quote request');
    }

    const selectedSupplierIds = new Set(selectedSuppliers.map((supplier) => supplier.id));
    const duplicateRequestSupplierIds = new Set(
      (
        await this.prisma.opsSupplierQuoteRequest.findMany({
          where: { eventId },
        })
      )
        .filter(
          (request) =>
            request.categoryId === category.id &&
            request.supplierId &&
            selectedSupplierIds.has(request.supplierId) &&
            ![SupplierQuoteRequestStatus.Closed, SupplierQuoteRequestStatus.Expired].includes(request.status as any),
        )
        .map((request) => request.supplierId as string),
    );
    const suppliersToRequest = selectedSuppliers.filter((supplier) => !duplicateRequestSupplierIds.has(supplier.id));
    if (suppliersToRequest.length === 0) {
      throw new BadRequestException('Selected suppliers already have active quote requests for this event and category');
    }

    const dueDate = input.deadline ? parseDate(input.deadline) : null;
    const requests = await this.prisma.$transaction(async (tx) => {
      const created: OpsSupplierQuoteRequest[] = [];
      for (const supplier of suppliersToRequest) {
        const token = randomUUID();
        const request = await tx.opsSupplierQuoteRequest.create({
          data: {
            id: `qr_${randomUUID()}`,
            eventId,
            supplierId: supplier.id,
            categoryId: category.id,
            supplierName: supplier.name,
            category: category.name,
            dueDate,
            accessToken: token,
            confidentialBid: Boolean(input.confidentialBid),
            message: input.confidentialBid
              ? `${event.eventName} quote request with client details hidden until selection.`
              : `${event.clientName} / ${event.eventName} quote request.`,
            status: 'open',
          },
        });
        created.push(request);

        await tx.opsNotificationLog.createMany({
          data: [
            {
              id: `not_${randomUUID()}`,
              eventId,
              channel: 'email',
              recipient: supplier.email || supplier.name,
              message: `Quote request link: /quote-requests/${token}`,
              status: 'queued',
            },
            {
              id: `not_${randomUUID()}`,
              eventId,
              channel: 'viber',
              recipient: supplier.phone || supplier.name,
              message: `Quote request link: /quote-requests/${token}`,
              status: 'queued',
            },
          ],
        });
      }

      await tx.opsAuditLog.create({
        data: {
          id: `aud_${randomUUID()}`,
          eventId,
          actor: 'PMCM Admin',
          action: `Requested ${category.name} quotes from ${created.length} supplier${created.length === 1 ? '' : 's'}`,
          category: 'suppliers',
          actionType: 'create',
          affectedType: 'supplier_quote_request',
          metadata: toPrismaJson({
            confidentialBid: Boolean(input.confidentialBid),
            deadline: dueDate ? isoDate(dueDate) : null,
          }),
        },
      });

      return created;
    });

    return requests.map((request) => this.mapSupplierQuoteRequest(request));
  }

  async addSupplierQuote(eventId: string, input: AddSupplierQuoteInput) {
    await this.requireEvent(eventId);

    const directorySupplier = await this.suppliersService.resolveQuoteSupplier(input);

    const supplierName = directorySupplier?.name ?? input.supplierName;
    const category = directorySupplier?.category.name ?? input.category;
    const categoryId = directorySupplier?.categoryId ?? input.categoryId ?? null;
    if (!supplierName || !category) {
      throw new BadRequestException('Supplier name and category are required');
    }

    const categoryRange = categoryId
      ? await this.prisma.opsSupplierCategory.findUnique({ where: { id: categoryId } })
      : null;
    const amount = input.amount ?? 0;
    const outsideAcceptableRange =
      amount > 0 &&
      Boolean(
        (typeof categoryRange?.acceptableMin === 'number' && amount < categoryRange.acceptableMin) ||
          (typeof categoryRange?.acceptableMax === 'number' && amount > categoryRange.acceptableMax),
      );

    const quote = await this.prisma.opsSupplierQuote.create({
      data: {
        id: `quote_${randomUUID()}`,
        eventId,
        requestId: input.requestId ?? null,
        supplierId: directorySupplier?.id ?? null,
        categoryId,
        supplierName,
        category,
        amount,
        inclusions: toPrismaJson(input.inclusions ?? []),
        paymentTerms: input.paymentTerms ?? '',
        notes: input.notes ?? '',
        acceptableMin: categoryRange?.acceptableMin ?? null,
        acceptableMax: categoryRange?.acceptableMax ?? null,
        outsideAcceptableRange,
        status: input.status ?? 'received',
      },
    });

    await Promise.all([
      this.audit(
        eventId,
        input.status === 'requested' ? 'PMCM Admin' : 'Supplier',
        `${input.status === 'requested' ? 'Requested' : 'Submitted'} supplier quote: ${supplierName}`,
      ),
      this.notify(
        eventId,
        input.status === 'requested' ? supplierName : 'PMCM Admin',
        input.status === 'requested' ? 'Supplier quote request issued' : 'Supplier quote received',
      ),
    ]);

    return this.mapSupplierQuote(quote);
  }

  async getQuoteRequestByToken(token: string) {
    const request = await this.prisma.opsSupplierQuoteRequest.findUnique({ where: { accessToken: token } });
    if (!request) throw new NotFoundException('Quote request not found');
    const requestWithStatus = await this.expireQuoteRequestIfNeeded(request);
    const event = await this.requireEvent(request.eventId);
    const quote = await this.prisma.opsSupplierQuote.findFirst({
      where: { requestId: request.id },
      orderBy: { createdAt: 'desc' },
    });

    return {
      request: this.mapSupplierQuoteRequest(requestWithStatus),
      quote: quote ? this.mapSupplierQuoteForSupplier(quote) : null,
      eventId: event.id,
      eventName: request.confidentialBid ? 'Confidential event' : event.eventName,
      clientName: request.confidentialBid ? null : event.clientName,
      eventDate: request.confidentialBid ? null : isoDate(event.eventDate),
    };
  }

  async submitSupplierQuoteByToken(token: string, input: SubmitSupplierQuoteInput) {
    const request = await this.prisma.opsSupplierQuoteRequest.findUnique({ where: { accessToken: token } });
    if (!request) throw new NotFoundException('Quote request not found');
    const requestWithStatus = await this.expireQuoteRequestIfNeeded(request);
    if (
      [
        SupplierQuoteRequestStatus.Selected,
        SupplierQuoteRequestStatus.Closed,
        SupplierQuoteRequestStatus.Expired,
      ].includes(requestWithStatus.status as any)
    ) {
      throw new BadRequestException('Quote request is already closed');
    }
    const existing = await this.prisma.opsSupplierQuote.findFirst({ where: { requestId: request.id } });
    if (existing) return this.reviseSupplierQuoteByToken(token, input);

    const category = request.categoryId
      ? await this.prisma.opsSupplierCategory.findUnique({ where: { id: request.categoryId } })
      : null;
    const amount = input.amount;
    const outsideAcceptableRange = Boolean(
      (typeof category?.acceptableMin === 'number' && amount < category.acceptableMin) ||
        (typeof category?.acceptableMax === 'number' && amount > category.acceptableMax),
    );

    const quote = await this.prisma.$transaction(async (tx) => {
      const saved = await tx.opsSupplierQuote.create({
        data: {
          id: `quote_${randomUUID()}`,
          eventId: request.eventId,
          requestId: request.id,
          supplierId: request.supplierId ?? null,
          categoryId: request.categoryId ?? null,
          supplierName: request.supplierName,
          category: request.category,
          amount,
          inclusions: toPrismaJson(input.inclusions ?? []),
          paymentTerms: input.paymentTerms ?? '',
          notes: input.notes ?? '',
          acceptableMin: category?.acceptableMin ?? null,
          acceptableMax: category?.acceptableMax ?? null,
          outsideAcceptableRange,
          status: SupplierQuoteStatus.Received,
          revisionNumber: 1,
        },
      });

      await tx.opsSupplierQuoteRequest.update({
        where: { id: request.id },
        data: { status: SupplierQuoteRequestStatus.Submitted },
      });
      await tx.opsAuditLog.create({
        data: {
          id: `aud_${randomUUID()}`,
          eventId: request.eventId,
          actor: 'Supplier',
          action: `Submitted quote from ${request.supplierName}`,
          category: 'suppliers',
          actionType: 'create',
          affectedType: 'supplier_quote',
          affectedId: saved.id,
          affectedLabel: request.supplierName,
        },
      });
      await tx.opsNotificationLog.create({
        data: {
          id: `not_${randomUUID()}`,
          eventId: request.eventId,
          channel: 'email',
          recipient: 'PMCM Admin',
          message: `${request.supplierName} submitted a ${request.category} quote`,
          status: 'queued',
        },
      });

      return saved;
    });

    return this.mapSupplierQuoteForSupplier(quote);
  }

  async reviseSupplierQuoteByToken(token: string, input: Partial<SubmitSupplierQuoteInput>) {
    const request = await this.prisma.opsSupplierQuoteRequest.findUnique({ where: { accessToken: token } });
    if (!request) throw new NotFoundException('Quote request not found');
    const requestWithStatus = await this.expireQuoteRequestIfNeeded(request);
    if (
      [
        SupplierQuoteRequestStatus.Selected,
        SupplierQuoteRequestStatus.Closed,
        SupplierQuoteRequestStatus.Expired,
      ].includes(requestWithStatus.status as any)
    ) {
      throw new BadRequestException('Quote request is already closed');
    }

    const quote = await this.prisma.opsSupplierQuote.findFirst({ where: { requestId: request.id } });
    if (!quote) throw new NotFoundException('Supplier quote not found');
    if ([SupplierQuoteStatus.Selected, SupplierQuoteStatus.Locked].includes(quote.status as any)) {
      throw new BadRequestException('Supplier quote is already locked');
    }

    const category = request.categoryId
      ? await this.prisma.opsSupplierCategory.findUnique({ where: { id: request.categoryId } })
      : null;
    const amount = input.amount ?? quote.amount;
    const outsideAcceptableRange = Boolean(
      (typeof category?.acceptableMin === 'number' && amount < category.acceptableMin) ||
        (typeof category?.acceptableMax === 'number' && amount > category.acceptableMax),
    );
    const now = new Date();

    const revised = await this.prisma.$transaction(async (tx) => {
      const saved = await tx.opsSupplierQuote.update({
        where: { id: quote.id },
        data: {
          amount,
          ...(input.inclusions ? { inclusions: toPrismaJson(input.inclusions) } : {}),
          ...(input.paymentTerms !== undefined ? { paymentTerms: input.paymentTerms } : {}),
          ...(input.notes !== undefined ? { notes: input.notes } : {}),
          acceptableMin: category?.acceptableMin ?? quote.acceptableMin ?? null,
          acceptableMax: category?.acceptableMax ?? quote.acceptableMax ?? null,
          outsideAcceptableRange,
          status: SupplierQuoteStatus.Revised,
          revisionNumber: ((quote as any).revisionNumber ?? 1) + 1,
          revisedAt: now,
        },
      });
      await tx.opsSupplierQuoteRequest.update({
        where: { id: request.id },
        data: { status: SupplierQuoteRequestStatus.Revised },
      });
      await tx.opsAuditLog.create({
        data: {
          id: `aud_${randomUUID()}`,
          eventId: request.eventId,
          actor: 'Supplier',
          action: `Revised quote from ${request.supplierName}`,
          category: 'suppliers',
          actionType: 'update',
          affectedType: 'supplier_quote',
          affectedId: saved.id,
          affectedLabel: request.supplierName,
        },
      });
      await tx.opsNotificationLog.create({
        data: {
          id: `not_${randomUUID()}`,
          eventId: request.eventId,
          channel: 'email',
          recipient: 'PMCM Admin',
          message: `${request.supplierName} revised a ${request.category} quote`,
          status: 'queued',
        },
      });
      return saved;
    });

    return this.mapSupplierQuoteForSupplier(revised);
  }

  async selectSupplierQuote(eventId: string, quoteId: string) {
    const selected = await this.commercialWorkflowService.selectSupplierQuote(eventId, quoteId);
    return this.mapSupplierQuote(selected);
  }

  async listComplianceRules(actorInput: SampleActorInput = {}) {
    const actor = this.resolveActor(actorInput);
    await this.requireActorRole(actor, [OpsUserRole.PmcmAdmin, OpsUserRole.System], 'compliance rules');
    const rules = await this.prisma.opsComplianceRule.findMany({
      orderBy: [{ active: 'desc' }, { phase: 'asc' }, { title: 'asc' }],
    });
    return rules.map((rule) => this.mapComplianceRule(rule));
  }

  async createComplianceRule(input: CreateComplianceRuleInput, actorInput: SampleActorInput = {}) {
    const actor = this.resolveActor(actorInput);
    await this.requireActorRole(actor, [OpsUserRole.PmcmAdmin, OpsUserRole.System], 'compliance rules');
    if (!input.conditionKey?.trim()) throw new BadRequestException('Condition key is required');
    if (!input.title?.trim()) throw new BadRequestException('Compliance rule title is required');

    const rule = await this.prisma.opsComplianceRule.create({
      data: {
        id: `crule_${randomUUID()}`,
        eventId: input.eventId ?? null,
        eventType: input.eventType?.trim() ?? '',
        phase: input.phase?.trim() || 'planning',
        severity: input.severity?.trim() || 'must_fix',
        layer: input.layer?.trim() || this.layerForSeverity(input.severity),
        conditionKey: input.conditionKey.trim(),
        title: input.title.trim(),
        note: input.note?.trim() ?? '',
        active: input.active ?? true,
      },
    });
    await this.audit(input.eventId, actor.name, `Created compliance rule: ${rule.title}`, {
      actorRole: actor.role,
      actorEmail: actor.email,
      actionType: AuditActionType.Create,
      category: 'compliance',
      affectedType: 'compliance_rule',
      affectedId: rule.id,
      affectedLabel: rule.title,
    });
    return this.mapComplianceRule(rule);
  }

  async updateComplianceRule(ruleId: string, input: UpdateComplianceRuleInput, actorInput: SampleActorInput = {}) {
    const actor = this.resolveActor(actorInput);
    await this.requireActorRole(actor, [OpsUserRole.PmcmAdmin, OpsUserRole.System], 'compliance rules');
    const data: Record<string, unknown> = {};
    if (input.eventId !== undefined) data.eventId = input.eventId || null;
    if (input.eventType !== undefined) data.eventType = input.eventType.trim();
    if (input.phase !== undefined) data.phase = input.phase.trim() || 'planning';
    if (input.severity !== undefined) data.severity = input.severity.trim() || 'must_fix';
    if (input.layer !== undefined) data.layer = input.layer.trim() || this.layerForSeverity(input.severity);
    if (input.conditionKey !== undefined) data.conditionKey = input.conditionKey.trim();
    if (input.title !== undefined) data.title = input.title.trim();
    if (input.note !== undefined) data.note = input.note.trim();
    if (input.active !== undefined) data.active = input.active;

    const rule = await this.prisma.opsComplianceRule
      .update({ where: { id: ruleId }, data })
      .catch(() => {
        throw new NotFoundException('Compliance rule not found');
      });
    await this.audit(rule.eventId ?? undefined, actor.name, `Updated compliance rule: ${rule.title}`, {
      actorRole: actor.role,
      actorEmail: actor.email,
      actionType: AuditActionType.Update,
      category: 'compliance',
      affectedType: 'compliance_rule',
      affectedId: rule.id,
      affectedLabel: rule.title,
    });
    return this.mapComplianceRule(rule);
  }

  async runCompliance(eventId: string, input: ComplianceRunInput = {}) {
    const event = await this.requireEvent(eventId);
    const phase = input.phase?.trim() || 'planning';
    const inquiry = await this.prisma.opsInquiry.findUnique({ where: { id: event.inquiryId } });
    const eventType = inquiry?.eventType ?? '';

    const rules = await this.prisma.opsComplianceRule.findMany({
      where: { active: true, phase },
      orderBy: [{ severity: 'asc' }, { title: 'asc' }],
    });
    const matchingRules = rules.filter((rule) => this.ruleAppliesToEvent(rule, eventId, eventType));

    const checks = await this.prisma.$transaction(async (tx) => {
      await tx.opsComplianceCheck.deleteMany({ where: { eventId } });
      if (matchingRules.length > 0) {
        await tx.opsComplianceCheck.createMany({
          data: matchingRules.map((rule) => ({
            id: `chk_${randomUUID()}`,
            eventId,
            ruleId: rule.id,
            layer: rule.layer,
            severity: rule.severity,
            phase: rule.phase,
            conditionKey: rule.conditionKey,
            title: rule.title,
            status: 'open',
            note: rule.note,
          })),
        });
      }
      await tx.opsEvent.update({
        where: { id: eventId },
        data: { readiness: matchingRules.some((rule) => rule.severity === 'must_fix') ? 'Must-Fix item open' : 'Compliance review open' },
      });
      await tx.opsAuditLog.create({
        data: {
          id: `aud_${randomUUID()}`,
          eventId,
          actor: 'PMCM Admin',
          action: 'Ran compliance checks',
          actionType: 'create',
          category: 'compliance',
          metadata: toPrismaJson({ phase, eventType, ruleCount: matchingRules.length }),
        },
      });
      return tx.opsComplianceCheck.findMany({ where: { eventId }, orderBy: { createdAt: 'desc' } });
    });

    return checks.map((check) => this.mapComplianceCheck(check));
  }

  async resolveCompliance(eventId: string, checkId: string, input: string | ResolveComplianceInput = {}) {
    await this.requireEvent(eventId);
    const resolvedInput: ResolveComplianceInput = typeof input === 'string' ? { note: input } : input;
    const action = resolvedInput.action ?? 'resolve';
    const actorName = resolvedInput.actorName?.trim() || 'PMCM Admin';
    const now = new Date();

    if (action === 'override' && !resolvedInput.overrideReason?.trim()) {
      throw new BadRequestException('Override reason is required');
    }

    const data =
      action === 'override'
        ? {
            status: 'overridden',
            note: resolvedInput.note ?? 'PMCM override recorded.',
            overrideReason: resolvedInput.overrideReason!.trim(),
            overrideAt: now,
            overrideBy: actorName,
          }
        : {
            status: 'resolved',
            note: resolvedInput.note ?? 'Compliance item resolved during PMCM review.',
            resolvedAt: now,
            resolvedBy: actorName,
          };

    const check = await this.prisma.opsComplianceCheck
      .update({
        where: { id: checkId },
        data,
      })
      .catch(() => {
        throw new NotFoundException('Compliance check not found');
      });

    await this.audit(eventId, actorName, action === 'override' ? 'Overrode compliance item' : 'Resolved compliance item', {
      actionType: AuditActionType.Resolve,
      category: 'compliance',
      affectedType: 'compliance_check',
      affectedId: checkId,
      affectedLabel: check.title,
      severity: action === 'override' ? 'warning' : 'info',
      metadata: action === 'override' ? { overrideReason: resolvedInput.overrideReason } : { note: resolvedInput.note },
    });
    return this.mapComplianceCheck(check);
  }

  async listCoordinators(actorInput: SampleActorInput = {}) {
    const actor = this.resolveActor(actorInput);
    await this.requireActorRole(
      actor,
      [OpsUserRole.PmcmAdmin, OpsUserRole.System, OpsUserRole.Coordinator],
      'coordinator directory',
    );

    return this.coordinatorsService.listCoordinators();
  }

  async assignCoordinator(eventId: string, input: CreateCoordinatorAssignmentInput) {
    return this.coordinatorsService.assignCoordinator(eventId, input);
  }

  async acknowledgeCoordinator(eventId: string, assignmentId: string) {
    return this.coordinatorsService.acknowledgeCoordinator(eventId, assignmentId);
  }

  async markPayment(
    eventId: string,
    milestoneId: string,
    status: string,
    actorInput: SampleActorInput = { actorRole: OpsUserRole.PmcmAdmin },
  ) {
    const actor = this.resolveActor(actorInput);
    await this.requireActorRole(actor, [OpsUserRole.PmcmAdmin, OpsUserRole.System], 'payment milestone', eventId);
    return this.billingOperationsService.markPayment(eventId, milestoneId, status, {
      name: actor.name,
      role: actor.role,
      email: actor.email,
    });
  }

  async recordPayment(
    eventId: string,
    milestoneId: string,
    input: RecordPaymentInput,
    actorInput: SampleActorInput = { actorRole: OpsUserRole.PmcmAdmin },
  ) {
    const actor = this.resolveActor(actorInput);
    await this.requireActorRole(actor, [OpsUserRole.PmcmAdmin, OpsUserRole.System], 'payment recording', eventId);
    return this.billingOperationsService.recordPayment(eventId, milestoneId, input, {
      name: actor.name,
      role: actor.role,
      email: actor.email,
    });
  }

  async createBillingSource(eventId: string, input: CreateBillingSourceInput, actorInput: SampleActorInput = {}) {
    const actor = this.resolveActor(actorInput);
    await this.requireActorRole(actor, [OpsUserRole.PmcmAdmin, OpsUserRole.System], 'billing source', eventId);
    return this.billingOperationsService.createBillingSource(eventId, input, {
      name: actor.name,
      role: actor.role,
      email: actor.email,
    });
  }

  async approveBillingSource(
    eventId: string,
    sourceId: string,
    input: ApproveBillingSourceInput = {},
    actorInput: SampleActorInput = {},
  ) {
    const actor = this.resolveActor(actorInput);
    await this.requireActorRole(actor, [OpsUserRole.PmcmAdmin, OpsUserRole.System], 'billing source approval', eventId);
    return this.billingOperationsService.approveBillingSource(eventId, sourceId, input, {
      name: actor.name,
      role: actor.role,
      email: actor.email,
    });
  }

  async generateBillingStatement(
    eventId: string,
    sourceId?: string,
    actorInput: SampleActorInput = { actorRole: OpsUserRole.PmcmAdmin },
  ) {
    const actor = this.resolveActor(actorInput);
    await this.requireActorRole(actor, [OpsUserRole.PmcmAdmin, OpsUserRole.System], 'billing statement', eventId);
    return this.billingOperationsService.generateBillingStatement(eventId, sourceId, {
      name: actor.name,
      role: actor.role,
      email: actor.email,
    });
  }

  async sendBillingStatement(
    eventId: string,
    billingId: string,
    actorInput: SampleActorInput = { actorRole: OpsUserRole.PmcmAdmin },
  ) {
    const actor = this.resolveActor(actorInput);
    await this.requireActorRole(actor, [OpsUserRole.PmcmAdmin, OpsUserRole.System], 'billing statement delivery', eventId);
    return this.billingOperationsService.sendBillingStatement(eventId, billingId, {
      name: actor.name,
      role: actor.role,
      email: actor.email,
    });
  }

  async completePostEventDocument(eventId: string, documentId: string) {
    await this.requireEvent(eventId);

    const document = await this.prisma.opsPostEventDocument
      .update({
        where: { id: documentId },
        data: { status: 'submitted' },
      })
      .catch(() => {
        throw new NotFoundException('Post-event document not found');
      });

    await this.audit(eventId, 'PMCM Admin', `Completed ${document.title}`);
    return this.mapPostEventDocument(document);
  }

  async getCloseGates(eventId: string) {
    return this.eventClosureService.closeGates(eventId);
  }

  async archiveEvent(eventId: string, input: ArchiveEventInput = {}) {
    const event = await this.eventClosureService.archiveEvent(eventId, input);
    return this.mapEvent(event);
  }

  async listEventInsights(eventId: string, actorInput: SampleActorInput = {}) {
    const actor = this.resolveActor(actorInput);
    await this.requireActorRole(actor, [OpsUserRole.PmcmAdmin, OpsUserRole.System], 'event insights', eventId);
    await this.requireEvent(eventId);
    const insights = await this.prisma.opsEventInsight.findMany({
      where: { eventId },
      orderBy: { generatedAt: 'desc' },
    });
    return insights.map((insight) => this.mapEventInsight(insight));
  }

  async generateEventInsights(eventId: string, actorInput: SampleActorInput = {}) {
    const actor = this.resolveActor(actorInput);
    await this.requireActorRole(actor, [OpsUserRole.PmcmAdmin, OpsUserRole.System], 'event insights', eventId);
    const event = await this.requireEvent(eventId);
    const [supplierReviews, complianceChecks, billingStatements, paymentMilestones, documents, postEventDocuments] =
      await Promise.all([
        this.prisma.opsSupplierReview.findMany({ where: { eventId } }),
        this.prisma.opsComplianceCheck.findMany({ where: { eventId } }),
        this.prisma.opsBillingStatement.findMany({ where: { eventId } }),
        this.prisma.opsPaymentMilestone.findMany({ where: { eventId } }),
        this.prisma.opsDocument.findMany({ where: { eventId } }),
        this.prisma.opsPostEventDocument.findMany({ where: { eventId } }),
      ]);

    const totalBilled = billingStatements.reduce((sum, statement) => sum + statement.totalAmount, 0);
    const amountPaid = paymentMilestones.reduce((sum, milestone) => sum + milestone.amountPaid, 0);
    const outstandingAmount = paymentMilestones.reduce((sum, milestone) => sum + milestone.remainingBalance, 0);
    const openChecks = complianceChecks.filter((check) => check.status === 'open');
    const submittedDocuments = documents.filter((document) =>
      ['submitted', 'approved', 'generated', 'sent'].includes(document.status),
    );
    const feedbackDocuments = postEventDocuments.filter((document) =>
      document.title.toLowerCase().includes('feedback') && document.status === 'submitted',
    );

    const summary = `Event Insights for ${event.eventName}: ${supplierReviews.length} supplier review(s), ${openChecks.length} open compliance issue(s), ${totalBilled} total billed.`;
    const highlights = [
      supplierReviews.length > 0 ? `${supplierReviews.length} supplier review(s) captured` : 'No supplier reviews captured',
      submittedDocuments.length > 0 ? `${submittedDocuments.length} submitted/generated document(s)` : 'No close documents submitted',
      outstandingAmount === 0 ? 'Payment schedule closed' : `${outstandingAmount} outstanding payment balance`,
    ];
    const risks = openChecks.map((check) => ({
      title: check.title,
      severity: (check as OpsComplianceCheck & { severity?: string }).severity ?? 'must_fix',
      status: check.status,
    }));
    const supplierNotes = supplierReviews.map((review: any) => ({
      supplierId: review.supplierId,
      rating: review.rating,
      notes: review.notes,
      reviewedBy: review.reviewedBy,
    }));
    const financialSummary = {
      billingCount: billingStatements.length,
      totalBilled,
      amountPaid,
      outstandingAmount,
    };
    const documentSummary = {
      total: documents.length,
      submitted: submittedDocuments.length,
      pendingPostEventDocuments: postEventDocuments.filter((document) => document.status !== 'submitted').length,
    };
    const feedbackSummary = {
      feedbackDocuments: feedbackDocuments.length,
      supplierReviews: supplierReviews.length,
      clientFeedbackSubmitted: feedbackDocuments.length > 0,
    };

    const insight = await this.prisma.opsEventInsight.upsert({
      where: { eventId },
      create: {
        id: `ins_${randomUUID()}`,
        eventId,
        summary,
        highlights: toPrismaJson(highlights),
        risks: toPrismaJson(risks),
        supplierNotes: toPrismaJson(supplierNotes),
        financialSummary: toPrismaJson(financialSummary),
        documentSummary: toPrismaJson(documentSummary),
        feedbackSummary: toPrismaJson(feedbackSummary),
        privateNotes: 'PMCM-only deterministic insight generated from closed event records.',
      },
      update: {
        summary,
        highlights: toPrismaJson(highlights),
        risks: toPrismaJson(risks),
        supplierNotes: toPrismaJson(supplierNotes),
        financialSummary: toPrismaJson(financialSummary),
        documentSummary: toPrismaJson(documentSummary),
        feedbackSummary: toPrismaJson(feedbackSummary),
        privateNotes: 'PMCM-only deterministic insight generated from closed event records.',
        generatedAt: new Date(),
      },
    });

    await this.audit(eventId, actor.name, 'Generated Event Insights', {
      actorRole: actor.role,
      actorEmail: actor.email,
      actionType: AuditActionType.Create,
      category: AuditCategory.Events,
      affectedType: 'event_insight',
      affectedId: insight.id,
      affectedLabel: event.eventName,
      metadata: { totalBilled, supplierReviewCount: supplierReviews.length, openComplianceCount: openChecks.length },
    });

    return this.mapEventInsight(insight);
  }

  private async ensureSeeded() {
    const count = await this.prisma.opsUser.count();
    if (count === 0) {
      await this.seedSample();
    }
    await this.ensureSupplierDirectorySeeded();
    await this.ensureComplianceRulesSeeded();
    await this.ensureSupplierQuoteSampleSeeded();
    await this.ensurePareAssignedSuppliersSeeded();
    await this.ensureCoordinatorPoolSeeded();
    await this.ensureInquiryOnboardingBackfilled();
    await this.ensureSecurityAuditSeeded();
  }

  private async ensureComplianceRulesSeeded() {
    const ruleCount = await this.prisma.opsComplianceRule.count();
    if (ruleCount > 0) return;

    await this.prisma.opsComplianceRule.createMany({
      data: [
        {
          id: 'crule_seed_supplier_contracts',
          eventType: '',
          phase: 'planning',
          severity: 'must_fix',
          layer: 'Must-Fix',
          conditionKey: 'supplier_contracts_ready',
          title: 'Supplier contracts ready',
          note: 'Attach final signed supplier quotations before event lock.',
          active: true,
        },
        {
          id: 'crule_seed_ingress_timing',
          eventType: '',
          phase: 'planning',
          severity: 'watch_out',
          layer: 'Should-Fix',
          conditionKey: 'ingress_timing_ready',
          title: 'Ingress timing ready',
          note: 'Confirm guest arrival and ingress window with assigned suppliers.',
          active: true,
        },
        {
          id: 'crule_seed_floorplan_approved',
          eventType: '',
          phase: 'pre_event',
          severity: 'must_fix',
          layer: 'Must-Fix',
          conditionKey: 'floorplan_approved',
          title: 'Official floorplan approved',
          note: 'PMCM must approve the official layout before final event lock.',
          active: true,
        },
      ],
      skipDuplicates: true,
    });
  }

  private async ensureSupplierQuoteSampleSeeded() {
    const event = await this.prisma.opsEvent.findUnique({ where: { id: 'evt_sample_ayala' } });
    if (!event) return;

    const existingQuoteCount = await this.prisma.opsSupplierQuote.count({
      where: { eventId: event.id, category: 'Technicals' },
    });
    if (existingQuoteCount > 0) return;

    const category = await this.prisma.opsSupplierCategory.findUnique({ where: { id: 'supcat_technicals' } });
    if (!category) return;

    const suppliers = await this.prisma.opsSupplier.findMany({
      where: { id: { in: ['sup_sonicline', 'sup_stagepulse'] } },
      orderBy: { name: 'asc' },
    });
    if (suppliers.length < 2) return;

    const dueDate = addDays(new Date(), 7);
    await this.prisma.$transaction(async (tx) => {
      for (const supplier of suppliers) {
        const isStagePulse = supplier.id === 'sup_stagepulse';
        const requestId = `qr_sample_${supplier.id}`;
        await tx.opsSupplierQuoteRequest.create({
          data: {
            id: requestId,
            eventId: event.id,
            supplierId: supplier.id,
            categoryId: category.id,
            supplierName: supplier.name,
            category: category.name,
            dueDate,
            accessToken: `sample-token-${supplier.id}`,
            confidentialBid: true,
            message: 'Sample confidential technical quote request.',
            status: 'submitted',
          },
        });

        await tx.opsSupplierQuote.create({
          data: {
            id: `quote_sample_${supplier.id}`,
            eventId: event.id,
            requestId,
            supplierId: supplier.id,
            categoryId: category.id,
            supplierName: supplier.name,
            category: category.name,
            amount: isStagePulse ? 205000 : 168000,
            inclusions: toPrismaJson(
              isStagePulse
                ? ['Premium LED wall package', 'Lighting board operator', 'Two technical standbys']
                : ['Audio system', 'Basic LED wall', 'Technical director'],
            ),
            paymentTerms: '50% reservation, 50% before ingress',
            notes: isStagePulse ? 'Includes extended LED wall package.' : 'Within standard technical scope.',
            acceptableMin: category.acceptableMin,
            acceptableMax: category.acceptableMax,
            outsideAcceptableRange: isStagePulse,
            status: 'received',
          },
        });
      }
    });
  }

  private async ensurePareAssignedSuppliersSeeded() {
    const event = await this.prisma.opsEvent.findUnique({ where: { id: 'evt_sample_ayala' } });
    if (!event) return;

    const existing = await this.prisma.opsSupplierQuoteRequest.findFirst({
      where: { eventId: 'evt_sample_ayala', id: 'qr_pare_harvesttable' },
    });
    if (existing) return;

    const now = new Date();
    const dueDate = addDays(now, 14);

    await this.prisma.$transaction(async (tx) => {
      // Harvest Table — assigned (this is the one PARE will replace when withdrawn)
      await tx.opsSupplierQuoteRequest.create({
        data: {
          id: 'qr_pare_harvesttable',
          eventId: 'evt_sample_ayala',
          supplierId: 'sup_harvesttable',
          categoryId: 'supcat_food_beverages',
          supplierName: 'Harvest Table Catering',
          category: 'Food and Beverages',
          message: 'Full buffet service for 300 pax. VIP plated section required. Include crew meals.',
          dueDate,
          accessToken: 'sample-pare-token-harvesttable',
          status: 'open',
          assignmentStatus: 'confirmed',
          assignmentConfirmedAt: now,
          readinessStatus: 'confirmed',
        },
      });
      await tx.opsSupplierQuote.create({
        data: {
          id: 'quote_pare_harvesttable',
          eventId: 'evt_sample_ayala',
          requestId: 'qr_pare_harvesttable',
          supplierId: 'sup_harvesttable',
          categoryId: 'supcat_food_beverages',
          supplierName: 'Harvest Table Catering',
          category: 'Food and Beverages',
          amount: 185000,
          inclusions: toPrismaJson(['Buffet for 300 pax', 'VIP plated section x30', 'Crew meals x20', 'On-site chef', 'Waitstaff x8']),
          paymentTerms: '50% upon booking, 50% on event day',
          notes: 'Menu finalized. Headcount confirmed at 300.',
          status: 'selected',
          selectedAt: now,
        },
      });

      // LensCraft — assigned (second assigned supplier to give more sample options)
      await tx.opsSupplierQuoteRequest.create({
        data: {
          id: 'qr_pare_lenscraft',
          eventId: 'evt_sample_ayala',
          supplierId: 'sup_lenscraft',
          categoryId: 'supcat_documentation',
          supplierName: 'LensCraft Studios',
          category: 'Documentation',
          message: 'Full event documentation: photo, video, same-day edit, raw file turnover.',
          dueDate,
          accessToken: 'sample-pare-token-lenscraft',
          status: 'open',
          assignmentStatus: 'confirmed',
          assignmentConfirmedAt: now,
          readinessStatus: 'confirmed',
        },
      });
      await tx.opsSupplierQuote.create({
        data: {
          id: 'quote_pare_lenscraft',
          eventId: 'evt_sample_ayala',
          requestId: 'qr_pare_lenscraft',
          supplierId: 'sup_lenscraft',
          categoryId: 'supcat_documentation',
          supplierName: 'LensCraft Studios',
          category: 'Documentation',
          amount: 95000,
          inclusions: toPrismaJson(['Full event photo coverage', 'Highlight video', 'Same-day edit', 'Raw file turnover']),
          paymentTerms: '50% upon booking, 50% on event day',
          notes: 'Run-of-show received. All outputs confirmed.',
          status: 'selected',
          selectedAt: now,
        },
      });
    });
  }

  private async ensureCoordinatorPoolSeeded() {
    const coordinatorCount = await this.prisma.opsCoordinator.count();
    if (coordinatorCount > 0) return;

    await this.prisma.opsCoordinator.createMany({
      data: SEEDED_COORDINATORS.map((coordinator) => ({
        id: coordinator.id,
        userId: coordinator.userId ?? null,
        name: coordinator.name,
        email: coordinator.email,
        roleTags: coordinator.roleTags,
        skillsTags: coordinator.skillsTags,
        active: true,
        createdAt: new Date(),
      })),
      skipDuplicates: true,
    });
  }

  private async ensureSecurityAuditSeeded() {
    const alertCount = await this.prisma.opsSecurityAlert.count();
    const loginCount = await this.prisma.opsLoginHistory.count();
    if (alertCount > 0 && loginCount > 0) return;

    const createdAt = new Date();
    const users = await this.prisma.opsUser.findMany();
    const userByEmail = new Map(users.map((user) => [user.email, user]));

    await this.prisma.$transaction(async (tx) => {
      if ((await tx.opsSecurityAlert.count()) === 0) {
        await tx.opsSecurityAlert.createMany({
          data: [
            {
              id: 'seca_seed_lockout',
              type: 'account_lockout',
              title: 'Account lockout threshold reached',
              description: 'A supplier account triggered the failed-login lockout threshold.',
              severity: 'warning',
              status: 'open',
              triggeredBy: 'ops@xperto.test',
              metadata: toPrismaJson({ failedAttempts: LOGIN_LOCKOUT_THRESHOLD }),
              createdAt: addDays(createdAt, -1),
            },
            {
              id: 'seca_seed_bulk_export',
              type: 'bulk_export',
              title: 'Bulk audit export reviewed',
              description: 'PMCM exported more audit records than the configured sample threshold.',
              severity: 'warning',
              status: 'open',
              triggeredBy: 'PMCM Admin',
              metadata: toPrismaJson({ threshold: BULK_EXPORT_ALERT_THRESHOLD, recordCount: 42 }),
              createdAt: addDays(createdAt, -2),
            },
          ],
          skipDuplicates: true,
        });
      }

      if ((await tx.opsLoginHistory.count()) === 0) {
        const ana = userByEmail.get('ana@ayala.test');
        const mys = userByEmail.get('mys@pmcm.test');
        const supplier = userByEmail.get('ops@xperto.test');
        await tx.opsLoginHistory.createMany({
          data: [
            {
              id: 'login_seed_mys_success_1',
              userId: mys?.id ?? null,
              userName: mys?.name ?? 'Ms. Mys',
              userRole: mys?.role ?? 'pmcm-admin',
              email: 'mys@pmcm.test',
              status: 'success',
              ipAddress: '192.168.1.5',
              device: 'Local sample browser',
              createdAt,
            },
            {
              id: 'login_seed_client_blocked',
              userId: ana?.id ?? null,
              userName: ana?.name ?? 'Ana Reyes',
              userRole: ana?.role ?? 'client',
              email: 'ana@ayala.test',
              status: 'blocked',
              failureReason: 'Account waiting for approval',
              ipAddress: '192.168.1.9',
              device: 'Local sample browser',
              createdAt: addDays(createdAt, -1),
            },
            {
              id: 'login_seed_supplier_failed',
              userId: supplier?.id ?? null,
              userName: supplier?.name ?? 'XPERTO Registration',
              userRole: supplier?.role ?? 'supplier',
              email: 'ops@xperto.test',
              status: 'failed',
              failureReason: 'Invalid password',
              ipAddress: '192.168.1.12',
              device: 'Local sample browser',
              createdAt: addDays(createdAt, -2),
            },
          ],
          skipDuplicates: true,
        });
      }
    });
  }

  private async ensureSupplierDirectorySeeded() {
    const categoryCount = await this.prisma.opsSupplierCategory.count();
    const supplierCount = await this.prisma.opsSupplier.count();
    if (categoryCount > 0 && supplierCount > 0) return;

    await this.prisma.$transaction(async (tx) => {
      if ((await tx.opsSupplierCategory.count()) === 0) {
        await tx.opsSupplierCategory.createMany({
          data: SUPPLIER_CATEGORIES.map((category) => ({
            ...category,
            createdAt: new Date(),
          })),
          skipDuplicates: true,
        });
      }

      if ((await tx.opsSupplier.count()) === 0) {
        const seedEvent = await tx.opsEvent.findUnique({
          where: { id: 'evt_sample_ayala' },
          select: { id: true },
        });
        const seedEventId = seedEvent?.id ?? null;

        await tx.opsSupplier.createMany({
          data: SEEDED_SUPPLIERS.map((supplier) => ({
            id: supplier.id,
            categoryId: supplier.categoryId,
            name: supplier.name,
            contactName: supplier.contactName,
            email: supplier.email,
            phone: supplier.phone,
            tier: supplier.tier,
            bniMember: supplier.bniMember,
            serviceInclusions: supplier.serviceInclusions,
            performanceNotes: supplier.performanceNotes,
            applicationDate: new Date('2026-03-01'),
            createdAt: new Date(),
          })),
          skipDuplicates: true,
        });

        for (const supplier of SEEDED_SUPPLIERS) {
          await tx.opsSupplierCertification.createMany({
            data: supplier.certifications.map((fileName, index) => ({
              id: `cert_${supplier.id}_${index + 1}`,
              supplierId: supplier.id,
              fileName,
            })),
            skipDuplicates: true,
          });
        }

        await tx.opsSupplierReview.createMany({
          data: [
            {
              id: 'review_xperto_ayala',
              supplierId: 'sup_xperto',
              eventId: seedEventId,
              rating: 5,
              notes: 'Registration desk was ready before client walkthrough and exported clean attendance data.',
              reviewedBy: 'Ms. Mys',
              createdAt: new Date('2026-06-19'),
            },
            {
              id: 'review_brightstage_ayala',
              supplierId: 'sup_brightstage',
              eventId: seedEventId,
              rating: 4,
              notes: 'Production ingress was smooth; final cable dressing needed one PMCM reminder.',
              reviewedBy: 'Ms. Mys',
              createdAt: new Date('2026-06-19'),
            },
            {
              id: 'review_lenscraft_ayala',
              supplierId: 'sup_lenscraft',
              eventId: seedEventId,
              rating: 5,
              notes: 'Delivered same-day preview set and organized file turnover.',
              reviewedBy: 'EA',
              createdAt: new Date('2026-06-20'),
            },
          ],
          skipDuplicates: true,
        });

        await tx.opsSupplierReliabilityNote.createMany({
          data: [
            {
              id: 'rel_xperto_ayala',
              supplierId: 'sup_xperto',
              eventId: seedEventId,
              note: 'Arrived 45 minutes before registration desk setup call time.',
              createdAt: new Date('2026-06-19'),
            },
            {
              id: 'rel_brightstage_ayala',
              supplierId: 'sup_brightstage',
              eventId: seedEventId,
              note: 'Needs final cable dressing check before client walkthrough.',
              createdAt: new Date('2026-06-19'),
            },
            {
              id: 'rel_newwave_pending',
              supplierId: 'sup_newwave',
              eventId: null,
              note: 'Approved supplier application; do not auto-suggest until first event review.',
              createdAt: new Date('2026-04-15'),
            },
          ],
          skipDuplicates: true,
        });
      }
    });
  }

  private async ensureInquiryOnboardingBackfilled() {
    const acceptedInquiries = await this.prisma.opsInquiry.findMany({
      where: {
        status: 'accepted',
        OR: [{ acceptedAt: null }, { conformeSentAt: null }],
      },
    });

    for (const inquiry of acceptedInquiries) {
      const event = await this.prisma.opsEvent.findFirst({ where: { inquiryId: inquiry.id } });
      const signedConforme = event
        ? await this.prisma.opsDocument.findFirst({
            where: { eventId: event.id, type: 'signed_conforme' },
            orderBy: { uploadedAt: 'desc' },
          })
        : null;
      const signedAt = signedConforme?.uploadedAt ?? null;

      await this.prisma.opsInquiry.update({
        where: { id: inquiry.id },
        data: {
          acceptedAt: inquiry.acceptedAt ?? inquiry.createdAt,
          conformeSentAt: inquiry.conformeSentAt ?? inquiry.createdAt,
          ...(signedAt
            ? {
                conformeSignedAt: inquiry.conformeSignedAt ?? signedAt,
                portalActivatedAt: inquiry.portalActivatedAt ?? event?.createdAt ?? signedAt,
                portalInvitationStatus:
                  inquiry.portalInvitationStatus === 'not_sent'
                    ? 'opened'
                    : inquiry.portalInvitationStatus,
                portalInvitationSentAt: inquiry.portalInvitationSentAt ?? event?.createdAt ?? signedAt,
                portalInvitationOpenedAt: inquiry.portalInvitationOpenedAt ?? signedAt,
                portalInvitationExpiresAt:
                  inquiry.portalInvitationExpiresAt ?? addDays(event?.createdAt ?? signedAt, 7),
              }
            : {}),
        },
      });
    }
  }

  private async seedSample(createdAt = new Date()) {
    await this.prisma.$transaction(async (tx) => {
      await tx.opsUser.createMany({
        data: [
          {
            id: 'usr_pmcm',
            name: 'Ms. Mys',
            email: 'mys@pmcm.test',
            password: AuthSecurityService.hashPassword('prism-admin'),
            role: 'pmcm-admin',
            organization: 'PMCM Events',
            approvalStatus: 'approved',
            createdAt,
          },
          {
            id: 'usr_client',
            name: 'Ana Reyes',
            email: 'ana@ayala.test',
            password: AuthSecurityService.hashPassword('prism-client'),
            role: 'client',
            organization: 'Ayala Corp',
            approvalStatus: 'approved',
            createdAt,
          },
          {
            id: 'usr_coord',
            name: 'Marco Santos',
            email: 'marco@pmcm.test',
            password: AuthSecurityService.hashPassword('prism-coordinator'),
            role: 'coordinator',
            organization: 'PMCM Events',
            approvalStatus: 'approved',
            createdAt,
          },
          {
            id: 'usr_supplier',
            name: 'XPERTO Registration',
            email: 'ops@xperto.test',
            password: AuthSecurityService.hashPassword('prism-supplier'),
            role: 'supplier',
            organization: 'XPERTO Registration',
            approvalStatus: 'approved',
            createdAt,
          },
        ],
      });

      await tx.opsInquiry.create({
        data: {
          id: 'inq_sample_ayala',
          clientName: 'Ana Reyes',
          companyName: 'Ayala Corp',
          email: 'ana@ayala.test',
          eventName: 'Ayala Tech Summit 2026',
          eventType: 'Corporate Summit',
          eventDate: new Date('2026-06-18'),
          clientType: 'Corporate',
          source: 'Website',
          message: 'End-to-end planning, registration, staging, and post-event documentation.',
          status: 'accepted',
          acceptedAt: createdAt,
          conformeSentAt: createdAt,
          conformeSignedAt: createdAt,
          portalActivatedAt: createdAt,
          portalInvitationStatus: 'opened',
          portalInvitationSentAt: createdAt,
          portalInvitationOpenedAt: createdAt,
          portalInvitationExpiresAt: addDays(createdAt, 7),
          privacyConsentAccepted: true,
          privacyNoticeVersion: '2026-05-01',
          marketingConsentAccepted: false,
          createdAt,
        },
      });

      await tx.opsInquiry.createMany({
        data: [
          {
            id: 'inq_sample_facebook_new',
            clientName: 'Mika Tan',
            companyName: 'Northstar Retail',
            email: 'mika@northstar.test',
            eventName: 'Northstar Dealer Night',
            eventType: 'Dealer Night',
            eventDate: new Date('2026-08-12'),
            clientType: 'Corporate',
            source: 'Facebook',
            message: 'Initial inquiry from Facebook Messenger for a dealer appreciation night.',
            status: 'new',
            createdAt: addDays(createdAt, -1),
          },
          {
            id: 'inq_sample_bni_pending',
            clientName: 'Leo Garcia',
            companyName: 'Harbor Finance',
            email: 'leo@harbor.test',
            eventName: 'Harbor Leadership Forum',
            eventType: 'Leadership Forum',
            eventDate: new Date('2026-09-04'),
            clientType: 'Corporate',
            source: 'BNI',
            message: 'PMCM waiting for budget confirmation before accepting.',
            status: 'pending',
            pendingAt: addDays(createdAt, -2),
            createdAt: addDays(createdAt, -2),
          },
          {
            id: 'inq_sample_walkin_declined',
            clientName: 'Ria Santos',
            companyName: '',
            email: 'ria@example.test',
            eventName: 'Private Birthday Celebration',
            eventType: 'Private Celebration',
            eventDate: new Date('2026-05-18'),
            clientType: 'Social',
            source: 'Walk-In',
            message: 'Requested date is not available for the PMCM team.',
            status: 'declined',
            declineReason: 'Date Unavailable',
            declinedAt: addDays(createdAt, -3),
            createdAt: addDays(createdAt, -3),
          },
        ],
      });

      await tx.opsApprovalRequest.create({
        data: {
          id: 'approval_usr_client',
          userId: 'usr_client',
          name: 'Ana Reyes',
          email: 'ana@ayala.test',
          role: 'client',
          organization: 'Ayala Corp',
          status: 'approved',
          requestedAt: createdAt,
        },
      });

      await tx.opsEvent.create({
        data: {
          id: 'evt_sample_ayala',
          inquiryId: 'inq_sample_ayala',
          clientName: 'Ana Reyes',
          eventName: 'Ayala Tech Summit 2026',
          eventDate: new Date('2026-06-18'),
          status: 'planning',
          clientPortalStatus: 'unlocked',
          readiness: 'Floorplan approved',
          archived: false,
          floorPlanStatus: 'approved',
          floorPlanId: 'plan_sample_ayala_main',
          floorPlanSubmittedAt: createdAt,
          floorPlanReviewedAt: createdAt,
          createdAt,
          updatedAt: createdAt,
        },
      });

      await tx.floorPlan.create({
        data: {
          id: 'plan_sample_ayala_main',
          name: 'Ayala Tech Summit ballroom layout',
          ownerId: DEFAULT_OWNER_ID,
          eventId: 'evt_sample_ayala',
          width: 1200,
          height: 800,
          gridSize: 20,
          objects: toPrismaJson([
            {
              id: 'stage_sample',
              name: 'Main stage',
              kind: 'rect',
              category: 'stage',
              x: 2,
              y: 1,
              w: 10,
              h: 3,
              rotation: 0,
              fill: '#263d32',
              stroke: '#17251f',
              strokeWidth: 0.05,
              label: 'Main stage',
              locked: false,
              hidden: false,
            },
          ]),
          seats: toPrismaJson([]),
          seatCategories: toPrismaJson(defaultSeatCategories()),
          updatedAt: createdAt,
        },
      });

      await tx.opsFloorPlanDraft.createMany({
        data: [
          {
            id: 'fpd_sample_approved',
            eventId: 'evt_sample_ayala',
            floorPlanId: 'plan_sample_ayala_main',
            name: 'Approved ballroom layout',
            status: 'approved',
            isActive: true,
            sourceType: 'template',
            createdByRole: 'pmcm-admin',
            submittedAt: createdAt,
            reviewedAt: createdAt,
            approvedAt: createdAt,
            createdAt,
            updatedAt: createdAt,
          },
        ],
      });

      await tx.opsDocument.create({
        data: {
          id: 'doc_sample_conforme',
          eventId: 'evt_sample_ayala',
          type: 'signed_conforme',
          fileName: 'ayala-signed-conforme.pdf',
          status: 'approved',
          mimeType: 'application/pdf',
          sizeBytes: 128000,
          uploadedByRole: 'client',
          uploadedAt: createdAt,
        },
      });

      await tx.opsBillingStatement.create({
        data: {
          id: 'bill_sample_ayala',
          eventId: 'evt_sample_ayala',
          number: 'BS-2026-0001',
          clientName: 'Ana Reyes',
          clientContact: 'ana@ayala.test',
          eventName: 'Ayala Summit',
          eventDate: new Date('2026-06-18'),
          lineItems: toPrismaJson([{ label: 'Approved event package', amount: 520000 }]),
          paymentSchedule: toPrismaJson([
            { label: 'Downpayment', percentage: 50, amount: 260000, dueDate: '2026-04-29' },
            { label: 'Balance', percentage: 50, amount: 260000, dueDate: '2026-06-11' },
          ]),
          paymentMethods: toPrismaJson([
            { label: 'Bank Transfer', details: 'PMCM corporate bank account' },
            { label: 'GCash', details: 'PMCM finance GCash number' },
            { label: 'Cheque', details: 'Payable to PMCM Events Management' },
          ]),
          totalAmount: 520000,
          documentId: 'doc_sample_billing',
          pdfUrl: '/api/documents/doc_sample_billing/signed-url',
          storageKey: 'events/evt_sample_ayala/billing/BS-2026-0001.pdf',
          status: 'issued',
          generatedAt: createdAt,
        },
      });

      await tx.opsDocument.create({
        data: {
          id: 'doc_sample_billing',
          eventId: 'evt_sample_ayala',
          type: 'billing_statement',
          fileName: 'BS-2026-0001.pdf',
          status: 'generated',
          mimeType: 'application/pdf',
          sizeBytes: 0,
          storageBucket: 'document-vault',
          storageKey: 'events/evt_sample_ayala/billing/BS-2026-0001.pdf',
          uploadedByRole: 'system',
          uploadedAt: createdAt,
        },
      });

      await tx.opsPaymentMilestone.createMany({
        data: [
          {
            id: 'pay_sample_reservation',
            eventId: 'evt_sample_ayala',
            label: 'Downpayment',
            percentage: 50,
            amount: 260000,
            amountPaid: 260000,
            remainingBalance: 0,
            dueDate: createdAt,
            status: 'paid',
            createdAt,
          },
          {
            id: 'pay_sample_final',
            eventId: 'evt_sample_ayala',
            label: 'Balance',
            percentage: 50,
            amount: 260000,
            amountPaid: 0,
            remainingBalance: 260000,
            dueDate: new Date('2026-06-11'),
            status: 'pending',
            createdAt,
          },
        ],
      });

      await tx.opsPaymentRecord.create({
        data: {
          id: 'payrec_sample_downpayment',
          eventId: 'evt_sample_ayala',
          milestoneId: 'pay_sample_reservation',
          amountReceived: 260000,
          paymentDate: createdAt,
          paymentMethod: 'Bank Transfer',
          referenceNumber: 'BPI-SAMPLE-001',
          recordedAt: createdAt,
        },
      });

      await tx.opsPostEventDocument.createMany({
        data: [
          { id: 'ped_completion', eventId: 'evt_sample_ayala', title: 'Completion report', status: 'pending' },
          { id: 'ped_gallery', eventId: 'evt_sample_ayala', title: 'Photo and video turnover', status: 'pending' },
        ],
      });

      await tx.opsAuditLog.create({
        data: {
          id: 'aud_seed',
          eventId: 'evt_sample_ayala',
          actor: 'PMCM Admin',
          action: 'Created sample event workspace',
          createdAt,
        },
      });
    });
  }

  private async openEventWorkspace(inquiry: OpsInquiry) {
    const existing = await this.prisma.opsEvent.findFirst({ where: { inquiryId: inquiry.id } });
    if (existing) return existing;

    return this.prisma.$transaction(async (tx) => {
      const event = await tx.opsEvent.create({
        data: {
          id: `evt_${randomUUID()}`,
          inquiryId: inquiry.id,
          clientName: inquiry.clientName,
          eventName: inquiry.eventName,
          eventDate: inquiry.eventDate,
          status: 'planning',
          clientPortalStatus: 'locked',
          readiness: 'Conforme pending',
        },
      });
      await tx.opsPostEventDocument.createMany({
        data: [
          { id: `ped_${randomUUID()}`, eventId: event.id, title: 'Completion report', status: 'pending' },
          { id: `ped_${randomUUID()}`, eventId: event.id, title: 'Photo and video turnover', status: 'pending' },
        ],
      });
      await tx.opsAuditLog.create({
        data: {
          id: `aud_${randomUUID()}`,
          eventId: event.id,
          actor: 'PMCM Admin',
          action: 'Accepted inquiry and opened event workspace',
        },
      });
      await tx.opsNotificationLog.create({
        data: {
          id: `not_${randomUUID()}`,
          eventId: event.id,
          channel: 'email',
          recipient: inquiry.email,
          message: 'Inquiry accepted',
          status: 'queued',
        },
      });
      return event;
    });
  }

  private async requireEvent(eventId: string) {
    const event = await this.prisma.opsEvent.findUnique({ where: { id: eventId } });
    if (!event) throw new NotFoundException('Event not found');
    return event;
  }

  private layerForSeverity(severity?: string) {
    if (severity === 'watch_out' || severity === 'should_fix') return 'Should-Fix';
    if (severity === 'advisory') return 'Advisory';
    return 'Must-Fix';
  }

  private ruleAppliesToEvent(rule: OpsComplianceRule, eventId: string, eventType: string) {
    const eventScoped = !rule.eventId || rule.eventId === eventId;
    const typeScoped = !rule.eventType || this.sameText(rule.eventType, eventType);
    return eventScoped && typeScoped;
  }

  private privacySurface(
    surface: string,
    recordCount: number,
    dataCategories: string[],
    records: Array<{ privacyConsentAccepted?: boolean; privacyNoticeVersion?: string; marketingConsentAccepted?: boolean } | null | undefined>,
  ) {
    const presentRecords = records.filter(Boolean) as Array<{
      privacyConsentAccepted?: boolean;
      privacyNoticeVersion?: string;
      marketingConsentAccepted?: boolean;
    }>;
    return {
      surface,
      recordCount,
      dataCategories,
      consentAcceptedCount: presentRecords.filter((record) => Boolean(record.privacyConsentAccepted)).length,
      missingConsentCount: Math.max(0, recordCount - presentRecords.filter((record) => Boolean(record.privacyConsentAccepted)).length),
      marketingConsentAcceptedCount: presentRecords.filter((record) => Boolean(record.marketingConsentAccepted)).length,
      privacyNoticeVersions: Array.from(
        new Set(presentRecords.map((record) => record.privacyNoticeVersion).filter(Boolean)),
      ),
    };
  }

  private async requireEventDayWriteActor(eventId: string, actorInput: SampleActorInput, resource: string) {
    const actor = this.resolveActor(actorInput);
    await this.requireActorRole(
      actor,
      [OpsUserRole.PmcmAdmin, OpsUserRole.System, OpsUserRole.Coordinator],
      resource,
      eventId,
    );
    await this.requireEvent(eventId);
    const assignment =
      actor.role === OpsUserRole.Coordinator
        ? await this.requireCoordinatorAssignmentForEvent(eventId, actor)
        : null;
    return { actor, assignment };
  }

  private async resolveCoordinatorForActor(actor: ResolvedSampleActor) {
    const coordinators = await this.prisma.opsCoordinator.findMany({
      where: { active: true },
      orderBy: { name: 'asc' },
    });
    const coordinator = coordinators.find(
      (item: any) =>
        this.sameText(actor.coordinatorId, item.id) ||
        this.sameText(actor.email, item.email) ||
        this.sameText(actor.name, item.name),
    );
    if (!coordinator) throw new NotFoundException('Coordinator profile not found for actor');
    return coordinator;
  }

  private async requireCoordinatorAssignmentForEvent(eventId: string, actor: ResolvedSampleActor) {
    const coordinator = await this.resolveCoordinatorForActor(actor);
    const assignments = await this.prisma.opsCoordinatorAssignment.findMany({ where: { eventId } });
    const assignment = assignments.find(
      (item: any) =>
        this.sameText(item.coordinatorId, coordinator.id) ||
        this.sameText(item.coordinatorName, coordinator.name) ||
        this.sameText(item.coordinatorName, actor.name),
    );
    if (!assignment) {
      await this.recordForbiddenAccess(actor, 'assigned event-day operations', eventId);
      throw new ForbiddenException('Coordinator is not assigned to this event');
    }
    return assignment;
  }

  private async recordEventDayLog(
    eventId: string,
    actionType: string,
    actor: ResolvedSampleActor,
    message: string,
    relatedType?: string,
    relatedId?: string,
    metadata: Record<string, unknown> = {},
  ) {
    return this.prisma.opsEventDayLog.create({
      data: {
        id: `edl_${randomUUID()}`,
        eventId,
        actionType,
        actor: actor.name,
        actorRole: actor.role,
        message,
        relatedType: relatedType ?? null,
        relatedId: relatedId ?? null,
        metadata: toPrismaJson(metadata),
      },
    });
  }

  private isRegistrationRole(role: string) {
    const normalized = role.toLowerCase();
    return normalized.includes('registration') || normalized.includes('usher');
  }

  private validateEscalationLevel(value?: string) {
    const escalationLevel = value?.trim();
    const allowed = [
      LiveOpsEscalationLevel.RoleLead,
      LiveOpsEscalationLevel.Pmcm,
      LiveOpsEscalationLevel.Critical,
    ];
    if (!allowed.includes(escalationLevel as any)) {
      throw new BadRequestException('Unsupported escalation level');
    }
    return escalationLevel as (typeof allowed)[number];
  }

  private async requireSupplierQuoteRequestForActor(requestId: string, actorInput: SampleActorInput = {}) {
    const actor = this.resolveActor(actorInput);
    await this.requireActorRole(actor, [OpsUserRole.Supplier], 'supplier quote request');
    const supplier = await this.resolveSupplierForActor(actor);
    const request = await this.prisma.opsSupplierQuoteRequest.findUnique({ where: { id: requestId } });
    if (!request) throw new NotFoundException('Supplier quote request not found');
    if (request.supplierId !== supplier.id) {
      await this.recordForbiddenAccess(actor, 'supplier quote request', request.id);
      throw new ForbiddenException('Supplier cannot access this quote request');
    }
    return { request, actor, supplier };
  }

  private async resolveSupplierForActor(actor: ResolvedSampleActor) {
    const suppliers = await this.suppliersService.listSuppliers();
    const supplier = suppliers.find(
      (item: any) =>
        this.sameText(actor.supplierId, item.id) ||
        this.sameText(actor.email, item.email) ||
        this.sameText(actor.name, item.name),
    );
    if (!supplier) throw new NotFoundException('Supplier profile not found for actor');
    return supplier;
  }

  private sanitizeSupplierForSupplier(supplier: any) {
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

  private async expireQuoteRequestIfNeeded(request: OpsSupplierQuoteRequest) {
    const requestWithStatus = this.withExpiredQuoteRequestStatus(request);
    if (requestWithStatus.status === request.status) return request;
    return this.prisma.opsSupplierQuoteRequest.update({
      where: { id: request.id },
      data: { status: requestWithStatus.status },
    });
  }

  private detectAiDataCategories(payload: Record<string, unknown>) {
    const serialized = JSON.stringify(payload).toLowerCase();
    const categories = new Set<string>();
    if (serialized.includes('client') || serialized.includes('email') || serialized.includes('phone')) {
      categories.add('client_contact');
    }
    if (serialized.includes('supplier')) categories.add('supplier');
    if (serialized.includes('amount') || serialized.includes('billing') || serialized.includes('payment')) {
      categories.add('financial');
    }
    if (serialized.includes('guest')) categories.add('guest');
    if (categories.size === 0) categories.add('operational');
    return [...categories];
  }

  private async audit(
    eventId: string | undefined,
    actor: string,
    action: string,
    options: Omit<AuditLogInput, 'eventId' | 'actor' | 'action'> = {},
  ) {
    return this.auditService.audit(eventId, actor, action, options);
  }

  private notify(eventId: string | undefined, recipient: string, message: string, channel: 'email' | 'viber' = 'email') {
    return this.notificationOutboxService.queue(eventId, recipient, message, channel);
  }

  private mapUser(user: OpsUser) {
    return {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      organization: user.organization,
      approvalStatus: user.approvalStatus,
      lastLoginAt: user.lastLoginAt ? timestamp(user.lastLoginAt) : null,
      lockedUntil: user.lockedUntil ? timestamp(user.lockedUntil) : null,
      permanentLockout: user.permanentLockout,
    };
  }

  private mapInquiry(inquiry: OpsInquiry) {
    const triage = inquiry as OpsInquiry & {
      normalizedEmail?: string;
      referralDetails?: string;
      loggedByRole?: string | null;
      loggedByName?: string | null;
      duplicateOfInquiryId?: string | null;
      previousDeclinedInquiryId?: string | null;
      previousDeclineReason?: string | null;
      privacyConsentAccepted?: boolean;
      privacyNoticeVersion?: string;
      marketingConsentAccepted?: boolean;
    };
    const reminderBase = inquiry.lastConformeReminderAt ?? inquiry.conformeSentAt;
    const reminderDueAt =
      inquiry.status === 'accepted' && !inquiry.conformeSignedAt && reminderBase
        ? addDays(reminderBase, inquiry.followUpIntervalDays)
        : null;
    const invitationStatus =
      inquiry.portalInvitationStatus === 'sent' &&
      inquiry.portalInvitationExpiresAt &&
      !inquiry.portalInvitationOpenedAt &&
      inquiry.portalInvitationExpiresAt < new Date()
        ? 'expired'
        : inquiry.portalInvitationStatus;

    return {
      id: inquiry.id,
      clientName: inquiry.clientName,
      companyName: inquiry.companyName,
      email: inquiry.email,
      eventName: inquiry.eventName,
      eventType: inquiry.eventType,
      eventDate: isoDate(inquiry.eventDate),
      clientType: inquiry.clientType,
      source: inquiry.source,
      normalizedEmail: triage.normalizedEmail ?? inquiry.email.trim().toLowerCase(),
      referralDetails: triage.referralDetails ?? '',
      loggedByRole: triage.loggedByRole ?? null,
      loggedByName: triage.loggedByName ?? null,
      duplicateOfInquiryId: triage.duplicateOfInquiryId ?? null,
      previousDeclinedInquiryId: triage.previousDeclinedInquiryId ?? null,
      previousDeclineReason: triage.previousDeclineReason ?? null,
      duplicate: Boolean(triage.duplicateOfInquiryId),
      previouslyDeclined: Boolean(triage.previousDeclinedInquiryId),
      privacyConsentAccepted: triage.privacyConsentAccepted ?? false,
      privacyNoticeVersion: triage.privacyNoticeVersion ?? '',
      marketingConsentAccepted: triage.marketingConsentAccepted ?? false,
      message: inquiry.message,
      status: inquiry.status,
      declineReason: inquiry.declineReason,
      acceptedAt: inquiry.acceptedAt ? timestamp(inquiry.acceptedAt) : null,
      pendingAt: inquiry.pendingAt ? timestamp(inquiry.pendingAt) : null,
      declinedAt: inquiry.declinedAt ? timestamp(inquiry.declinedAt) : null,
      conformeSentAt: inquiry.conformeSentAt ? timestamp(inquiry.conformeSentAt) : null,
      conformeSignedAt: inquiry.conformeSignedAt ? timestamp(inquiry.conformeSignedAt) : null,
      portalActivatedAt: inquiry.portalActivatedAt ? timestamp(inquiry.portalActivatedAt) : null,
      followUpIntervalDays: inquiry.followUpIntervalDays,
      lastConformeReminderAt: inquiry.lastConformeReminderAt
        ? timestamp(inquiry.lastConformeReminderAt)
        : null,
      reminderDueAt: reminderDueAt ? timestamp(reminderDueAt) : null,
      reminderDue: Boolean(reminderDueAt && reminderDueAt <= new Date()),
      portalInvitationStatus: invitationStatus,
      portalInvitationSentAt: inquiry.portalInvitationSentAt
        ? timestamp(inquiry.portalInvitationSentAt)
        : null,
      portalInvitationOpenedAt: inquiry.portalInvitationOpenedAt
        ? timestamp(inquiry.portalInvitationOpenedAt)
        : null,
      portalInvitationExpiresAt: inquiry.portalInvitationExpiresAt
        ? timestamp(inquiry.portalInvitationExpiresAt)
        : null,
      createdAt: timestamp(inquiry.createdAt),
    };
  }

  private mapEvent(event: EventWithDrafts) {
    const floorPlanDrafts = event.floorPlanDrafts ?? [];
    const activeDraft =
      floorPlanDrafts.find((draft) => draft.isActive) ??
      floorPlanDrafts.find((draft) => draft.floorPlanId === event.floorPlanId);

    return {
      id: event.id,
      inquiryId: event.inquiryId,
      clientName: event.clientName,
      eventName: event.eventName,
      eventDate: isoDate(event.eventDate),
      status: event.status,
      clientPortalStatus: event.clientPortalStatus as 'locked' | 'unlocked',
      readiness: event.readiness,
      archived: event.archived,
      floorPlanStatus: event.floorPlanStatus,
      floorPlanId: event.floorPlanId,
      guestAccessCode: this.guestAccessCode(event),
      activeFloorPlanDraftId: activeDraft?.id,
      floorPlanDrafts: floorPlanDrafts.map((draft) => this.floorPlanWorkflowService.mapFloorPlanDraft(draft)),
    };
  }

  private mapGuestEvent(event: EventWithDrafts, attendanceCount = 0) {
    const mapped = this.mapEvent(event);

    return {
      id: mapped.id,
      eventName: mapped.eventName,
      eventDate: mapped.eventDate,
      clientName: mapped.clientName,
      readiness: mapped.readiness,
      floorPlanStatus: mapped.floorPlanStatus,
      activeFloorPlanDraftId: mapped.activeFloorPlanDraftId,
      guestAccessCode: mapped.guestAccessCode,
      attendanceCount,
    };
  }

  private guestAccessCode(event: Pick<OpsEvent, 'id' | 'eventName'>) {
    const namePart =
      event.eventName
        .toUpperCase()
        .replace(/[^A-Z0-9]+/g, '-')
        .split('-')
        .filter(Boolean)
        .slice(0, 2)
        .join('-') || 'PRISM';
    const idPart = event.id.replace(/[^a-zA-Z0-9]/g, '').slice(-4).toUpperCase() || 'EVNT';

    return `${namePart}-${idPart}`;
  }

  private normalizeGuestAccessCode(accessCode: string) {
    return accessCode.trim().toUpperCase().replace(/\s+/g, '-');
  }

  private mapDocument(document: OpsDocument) {
    const expanded = document as OpsDocument & {
      generatedFileName?: string | null;
      validationStatus?: string;
      rejectionReason?: string | null;
    };
    return {
      id: document.id,
      eventId: document.eventId,
      type: document.type,
      fileName: document.fileName,
      generatedFileName: expanded.generatedFileName ?? null,
      status: document.status,
      validationStatus: expanded.validationStatus ?? 'accepted',
      rejectionReason: expanded.rejectionReason ?? null,
      uploadedAt: timestamp(document.uploadedAt),
    };
  }

  private mapBriefing(briefing: OpsBriefing) {
    return {
      eventId: briefing.eventId,
      venue: briefing.venue,
      guestCount: briefing.guestCount,
      budgetRange: briefing.budgetRange,
      serviceRequirements: Array.isArray(briefing.serviceRequirements)
        ? (briefing.serviceRequirements as string[])
        : [],
      notes: briefing.notes,
      submittedAt: timestamp(briefing.submittedAt),
    };
  }

  private mapSupplierQuoteRequest(request: OpsSupplierQuoteRequest) {
    const expanded = request as OpsSupplierQuoteRequest & {
      assignmentStatus?: string;
      assignmentConfirmedAt?: Date | null;
      readinessStatus?: string;
      readinessConfirmedAt?: Date | null;
      readinessNotes?: string;
      eventDayStatus?: string;
      eventDayStatusAt?: Date | null;
      eventDayNotes?: string;
      eventDayVerificationStatus?: string;
      eventDayVerifiedAt?: Date | null;
      eventDayVerifiedBy?: string | null;
      eventDayVerificationNotes?: string;
      statusPhotoFileName?: string | null;
      contractDocumentId?: string | null;
    };
    return {
      id: request.id,
      eventId: request.eventId,
      supplierId: request.supplierId ?? undefined,
      categoryId: request.categoryId ?? undefined,
      supplierName: request.supplierName,
      category: request.category,
      message: request.message,
      dueDate: request.dueDate ? isoDate(request.dueDate) : null,
      accessToken: request.accessToken,
      confidentialBid: request.confidentialBid,
      status: request.status,
      assignmentStatus: expanded.assignmentStatus ?? 'pending_confirmation',
      assignmentConfirmedAt: expanded.assignmentConfirmedAt ? timestamp(expanded.assignmentConfirmedAt) : null,
      readinessStatus: expanded.readinessStatus ?? 'not_requested',
      readinessConfirmedAt: expanded.readinessConfirmedAt ? timestamp(expanded.readinessConfirmedAt) : null,
      readinessNotes: expanded.readinessNotes ?? '',
      eventDayStatus: expanded.eventDayStatus ?? 'not_started',
      eventDayStatusAt: expanded.eventDayStatusAt ? timestamp(expanded.eventDayStatusAt) : null,
      eventDayNotes: expanded.eventDayNotes ?? '',
      eventDayVerificationStatus: expanded.eventDayVerificationStatus ?? SupplierVerificationStatus.SelfReported,
      eventDayVerifiedAt: expanded.eventDayVerifiedAt ? timestamp(expanded.eventDayVerifiedAt) : null,
      eventDayVerifiedBy: expanded.eventDayVerifiedBy ?? null,
      eventDayVerificationNotes: expanded.eventDayVerificationNotes ?? '',
      statusPhotoFileName: expanded.statusPhotoFileName ?? null,
      contractDocumentId: expanded.contractDocumentId ?? null,
      createdAt: timestamp(request.createdAt),
    };
  }

  private mapSupplierQuote(quote: OpsSupplierQuote) {
    const expanded = quote as OpsSupplierQuote & {
      revisionNumber?: number;
      revisedAt?: Date | null;
      lockedAt?: Date | null;
      updatedAt?: Date | null;
    };
    const inclusions = Array.isArray(quote.inclusions) ? (quote.inclusions as string[]) : [];
    return {
      id: quote.id,
      eventId: quote.eventId,
      requestId: quote.requestId ?? undefined,
      supplierId: quote.supplierId ?? undefined,
      categoryId: quote.categoryId ?? undefined,
      supplierName: quote.supplierName,
      category: quote.category,
      amount: quote.amount,
      inclusions,
      paymentTerms: quote.paymentTerms,
      notes: quote.notes,
      acceptableMin: quote.acceptableMin ?? null,
      acceptableMax: quote.acceptableMax ?? null,
      outsideAcceptableRange: quote.outsideAcceptableRange,
      status: quote.status,
      revisionNumber: expanded.revisionNumber ?? 1,
      revisedAt: expanded.revisedAt ? timestamp(expanded.revisedAt) : null,
      selectedAt: quote.selectedAt ? timestamp(quote.selectedAt) : null,
      lockedAt: expanded.lockedAt ? timestamp(expanded.lockedAt) : null,
      createdAt: timestamp(quote.createdAt),
      updatedAt: expanded.updatedAt ? timestamp(expanded.updatedAt) : timestamp(quote.createdAt),
    };
  }

  private mapSupplierQuoteForSupplier(quote: OpsSupplierQuote) {
    const { acceptableMin, acceptableMax, outsideAcceptableRange, ...safeQuote } = this.mapSupplierQuote(quote);
    return safeQuote;
  }

  private mapComplianceRule(rule: OpsComplianceRule) {
    return {
      id: rule.id,
      eventId: rule.eventId ?? null,
      eventType: rule.eventType,
      phase: rule.phase,
      severity: rule.severity,
      layer: rule.layer,
      conditionKey: rule.conditionKey,
      title: rule.title,
      note: rule.note,
      active: rule.active,
      createdAt: timestamp(rule.createdAt),
      updatedAt: timestamp(rule.updatedAt),
    };
  }

  private mapComplianceCheck(check: OpsComplianceCheck) {
    const expanded = check as OpsComplianceCheck & {
      ruleId?: string | null;
      severity?: string;
      phase?: string;
      conditionKey?: string;
      resolvedAt?: Date | null;
      resolvedBy?: string | null;
      overrideReason?: string | null;
      overrideAt?: Date | null;
      overrideBy?: string | null;
    };
    return {
      id: check.id,
      eventId: check.eventId,
      ruleId: expanded.ruleId ?? null,
      layer: check.layer as 'Must-Fix' | 'Should-Fix' | 'Advisory',
      severity: expanded.severity ?? 'must_fix',
      phase: expanded.phase ?? 'planning',
      conditionKey: expanded.conditionKey ?? '',
      title: check.title,
      status: check.status as 'open' | 'resolved' | 'overridden',
      note: check.note,
      resolvedAt: expanded.resolvedAt ? timestamp(expanded.resolvedAt) : null,
      resolvedBy: expanded.resolvedBy ?? null,
      overrideReason: expanded.overrideReason ?? null,
      overrideAt: expanded.overrideAt ? timestamp(expanded.overrideAt) : null,
      overrideBy: expanded.overrideBy ?? null,
    };
  }

  private mapPostEventDocument(document: OpsPostEventDocument) {
    return {
      id: document.id,
      eventId: document.eventId,
      title: document.title,
      status: document.status,
    };
  }

  private mapEventInsight(insight: OpsEventInsight) {
    return {
      id: insight.id,
      eventId: insight.eventId,
      summary: insight.summary,
      highlights: Array.isArray(insight.highlights) ? insight.highlights : [],
      risks: Array.isArray(insight.risks) ? insight.risks : [],
      supplierNotes: Array.isArray(insight.supplierNotes) ? insight.supplierNotes : [],
      financialSummary: insight.financialSummary ?? {},
      documentSummary: insight.documentSummary ?? {},
      feedbackSummary: insight.feedbackSummary ?? {},
      privateNotes: insight.privateNotes,
      generatedAt: timestamp(insight.generatedAt),
      updatedAt: timestamp(insight.updatedAt),
    };
  }

  private mapEventDayTask(task: any) {
    return {
      id: task.id,
      eventId: task.eventId,
      title: task.title,
      assignedRole: task.assignedRole,
      ownerName: task.ownerName,
      priority: task.priority,
      status: task.status,
      notes: task.notes,
      dueAt: task.dueAt ? timestamp(task.dueAt) : null,
      slaDueAt: task.slaDueAt ? timestamp(task.slaDueAt) : null,
      slaStatus: this.liveOperationsService.computeSlaStatus(task),
      escalationLevel: task.escalationLevel ?? LiveOpsEscalationLevel.None,
      escalatedAt: task.escalatedAt ? timestamp(task.escalatedAt) : null,
      escalatedBy: task.escalatedBy ?? null,
      escalationNotes: task.escalationNotes ?? '',
      completedAt: task.completedAt ? timestamp(task.completedAt) : null,
      createdAt: timestamp(task.createdAt),
      updatedAt: timestamp(task.updatedAt),
    };
  }

  private mapUrgentIssue(issue: any) {
    return {
      id: issue.id,
      eventId: issue.eventId,
      title: issue.title,
      description: issue.description,
      severity: issue.severity,
      status: issue.status,
      ownerRole: issue.ownerRole,
      ownerName: issue.ownerName,
      resolution: issue.resolution,
      openedBy: issue.openedBy,
      slaDueAt: issue.slaDueAt ? timestamp(issue.slaDueAt) : null,
      slaStatus: this.liveOperationsService.computeSlaStatus(issue),
      escalationLevel: issue.escalationLevel ?? LiveOpsEscalationLevel.None,
      escalatedAt: issue.escalatedAt ? timestamp(issue.escalatedAt) : null,
      escalatedBy: issue.escalatedBy ?? null,
      escalationNotes: issue.escalationNotes ?? '',
      resolvedAt: issue.resolvedAt ? timestamp(issue.resolvedAt) : null,
      createdAt: timestamp(issue.createdAt),
      updatedAt: timestamp(issue.updatedAt),
    };
  }

  private mapEventDayLog(log: any) {
    return {
      id: log.id,
      eventId: log.eventId,
      actionType: log.actionType,
      actor: log.actor,
      actorRole: log.actorRole,
      message: log.message,
      relatedType: log.relatedType ?? null,
      relatedId: log.relatedId ?? null,
      metadata: log.metadata ?? {},
      createdAt: timestamp(log.createdAt),
    };
  }

  private mapCoordinatorAssignmentForEventDay(assignment: any) {
    return {
      ...this.coordinatorsService.mapCoordinatorAssignment(assignment),
      attendanceStatus: assignment.attendanceStatus ?? CoordinatorAttendanceStatus.Pending,
      attendanceMarkedAt: assignment.attendanceMarkedAt ? timestamp(assignment.attendanceMarkedAt) : null,
      attendanceNotes: assignment.attendanceNotes ?? '',
      replacedByAssignmentId: assignment.replacedByAssignmentId ?? null,
      replacementReason: assignment.replacementReason ?? '',
      replacedAt: assignment.replacedAt ? timestamp(assignment.replacedAt) : null,
      replacedBy: assignment.replacedBy ?? null,
    };
  }

  private mapNotificationLog(log: OpsNotificationLog) {
    const expanded = log as OpsNotificationLog & {
      attempts?: number;
      failureReason?: string | null;
      sentAt?: Date | null;
      failedAt?: Date | null;
      acknowledgedAt?: Date | null;
    };
    return {
      id: log.id,
      eventId: log.eventId ?? undefined,
      channel: log.channel as 'email' | 'viber',
      recipient: log.recipient,
      message: log.message,
      status: log.status,
      attempts: expanded.attempts ?? 0,
      failureReason: expanded.failureReason ?? null,
      sentAt: expanded.sentAt ? timestamp(expanded.sentAt) : null,
      failedAt: expanded.failedAt ? timestamp(expanded.failedAt) : null,
      acknowledgedAt: expanded.acknowledgedAt ? timestamp(expanded.acknowledgedAt) : null,
      createdAt: timestamp(log.createdAt),
    };
  }

  private mapGuestCheckIn(checkIn: OpsGuestCheckIn) {
    return {
      id: checkIn.id,
      eventId: checkIn.eventId,
      guestName: checkIn.guestName,
      checkInMode: checkIn.checkInMode,
      status: checkIn.status,
      walkIn: checkIn.walkIn,
      verificationStatus: checkIn.verificationStatus,
      privacyConsentAccepted: (checkIn as any).privacyConsentAccepted ?? false,
      privacyNoticeVersion: (checkIn as any).privacyNoticeVersion ?? '',
      marketingConsentAccepted: (checkIn as any).marketingConsentAccepted ?? false,
      checkedInAt: timestamp(checkIn.checkedInAt),
    };
  }

  private mapGuestFeedback(feedback: OpsGuestFeedback) {
    return {
      id: feedback.id,
      eventId: feedback.eventId,
      guestName: feedback.guestName,
      rating: feedback.rating,
      comment: feedback.comment,
      photoFileName: feedback.photoFileName ?? null,
      videoFileName: feedback.videoFileName ?? null,
      privacyConsentAccepted: (feedback as any).privacyConsentAccepted ?? false,
      privacyNoticeVersion: (feedback as any).privacyNoticeVersion ?? '',
      marketingConsentAccepted: (feedback as any).marketingConsentAccepted ?? false,
      moderationStatus: feedback.moderationStatus,
      submittedAt: timestamp(feedback.submittedAt),
    };
  }

  private mapAiAuditLog(audit: OpsAiAuditLog) {
    return {
      id: audit.id,
      eventId: audit.eventId ?? null,
      featureName: audit.featureName,
      modelVersion: audit.modelVersion,
      dataCategories: Array.isArray(audit.dataCategories) ? audit.dataCategories : [],
      sanitizedPayload: audit.sanitizedPayload ?? {},
      zdrConfirmed: audit.zdrConfirmed,
      humanApprovalRequired: audit.humanApprovalRequired,
      humanApproved: audit.humanApproved,
      status: audit.status,
      createdAt: timestamp(audit.createdAt),
    };
  }

  private mapAiApprovalRecord(approval: OpsAiApprovalRecord) {
    return {
      id: approval.id,
      aiAuditLogId: approval.aiAuditLogId,
      eventId: approval.eventId ?? null,
      featureName: approval.featureName,
      requestedBy: approval.requestedBy,
      humanApproved: approval.humanApproved,
      approvedBy: approval.approvedBy ?? null,
      approvedAt: approval.approvedAt ? timestamp(approval.approvedAt) : null,
      status: approval.status,
      requestedAt: timestamp(approval.requestedAt),
    };
  }
}
