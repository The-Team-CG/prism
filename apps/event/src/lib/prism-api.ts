import type { Project } from "@/features/floorplan/editor";
import { createEventOpsClient } from "@prism/api-client";

import { PRISM_SESSION_STORAGE_KEYS, isPrismAuthenticatedSession } from "@prism/types";
import type {
  ArchiveSearchFilters,
  SampleRole,
  PrismApprovalRequest,
  PrismAuditExport,
  PrismAuditIntegrity,
  PrismAuditLog,
  PrismBillingSource,
  PrismBillingStatement,
  PrismBriefing,
  PrismCloseGates,
  PrismComplianceCheck,
  PrismComplianceRule,
  PrismComplianceRun,
  PrismComplianceRisk,
  PrismCoordinator,
  PrismCoordinatorAssignment,
  PrismCoordinatorRoleRequirement,
  PrismCoordinatorRoleView,
  PrismCoordinatorWorkspace,
  PrismDefenseReadiness,
  PrismDocument,
  PrismSampleState,
  PrismEvent,
  PrismEventDayStatusFeed,
  PrismEventDayTask,
  PrismEventInsight,
  PrismEventWrapUp,
  StartEventWrapUpInput,
  UpdateEventWrapUpInput,
  PrismFileRequirementsMatrix,
  PrismFloorPlanDraft,
  PrismFloorPlanPreference,
  PrismFloorPlanSnapshot,
  PrismGuestCheckIn,
  PrismInquiry,
  PrismLiveOps,
  PrismLoginHistory,
  PrismNotificationLog,
  PrismPaymentMilestone,
  PrismPaymentRecord,
  PrismPmcmCommandInbox,
  PrismPmcmDashboardWorkspace,
  PrismPmcmEventWorkspace,
  PrismPostEventDocument,
  PrismPrivacyInventory,
  PrismPrivacyRequest,
  PrismPrivacyRetentionPolicy,
  PrismSecurityAlert,
  PrismSupplier,
  PrismSupplierApplication,
  PrismSupplierCategory,
  PrismSupplierQuote,
  PrismSupplierQuoteRequest,
  PrismSupplierTier,
  PrismUrgentIssue,
  PAREApprovalRecord,
  PAREResult,
  PrismAuthResponse,
  PrismTwoFactorSetup,
  PARERisk,
  PrismUser,
  PrismAuthenticatedSession,
  PrismRegistrationPlatform,
  CreateRegistrationPlatformInput,
  ModerateGuestFeedbackInput,
  UpdateRegistrationPlatformInput,
  ImportHeadcountInput,
  ImportGuestRosterInput,
  RecordActualEventEndInput,
  CreateEventDayTaskInput,
  EscalateLiveOpsInput,
  ReplaceCoordinatorAssignmentInput,
  CoordinatorAssignmentAcknowledgementInput,
  WithdrawCoordinatorAssignmentInput,
  UpdateCoordinatorAttendanceInput,
  UpdateEventDayTaskInput,
  UpdateUrgentIssueInput,
  CreateUrgentIssueInput,
  VerifySupplierStatusInput,
  CreatePrivacyRequestInput,
  ReviewPrivacyRequestInput,
  ReviewSupplierApplicationInput,
  CreateSupplierReviewInput,
  CreateSupplierReliabilityNoteInput,
  PromoteSupplierInput,
  AuditLogFilters,
  CreateComplianceRiskInput,
  UpdateWalkInPolicyInput,
  GuestRosterSearchInput,
  UpdateGuestVerificationInput,
} from "@prism/types";

export type {
  SampleRole,
  PrismApprovalRequest,
  PrismAuditExport,
  PrismAuditIntegrity,
  PrismAuditLog,
  PrismBillingSource,
  PrismBillingStatement,
  PrismBriefing,
  PrismCloseGates,
  PrismComplianceCheck,
  PrismComplianceRule,
  PrismCoordinator,
  PrismCoordinatorAssignment,
  PrismCoordinatorRoleRequirement,
  PrismCoordinatorRoleView,
  PrismCoordinatorWorkspace,
  PrismDefenseReadiness,
  PrismDocument,
  PrismSampleState,
  PrismEvent,
  PrismEventDayStatusFeed,
  PrismEventDayTask,
  PrismEventInsight,
  PrismFileRequirementsMatrix,
  PrismFloorPlanDraft,
  PrismFloorPlanPreference,
  PrismFloorPlanSnapshot,
  PrismGuestCheckIn,
  PrismInquiry,
  PrismLiveOps,
  PrismLoginHistory,
  PrismNotificationLog,
  PrismPaymentMilestone,
  PrismPaymentRecord,
  PrismPmcmCommandInbox,
  PrismPmcmDashboardWorkspace,
  PrismPmcmEventWorkspace,
  PrismPostEventDocument,
  PrismPrivacyInventory,
  PrismPrivacyRequest,
  PrismPrivacyRetentionPolicy,
  PrismSecurityAlert,
  PrismSupplier,
  PrismSupplierCategory,
  PrismSupplierQuote,
  PrismSupplierQuoteRequest,
  PrismSupplierTier,
  PrismUrgentIssue,
  PAREApprovalRecord,
  PAREResult,
  PARERisk,
  PrismUser,
  PrismRegistrationPlatform,
  CreateRegistrationPlatformInput,
  UpdateRegistrationPlatformInput,
  ImportHeadcountInput,
};
type CreateFloorPlanDraftInput = {
  name: string;
  sourceType: "blank" | "template" | "client_preference";
  venue?: string;
  width?: number;
  height?: number;
  gridSize?: number;
  pax?: number;
  objects?: Project["objects"];
  guests?: Project["guests"];
  suppliers?: Project["suppliers"];
};

type AddSupplierQuoteInput = {
  requestId?: string;
  supplierId?: string;
  categoryId?: string;
  supplierName?: string;
  category?: string;
  amount?: number;
  inclusions?: string[];
  paymentTerms?: string;
  notes?: string;
  status?: string;
};

type RequestSupplierQuotesInput = {
  categoryId: string;
  supplierIds?: string[];
  confidentialBid?: boolean;
  deadline?: string;
};

type CreateSupplierInput = {
  categoryId: string;
  name: string;
  contactName?: string;
  email?: string;
  phone?: string;
  tier?: "tier_1" | "tier_2" | "pending_first_event";
  bniMember?: boolean;
  serviceInclusions?: string;
  performanceNotes?: string;
};

type UpdateSupplierInput = Partial<CreateSupplierInput>;

type ChangeSupplierTierInput = {
  tier: "tier_1" | "tier_2" | "pending_first_event";
  reason: string;
};

type CreateSupplierCertificationInput = {
  fileName: string;
  documentType: string;
  issuer?: string;
  expiresAt?: string;
  status?: "submitted" | "verified" | "expired" | "rejected";
  notes?: string;
};

type RecordPaymentInput = {
  amountReceived: number;
  paymentDate: string;
  paymentMethod: "Bank Transfer" | "GCash" | "Cheque";
  referenceNumber?: string;
};

type CreateComplianceRuleInput = {
  eventType?: string;
  phase?: string;
  severity?: string;
  layer?: string;
  conditionKey: string;
  title: string;
  note?: string;
  active?: boolean;
};

type ResolveComplianceInput = {
  action?: "resolve" | "override";
  note?: string;
  overrideReason?: string;
  actorName?: string;
};

type CreateBillingSourceInput = {
  sourceType?: string;
  sourceLabel: string;
  sourceDocumentId?: string;
  lineItems: Array<{ label: string; amount: number }>;
  paymentSchedule?: Array<{ label: string; percentage: number; dueDate?: string }>;
  paymentMethods?: Array<{ label: string; details: string }>;
};

type AssignCoordinatorInput = {
  coordinatorId: string;
  role: string;
  overrideConflict?: boolean;
};

type ReplaceCoordinatorInput = ReplaceCoordinatorAssignmentInput;

interface ApiFloorPlan {
  id: string;
  name: string;
  venue: string;
  width: number;
  height: number;
  gridSize: number;
  pax: number;
  objects?: Project["objects"];
  guests?: Project["guests"];
  suppliers?: Project["suppliers"];
  updatedAt?: string;
}

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";
const API_OFFLINE_MESSAGE = "P.R.I.S.M API is offline. Start `prism-api` on port 4000, then try again.";
function storedEventAccessToken() {
  if (typeof window === "undefined") return null;
  const raw = window.localStorage.getItem(PRISM_SESSION_STORAGE_KEYS.event);
  if (!raw) return null;
  try {
    const session = JSON.parse(raw) as unknown;
    return isPrismAuthenticatedSession(session) ? session.accessToken : null;
  } catch {
    return null;
  }
}

const eventOpsClient = createEventOpsClient({ baseUrl: `${API_URL}/api`, getAuthToken: storedEventAccessToken });

export function apiUrl(path: string) {
  if (!path) return "#";
  return path.startsWith("http") ? path : `${API_URL}${path}`;
}

async function request<T>(path: string, init: RequestInit = {}) {
  const accessToken = storedEventAccessToken();
  let response: Response;
  try {
    response = await fetch(`${API_URL}${path}`, {
      ...init,
      headers: {
        "content-type": "application/json",
        ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
        ...(init.headers ?? {}),
      },
    });
  } catch (err) {
    if (err instanceof TypeError) throw new Error(API_OFFLINE_MESSAGE);
    throw err;
  }

  const text = await response.text();
  let payload: { data?: T; message?: string } | null = null;
  if (text) {
    try {
      payload = JSON.parse(text) as { data?: T; message?: string };
    } catch {
      payload = { message: text };
    }
  }

  if (!response.ok) {
    throw new Error(payload?.message || `Request failed: ${response.status}`);
  }

  return payload?.data as T;
}

function apiPlanToProject(plan: ApiFloorPlan): Project {
  const updatedAt = plan.updatedAt ? new Date(plan.updatedAt).getTime() : Date.now();
  return {
    id: plan.id,
    name: plan.name,
    venue: plan.venue,
    widthM: plan.width,
    heightM: plan.height,
    pax: plan.pax,
    objects: Array.isArray(plan.objects) ? plan.objects : [],
    guests: Array.isArray(plan.guests) ? plan.guests : [],
    suppliers: Array.isArray(plan.suppliers) ? plan.suppliers : [],
    createdAt: updatedAt,
    updatedAt,
  };
}

const pmcmActorQuery = new URLSearchParams({
  actorRole: "pmcm-admin",
  actorName: "Ms. Mys",
  actorEmail: "mys@pmcm.test",
}).toString();

function withPmcmActor(path: string) {
  return `${path}${path.includes("?") ? "&" : "?"}${pmcmActorQuery}`;
}

function coordinatorActorQuery(session: { name: string; email: string; role: string }) {
  return new URLSearchParams({
    actorRole: "coordinator",
    actorName: session.name,
    actorEmail: session.email,
  }).toString();
}

function withCoordinatorActor(path: string, session: { name: string; email: string; role: string }) {
  return `${path}${path.includes("?") ? "&" : "?"}${coordinatorActorQuery(session)}`;
}

function pmcmAdminActorQuery(session: { name: string; email: string; role: string }) {
  return new URLSearchParams({
    actorRole: "pmcm-admin",
    actorName: session.name,
    actorEmail: session.email,
  }).toString();
}

function withPmcmAdminActor(path: string, session: { name: string; email: string; role: string }) {
  return `${path}${path.includes("?") ? "&" : "?"}${pmcmAdminActorQuery(session)}`;
}

export const prismApi = {
  pmcmState: () =>
    eventOpsClient.pmcmDashboard.detail({
      actorRole: "pmcm-admin",
      actorName: "Ms. Mys",
      actorEmail: "mys@pmcm.test",
    }),
  pmcmCommandInbox: () =>
    eventOpsClient.pmcm.commandInbox({
      actorRole: "pmcm-admin",
      actorName: "Ms. Mys",
      actorEmail: "mys@pmcm.test",
    }),
  pmcmEventWorkspace: (eventId: string) =>
    eventOpsClient.pmcm.eventWorkspace(eventId, {
      actorRole: "pmcm-admin",
      actorName: "Ms. Mys",
      actorEmail: "mys@pmcm.test",
    }),
  reset: () => eventOpsClient.sample.reset(),
  setupTwoFactor: (token: string) =>
    request<PrismTwoFactorSetup>("/api/auth/2fa/setup", {
      method: "POST",
      body: JSON.stringify({ token }),
    }),
  verifyTwoFactor: (token: string, code: string) =>
    request<PrismAuthenticatedSession>("/api/auth/2fa/verify", {
      method: "POST",
      body: JSON.stringify({ token, code }),
    }),
  login: (input: { email: string; password: string }) =>
    request<PrismAuthResponse>("/api/auth/login", {
      method: "POST",
      body: JSON.stringify(input),
    }),
  requestPasswordReset: (email: string) =>
    request<{ message: string; deliveryAvailable: boolean }>('/api/auth/password-reset/request', { method: 'POST', body: JSON.stringify({ email }) }),
  consumePasswordReset: (input: { token: string; password: string }) =>
    request<{ message: string }>('/api/auth/password-reset/consume', { method: 'POST', body: JSON.stringify(input) }),
  approvalRequests: () => request<PrismApprovalRequest[]>("/api/auth/approval-requests"),
  loginHistory: (userId: string) => request<PrismLoginHistory[]>(`/api/auth/users/${userId}/login-history`),
  auditLogs: (filters: AuditLogFilters = {}) => {
    const params = new URLSearchParams();
    Object.entries(filters).forEach(([key, value]) => {
      if (value && value !== "all") params.set(key, value);
    });
    const query = params.toString();
    return request<PrismAuditLog[]>(`/api/audit/logs${query ? `?${query}` : ""}`);
  },
  exportAuditLogs: (filters: AuditLogFilters = {}) =>
    request<PrismAuditExport>("/api/audit/export", {
      method: "POST",
      body: JSON.stringify(filters),
    }),
  securityAlerts: () => request<PrismSecurityAlert[]>("/api/audit/alerts"),
  auditIntegrity: () => request<PrismAuditIntegrity>(withPmcmActor("/api/audit/integrity")),
  privacyInventory: (eventId?: string) =>
    request<PrismPrivacyInventory>(withPmcmActor(`/api/privacy/inventory${eventId && eventId !== "all" ? `?eventId=${encodeURIComponent(eventId)}` : ""}`)),
  privacyRetentionPolicies: () => request<PrismPrivacyRetentionPolicy[]>(withPmcmActor("/api/privacy/retention-policies")),
  privacyRequests: (eventId?: string) =>
    request<PrismPrivacyRequest[]>(withPmcmActor(`/api/privacy/requests${eventId && eventId !== "all" ? `?eventId=${encodeURIComponent(eventId)}` : ""}`)),
  createPrivacyRequest: (input: CreatePrivacyRequestInput) =>
    request<PrismPrivacyRequest>(withPmcmActor("/api/privacy/requests"), {
      method: "POST",
      body: JSON.stringify(input),
    }),
  reviewPrivacyRequest: (requestId: string, input: ReviewPrivacyRequestInput) =>
    request<PrismPrivacyRequest>(withPmcmActor(`/api/privacy/requests/${requestId}/review`), {
      method: "PATCH",
      body: JSON.stringify(input),
    }),
  executePrivacyRequest: (requestId: string, executionNotes?: string) =>
    request<PrismPrivacyRequest>(withPmcmActor(`/api/privacy/requests/${requestId}/execute`), {
      method: "POST",
      body: JSON.stringify({ executionNotes }),
    }),
  approveApprovalRequest: (requestId: string) =>
    request<PrismApprovalRequest>(`/api/auth/approval-requests/${requestId}/approve`, { method: "PATCH" }),
  declineApprovalRequest: (requestId: string) =>
    request<PrismApprovalRequest>(`/api/auth/approval-requests/${requestId}/decline`, { method: "PATCH" }),
  acceptInquiry: (inquiryId: string) =>
    request<PrismInquiry>(`/api/inquiries/${inquiryId}/status`, {
      method: "PATCH",
      body: JSON.stringify({ status: "accepted" }),
    }),
  pendInquiry: (inquiryId: string) =>
    request<PrismInquiry>(`/api/inquiries/${inquiryId}/status`, {
      method: "PATCH",
      body: JSON.stringify({ status: "pending" }),
    }),
  logInquiryOnBehalf: (
    input: {
      clientName: string;
      companyName?: string;
      email: string;
      eventName: string;
      eventType?: string;
      eventDate: string;
      clientType: string;
      channel?: string;
      referralDetails?: string;
      message: string;
    },
    session: { name: string; email: string; role: string },
  ) =>
    request<PrismInquiry>(withPmcmAdminActor("/api/inquiries/log-on-behalf", session), {
      method: "POST",
      body: JSON.stringify(input),
    }),
  declineInquiry: (inquiryId: string, declineReason: string) =>
    request<PrismInquiry>(`/api/inquiries/${inquiryId}/status`, {
      method: "PATCH",
      body: JSON.stringify({ status: "declined", declineReason }),
    }),
  sendConformeReminder: (inquiryId: string) =>
    request<PrismInquiry>(`/api/inquiries/${inquiryId}/conforme-reminders`, { method: "POST" }),
  // STUB(EP-04): File bytes not transmitted. When Supabase Storage is ready,
  // convert to FormData with the actual File object. Coordinate with Anthony (Owner D).
  uploadConforme: (
    inquiryId: string,
    meta: { fileName: string; mimeType: string; sizeBytes: number },
  ) =>
    request<PrismDocument>(`/api/inquiries/${inquiryId}/conforme`, {
      method: "POST",
      body: JSON.stringify({
        type: "signed_conforme",
        fileName: meta.fileName,
        mimeType: meta.mimeType,
        sizeBytes: meta.sizeBytes,
      }),
    }),
  createFloorPlanDraft: (eventId: string, input: CreateFloorPlanDraftInput) =>
    request<PrismFloorPlanDraft>(withPmcmActor(`/api/events/${eventId}/floorplans`), {
      method: "POST",
      body: JSON.stringify(input),
    }),
  submitFloorPlanDraft: (eventId: string, draftId: string) =>
    request<PrismFloorPlanDraft>(withPmcmActor(`/api/events/${eventId}/floorplans/${draftId}/submit`), { method: "POST" }),
  approveFloorPlanDraft: (eventId: string, draftId: string) =>
    request<PrismFloorPlanDraft>(withPmcmActor(`/api/events/${eventId}/floorplans/${draftId}/approve`), { method: "POST" }),
  loadFloorPlanSnapshot: (eventId: string, draftId: string, type: "submitted" | "approved" = "approved") =>
    request<ApiFloorPlan>(withPmcmActor(`/api/events/${eventId}/floorplans/${draftId}/snapshot?type=${type}`)).then((plan) =>
      apiPlanToProject(plan),
    ),
  loadPlan: (planId: string) =>
    request<ApiFloorPlan>(withPmcmActor(`/api/plans/${planId}`)).then((plan) => apiPlanToProject(plan)),
  savePlan: (project: Project) =>
    request<ApiFloorPlan>(withPmcmActor(`/api/plans/${project.id}`), {
      method: "PUT",
      body: JSON.stringify({
        venue: project.venue,
        width: Math.max(1, Math.round(project.widthM)),
        height: Math.max(1, Math.round(project.heightM)),
        gridSize: 1,
        pax: Math.max(0, Math.round(project.pax)),
        objects: project.objects,
        guests: project.guests,
        suppliers: project.suppliers,
        seats: [],
        seatCategories: [],
      }),
    }).then((plan) => apiPlanToProject(plan)),
  submitBriefing: (eventId: string) =>
    request<PrismBriefing>(`/api/events/${eventId}/briefing`, {
      method: "POST",
      body: JSON.stringify({
        venue: "Shangri-La Grand Ballroom",
        guestCount: 240,
        budgetRange: "PHP 450,000 - 520,000",
        serviceRequirements: ["Digital Registration", "Stage and Technicals", "Documentation"],
        notes: "Client prefers a polished technology summit setup with clear ingress flow.",
      }),
    }),
  addSupplierQuote: (eventId: string, input: AddSupplierQuoteInput = {}) =>
    request<PrismSupplierQuote>(`/api/events/${eventId}/supplier-quotes`, {
      method: "POST",
      body: JSON.stringify(input),
    }),
  requestSupplierQuotes: (eventId: string, input: RequestSupplierQuotesInput) =>
    request<PrismSupplierQuoteRequest[]>(`/api/events/${eventId}/quote-requests`, {
      method: "POST",
      body: JSON.stringify(input),
    }),
  selectSupplierQuote: (eventId: string, quoteId: string) =>
    request<PrismSupplierQuote>(`/api/events/${eventId}/supplier-quotes/${quoteId}/select`, { method: "PATCH" }),
  createSupplier: (input: CreateSupplierInput) =>
    request<PrismSupplier>(withPmcmActor("/api/suppliers"), {
      method: "POST",
      body: JSON.stringify(input),
    }),
  updateSupplier: (supplierId: string, input: UpdateSupplierInput) =>
    request<PrismSupplier>(withPmcmActor(`/api/suppliers/${supplierId}`), {
      method: "PATCH",
      body: JSON.stringify(input),
    }),
  changeSupplierTier: (supplierId: string, input: ChangeSupplierTierInput) =>
    request<PrismSupplier>(withPmcmActor(`/api/suppliers/${supplierId}/tier`), {
      method: "PATCH",
      body: JSON.stringify(input),
    }),
  addSupplierReview: (supplierId: string, input: CreateSupplierReviewInput, session: { name: string; email: string; role: string }) =>
    request<PrismSupplier>(withPmcmAdminActor(`/api/suppliers/${supplierId}/reviews`, session), {
      method: "POST",
      body: JSON.stringify(input),
    }),
  addSupplierReliabilityNote: (supplierId: string, input: CreateSupplierReliabilityNoteInput) =>
    request<PrismSupplier>(withPmcmActor(`/api/suppliers/${supplierId}/reliability-notes`), {
      method: "POST",
      body: JSON.stringify(input),
    }),
  promoteSupplier: (supplierId: string, input: PromoteSupplierInput) =>
    request<PrismSupplier>(withPmcmActor(`/api/suppliers/${supplierId}/promote`), {
      method: "POST",
      body: JSON.stringify(input),
    }),
  addSupplierCertification: (supplierId: string, input: CreateSupplierCertificationInput) =>
    request<PrismSupplier>(withPmcmActor(`/api/suppliers/${supplierId}/certifications`), {
      method: "POST",
      body: JSON.stringify(input),
    }),
  listSupplierApplications: () =>
    request<PrismSupplierApplication[]>(withPmcmActor("/api/supplier-applications/inbox")),
  reviewSupplierApplication: (applicationId: string, input: ReviewSupplierApplicationInput) =>
    request<PrismSupplierApplication>(withPmcmActor(`/api/supplier-applications/${applicationId}/review`), {
      method: "PATCH",
      body: JSON.stringify(input),
    }),
  coordinators: () => request<PrismCoordinator[]>("/api/coordinators"),
  complianceRules: () => request<PrismComplianceRule[]>(withPmcmActor("/api/compliance/rules")),
  createComplianceRule: (input: CreateComplianceRuleInput) =>
    request<PrismComplianceRule>(withPmcmActor("/api/compliance/rules"), {
      method: "POST",
      body: JSON.stringify(input),
    }),
  updateComplianceRule: (ruleId: string, input: Partial<CreateComplianceRuleInput>) =>
    request<PrismComplianceRule>(withPmcmActor(`/api/compliance/rules/${ruleId}`), {
      method: "PATCH",
      body: JSON.stringify(input),
    }),
  runCompliance: (eventId: string, phase = "planning") =>
    request<PrismComplianceCheck[]>(`/api/events/${eventId}/compliance`, {
      method: "POST",
      body: JSON.stringify({ phase }),
    }),
  resolveCompliance: (eventId: string, checkId: string, input: ResolveComplianceInput = { note: "Resolved during PMCM review." }) =>
    request<PrismComplianceCheck>(`/api/events/${eventId}/compliance/${checkId}`, {
      method: "PATCH",
      body: JSON.stringify(input),
    }),
  complianceRuns: (eventId: string) => request<PrismComplianceRun[]>(`/api/events/${eventId}/compliance/runs`),
  complianceRisks: (eventId: string) => request<PrismComplianceRisk[]>(`/api/events/${eventId}/compliance/risks`),
  createComplianceRisk: (eventId: string, input: CreateComplianceRiskInput) => request<PrismComplianceRisk>(`/api/events/${eventId}/compliance/risks`, { method: "POST", body: JSON.stringify(input) }),
  updateComplianceRisk: (eventId: string, riskId: string, input: Partial<CreateComplianceRiskInput>) => request<PrismComplianceRisk>(`/api/events/${eventId}/compliance/risks/${riskId}`, { method: "PATCH", body: JSON.stringify(input) }),
  assignCoordinator: (eventId: string, input: AssignCoordinatorInput) =>
    request<PrismCoordinatorAssignment>(`/api/events/${eventId}/coordinators`, {
      method: "POST",
      body: JSON.stringify(input),
    }),
  acknowledgeCoordinator: (eventId: string, assignmentId: string, input: CoordinatorAssignmentAcknowledgementInput = { decision: "acknowledged" }) =>
    request<PrismCoordinatorAssignment>(`/api/events/${eventId}/coordinators/${assignmentId}/acknowledge`, {
      method: "PATCH",
      body: JSON.stringify(input),
    }),
  withdrawCoordinator: (session: { name: string; email: string; role: string }, eventId: string, assignmentId: string, input: WithdrawCoordinatorAssignmentInput) =>
    request<PrismCoordinatorAssignment>(withCoordinatorActor(`/api/events/${eventId}/coordinators/${assignmentId}/withdraw`, session), {
      method: "PATCH",
      body: JSON.stringify(input),
    }),
  defenseReadiness: (eventId: string) => request<PrismDefenseReadiness>(withPmcmActor(`/api/events/${eventId}/defense-readiness`)),
  liveOps: (eventId: string) => request<PrismLiveOps>(withPmcmActor(`/api/events/${eventId}/live-ops`)),
  eventDayStatusFeed: (eventId: string) =>
    request<PrismEventDayStatusFeed>(withPmcmActor(`/api/events/${eventId}/event-day/status-feed`)),
  createEventDayTask: (eventId: string, input: CreateEventDayTaskInput) =>
    request<PrismEventDayTask>(withPmcmActor(`/api/events/${eventId}/event-day/tasks`), {
      method: "POST",
      body: JSON.stringify(input),
    }),
  updateEventDayTask: (eventId: string, taskId: string, input: UpdateEventDayTaskInput) =>
    request<PrismEventDayTask>(withPmcmActor(`/api/events/${eventId}/event-day/tasks/${taskId}`), {
      method: "PATCH",
      body: JSON.stringify(input),
    }),
  escalateEventDayTask: (eventId: string, taskId: string, input: EscalateLiveOpsInput) =>
    request<PrismEventDayTask>(withPmcmActor(`/api/events/${eventId}/event-day/tasks/${taskId}/escalate`), {
      method: "POST",
      body: JSON.stringify(input),
    }),
  createUrgentIssue: (eventId: string, input: CreateUrgentIssueInput) =>
    request<PrismUrgentIssue>(withPmcmActor(`/api/events/${eventId}/urgent-issues`), {
      method: "POST",
      body: JSON.stringify(input),
    }),
  updateUrgentIssue: (eventId: string, issueId: string, input: UpdateUrgentIssueInput) =>
    request<PrismUrgentIssue>(withPmcmActor(`/api/events/${eventId}/urgent-issues/${issueId}`), {
      method: "PATCH",
      body: JSON.stringify(input),
    }),
  escalateUrgentIssue: (eventId: string, issueId: string, input: EscalateLiveOpsInput) =>
    request<PrismUrgentIssue>(withPmcmActor(`/api/events/${eventId}/urgent-issues/${issueId}/escalate`), {
      method: "POST",
      body: JSON.stringify(input),
    }),
  updateCoordinatorAttendance: (eventId: string, assignmentId: string, input: UpdateCoordinatorAttendanceInput) =>
    request<PrismCoordinatorAssignment>(withPmcmActor(`/api/events/${eventId}/coordinators/${assignmentId}/status`), {
      method: "PATCH",
      body: JSON.stringify(input),
    }),
  replaceCoordinator: (eventId: string, assignmentId: string, input: ReplaceCoordinatorInput) =>
    request<{ replacedAssignment: PrismCoordinatorAssignment; replacementAssignment: PrismCoordinatorAssignment }>(
      withPmcmActor(`/api/events/${eventId}/coordinators/${assignmentId}/replace`),
      {
        method: "POST",
        body: JSON.stringify(input),
      },
    ),
  verifySupplierStatus: (eventId: string, requestId: string, input: VerifySupplierStatusInput) =>
    request<PrismSupplierQuoteRequest>(withPmcmActor(`/api/events/${eventId}/supplier-status/${requestId}/verify`), {
      method: "PATCH",
      body: JSON.stringify(input),
    }),
  coordinatorWorkspace: (session: { name: string; email: string; role: string }) =>
    request<PrismCoordinatorWorkspace>(withCoordinatorActor("/api/coordinator/workspace", session)),
  coordinatorRoleView: (session: { name: string; email: string; role: string }, eventId: string) =>
    request<PrismCoordinatorRoleView>(withCoordinatorActor(`/api/coordinator/events/${eventId}/role-view`, session)),
  // EP-11-S02: coordinator-authored event-day records. Mirrors coordinatorRoleView
  // above: session first, then eventId, wrapped in withCoordinatorActor. Deliberately
  // NOT withPmcmActor, which hardcodes actorRole=pmcm-admin and actorName=Ms. Mys.
  createCoordinatorEventDayTask: (
    session: { name: string; email: string; role: string },
    eventId: string,
    input: CreateEventDayTaskInput,
  ) =>
    request<PrismEventDayTask>(withCoordinatorActor(`/api/events/${eventId}/event-day/tasks`, session), {
      method: "POST",
      body: JSON.stringify(input),
    }),
  createCoordinatorUrgentIssue: (
    session: { name: string; email: string; role: string },
    eventId: string,
    input: CreateUrgentIssueInput,
  ) =>
    request<PrismUrgentIssue>(withCoordinatorActor(`/api/events/${eventId}/urgent-issues`, session), {
      method: "POST",
      body: JSON.stringify(input),
    }),
  markPayment: (eventId: string, milestoneId: string, status: "pending" | "paid" | "at_risk" = "paid") =>
    request<PrismPaymentMilestone>(`/api/events/${eventId}/payments/${milestoneId}`, {
      method: "PATCH",
      body: JSON.stringify({ status }),
    }),
  recordPayment: (eventId: string, milestoneId: string, input: RecordPaymentInput) =>
    request<PrismPaymentMilestone>(`/api/events/${eventId}/payments/${milestoneId}/records`, {
      method: "POST",
      body: JSON.stringify(input),
    }),
  createBillingSource: (eventId: string, input: CreateBillingSourceInput) =>
    request<PrismBillingSource>(`/api/events/${eventId}/billing-source`, {
      method: "POST",
      body: JSON.stringify(input),
    }),
  approveBillingSource: (eventId: string, sourceId: string, approvalNotes?: string) =>
    request<PrismBillingSource>(`/api/events/${eventId}/billing-source/${sourceId}/approve`, {
      method: "PATCH",
      body: JSON.stringify({ approvedBy: "Ms. Mys", approvalNotes }),
    }),
  generateBillingStatement: (eventId: string, sourceId?: string) =>
    request<PrismBillingStatement>(`/api/events/${eventId}/billing-statements/generate`, {
      method: "POST",
      body: JSON.stringify({ sourceId }),
    }),
  sendBillingStatement: (eventId: string, billingId: string) =>
    request<PrismBillingStatement>(`/api/events/${eventId}/billing-statements/${billingId}/send`, { method: "POST" }),
  closeGates: (eventId: string) => request<PrismCloseGates>(`/api/events/${eventId}/close-gates`),
  fileRequirements: (eventId: string) =>
    eventOpsClient.events.fileRequirements(eventId, {
      actorRole: "pmcm-admin",
      actorName: "Ms. Mys",
      actorEmail: "mys@pmcm.test",
    }),
  archiveEvent: (eventId: string, overrideReason?: string) =>
    request<PrismEvent>(`/api/events/${eventId}/archive`, {
      method: "POST",
      body: JSON.stringify({ overrideReason, actorName: "Ms. Mys" }),
    }),
  recordActualEventEnd: (eventId: string, input: RecordActualEventEndInput) =>
    request<PrismEvent>(withPmcmActor(`/api/events/${eventId}/actual-end`), { method: "POST", body: JSON.stringify(input) }),
  getEventWrapUp: (eventId: string) => request<PrismEventWrapUp | null>(withPmcmActor(`/api/events/${eventId}/wrap-up`)),
  startEventWrapUp: (eventId: string, input: StartEventWrapUpInput) => request<PrismEventWrapUp>(withPmcmActor(`/api/events/${eventId}/wrap-up`), { method: "POST", body: JSON.stringify(input) }),
  updateEventWrapUp: (eventId: string, input: UpdateEventWrapUpInput) => request<PrismEventWrapUp>(withPmcmActor(`/api/events/${eventId}/wrap-up`), { method: "PATCH", body: JSON.stringify(input) }),
  searchArchive: (filters: ArchiveSearchFilters = {}) =>
    eventOpsClient.events.searchArchive(filters),
  eventInsights: (eventId: string) => request<PrismEventInsight[]>(withPmcmActor(`/api/events/${eventId}/insights`)),
  communicationThreads: (eventId: string) => eventOpsClient.communication.listThreads(eventId),
  communicationParticipants: (eventId: string) => eventOpsClient.communication.listParticipants(eventId),
  createCommunicationThread: (eventId: string, subject: string, participantActorIds: string[]) => eventOpsClient.communication.createThread({ eventId, subject, participantActorIds }),
  sendCommunicationMessage: (threadId: string, body: string, idempotencyKey: string) => eventOpsClient.communication.sendMessage(threadId, { body, idempotencyKey }),
  communicationMessages: (threadId: string, cursor?: string, limit?: number) => eventOpsClient.communication.listMessages(threadId, { cursor, limit }),
  markCommunicationThreadRead: (threadId: string) => eventOpsClient.communication.markThreadRead(threadId),
  generateEventInsights: (eventId: string) =>
    request<PrismEventInsight>(`/api/events/${eventId}/insights/generate`, { method: "POST" }),

  // ─── PARE ─────────────────────────────────────────────────────────────────
  withdrawSupplier: (eventId: string, requestId: string) =>
    request<{ ok: boolean }>(withPmcmActor(`/api/events/${eventId}/quote-requests/${requestId}/withdraw`), { method: "PATCH" }),
  pareGetPending: () =>
    request<PAREApprovalRecord[]>("/api/ai/pare/pending"),
  pareApprove: (approvalRecordId: string) =>
    request<PAREApprovalRecord>(`/api/ai/pare/${approvalRecordId}/approve`, { method: "PATCH" }),
  pareReject: (approvalRecordId: string) =>
    request<PAREApprovalRecord>(`/api/ai/pare/${approvalRecordId}/reject`, { method: "PATCH" }),

  // ─── Registration Platform ───────────────────────────────────────────────
  getRegistrationPlatform: (eventId: string) => eventOpsClient.pmcm.registrationPlatform(eventId),
  upsertRegistrationPlatform: (eventId: string, input: CreateRegistrationPlatformInput) =>
    eventOpsClient.pmcm.upsertRegistrationPlatform(eventId, input),
  updateRegistrationPlatform: (eventId: string, input: UpdateRegistrationPlatformInput) =>
    eventOpsClient.pmcm.updateRegistrationPlatform(eventId, input),
  importHeadcount: (eventId: string, input: ImportHeadcountInput) =>
    eventOpsClient.pmcm.importHeadcount(eventId, input),
  searchGuestRoster: (eventId: string, query = "") => eventOpsClient.guest.roster(eventId, query, { role: "pmcm-admin" }),
  searchGuestRosterWithFilters: (eventId: string, filters: GuestRosterSearchInput) => eventOpsClient.guest.searchRoster(eventId, filters, { role: "pmcm-admin" }),
  importGuestRoster: (eventId: string, input: ImportGuestRosterInput) => eventOpsClient.guest.importRoster(eventId, input, { role: "pmcm-admin" }),
  checkInGuestRoster: (eventId: string, rosterEntryId: string) => eventOpsClient.guest.checkInRoster(eventId, rosterEntryId, { role: "coordinator" }),
  verifyGuestRoster: (eventId: string, rosterEntryId: string, status: UpdateGuestVerificationInput["status"]) => eventOpsClient.guest.verifyRoster(eventId, rosterEntryId, { status }, { role: "pmcm-admin" }),
  getWalkInPolicy: (eventId: string) => eventOpsClient.guest.walkInPolicy(eventId, { role: "pmcm-admin" }),
  updateWalkInPolicy: (eventId: string, input: UpdateWalkInPolicyInput) => eventOpsClient.guest.updateWalkInPolicy(eventId, input, { role: "pmcm-admin" }),
  pendingGuestFeedback: (eventId: string) => eventOpsClient.guest.pendingFeedback(eventId, { role: "pmcm-admin" }),
  moderateGuestFeedback: (eventId: string, feedbackId: string, input: ModerateGuestFeedbackInput) =>
    eventOpsClient.guest.moderateFeedback(eventId, feedbackId, input, { role: "pmcm-admin" }),
};
