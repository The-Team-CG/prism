"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  Clock3,
  Filter,
  ListFilter,
  LockKeyhole,
  Radio,
  ShieldCheck,
  Tags,
  UserCheck,
  UserRound,
  type LucideIcon,
} from "lucide-react";
import {
  prismApi,
  type SampleRole,
  type PrismAuditLog,
  type PrismCoordinator,
  type PrismCoordinatorRoleRequirement,
  type PrismCoordinatorWorkspace,
  type PrismPmcmDashboardWorkspace,
  type PrismEvent,
  type PrismFloorPlanDraft,
  type PrismInquiry,
  type PrismLoginHistory,
  type PrismPmcmCommandInbox,
  type PrismSecurityAlert,
  type PrismSupplier,
  type PrismSupplierCategory,
} from "@/lib/prism-api";
import {
  PrismDashboardShell,
  PrismSectionPanel,
} from "@prism/ui";
import { Alert, AlertDescription } from "@/app/components/ui/alert";
import { Button } from "@/app/components/ui/button";
import { EventCommandLanding } from "./components/public/event-command-landing";
import {
  AdminApprovalsPanel,
  AuditTrailPanel,
  ClientOnboardingTracker,
  CoordinatorAssignmentDesk,
  CoordinatorView,
  EventActivityPanel,
  EventBriefingPanel,
  EventFloorplansTab,
  EventRoleLoadingState,
  EventSuppliersTab,
  FinancialWorkspace,
  InquiryIntakeLog,
  LiveOperationsWorkspace,
  Phase4Workspace,
  SupplierDirectory,
} from "./components/pmcm";
import {
  EventOverviewPanels,
  EventQueuePanel,
  EventWorkflowTabs,
  SelectedEventCockpit,
  SelectedEventStatusSummary,
  buildEventWorkflowTabs,
  type PmcmDetailTab,
} from "./components/pmcm/event-command-cockpit";
import { cloneTemplateObjects, loadTemplates, type FloorPlanTemplate } from "./components/editor/templates";
import type { Project } from "./components/editor/types";
import {
  selectActiveEvents,
  selectSelectedEventWorkspaceResources,
  selectUnreviewedInquiryCount,
} from "@/features/event-dashboard/event-dashboard.selectors";
import { usePmcmApprovalRequests } from "@/features/event-dashboard/use-pmcm-approval-requests";
import { usePmcmActionRunner } from "@/features/event-dashboard/use-pmcm-action-runner";
import { usePmcmEventReadiness } from "@/features/event-dashboard/use-pmcm-event-readiness";
import { usePmcmSelectedEventWorkspace } from "@/features/event-dashboard/use-pmcm-selected-event-workspace";
import {
  clearEventSession,
  readStoredEventSession,
  type EventSession,
} from "@/app/lib/session";
import { isPmcmAdmin } from "@/app/lib/role-guards";

const EditorShell = dynamic(
  () => import("./components/editor/EditorShell").then((mod) => mod.EditorShell),
  {
    ssr: false,
    loading: () => (
      <div className="grid size-full place-items-center bg-background text-sm text-muted-foreground">
        Loading PMCM editor...
      </div>
    ),
  },
);

type Screen =
  | { name: "portal" }
  | { name: "editor"; event: PrismEvent; draft: PrismFloorPlanDraft; project: Project };
type DetailTab = PmcmDetailTab;

function label(value: string) {
  return value.replaceAll("_", " ");
}

function Panel({ title, icon: Icon, children, aside }: { title: string; icon: LucideIcon; children: React.ReactNode; aside?: React.ReactNode }) {
  return (
    <PrismSectionPanel title={title} icon={Icon} action={aside}>
      {children}
    </PrismSectionPanel>
  );
}

function pmcmCommandTargetTab(kind: string): DetailTab {
  if (kind === "billing") return "billing";
  if (kind === "supplier") return "suppliers";
  if (kind === "coordinator" || kind === "live_ops") return "live-ops";
  if (kind === "floorplan") return "floorplans";
  if (kind === "closure" || kind === "document" || kind === "feedback") return "closure";
  if (kind === "briefing" || kind === "conforme" || kind === "inquiry") return "briefing";
  return "overview";
}

function PmcmPortal({
  session,
  state,
  commandInbox,
  onRefresh,
  onOpenEditor,
  onSignOut,
}: {
  session: EventSession;
  state: PrismPmcmDashboardWorkspace;
  commandInbox: PrismPmcmCommandInbox | null;
  onRefresh: () => Promise<void>;
  onOpenEditor: (event: PrismEvent, draft: PrismFloorPlanDraft) => Promise<void>;
  onSignOut: () => void;
}) {
  const [selectedEventId, setSelectedEventId] = useState<string | null>(state.events[0]?.id ?? null);
  const [section, setSection] = useState<"events" | "suppliers" | "audit-log">("events");
  const [tab, setTab] = useState<DetailTab>("overview");
  const [error, setError] = useState<string | null>(null);
  const [floorPlanTemplates, setFloorPlanTemplates] = useState<FloorPlanTemplate[]>([]);

  const events = selectActiveEvents(state);
  const supplierCategories = state.supplierCategories ?? [];
  const suppliers = state.suppliers ?? [];
  const coordinators = state.coordinators ?? [];
  const coordinatorRoleRequirements = state.coordinatorRoleRequirements ?? [];
  const reportSelectedEventWorkspaceError = useCallback((err: unknown) => {
    setError(err instanceof Error ? err.message : "Unable to load selected event workspace");
  }, []);
  const {
    refresh: refreshSelectedEventWorkspace,
    workspace: selectedEventWorkspace,
  } = usePmcmSelectedEventWorkspace({
    eventId: selectedEventId,
    loadWorkspace: prismApi.pmcmEventWorkspace,
    onError: reportSelectedEventWorkspaceError,
  });
  const eventWorkspace =
    selectedEventWorkspace && selectedEventWorkspace.event.id === selectedEventId ? selectedEventWorkspace : null;
  const {
    activeDraft,
    assignments,
    audit,
    billingSources,
    billingStatements,
    briefing,
    checks,
    drafts,
    eventInsights,
    notificationLogs,
    payments,
    quoteRequests,
    quotes,
    selectedEvent,
  } = selectSelectedEventWorkspaceResources(state, events, selectedEventId, eventWorkspace);
  const unreviewedInquiries = selectUnreviewedInquiryCount(state.inquiries);
  const complianceRules = state.complianceRules ?? [];
  const selectedInquiry = state.inquiries.find((item) => item.id === selectedEvent?.inquiryId);
  const reportApprovalRequestError = useCallback((err: unknown) => {
    setError(err instanceof Error ? err.message : "Unable to load approval requests");
  }, []);
  const { pendingApprovals, refresh: refreshApprovals } = usePmcmApprovalRequests({
    loadApprovalRequests: prismApi.approvalRequests,
    onError: reportApprovalRequestError,
  });
  const eventReadinessLoaders = useMemo(
    () => ({
      loadDefenseReadiness: prismApi.defenseReadiness,
      loadLiveOps: prismApi.liveOps,
      loadStatusFeed: prismApi.eventDayStatusFeed,
    }),
    [],
  );
  const reportEventReadinessError = useCallback((err: unknown) => {
    setError(err instanceof Error ? err.message : "Unable to load event readiness");
  }, []);
  const {
    defenseReadiness,
    liveOps,
    refresh: refreshEventReadiness,
    refreshDefenseReadiness,
    statusFeed,
  } = usePmcmEventReadiness({
    eventId: selectedEvent?.id,
    loaders: eventReadinessLoaders,
    onError: reportEventReadinessError,
  });
  const { busy, run, runLiveOps } = usePmcmActionRunner({
    onRefreshPortal: onRefresh,
    refreshApprovals,
    refreshDefenseReadiness,
    refreshEventReadiness,
    refreshSelectedEventWorkspace,
    selectedEventId: selectedEvent?.id,
    setError,
  });

  useEffect(() => {
    let cancelled = false;
    loadTemplates()
      .then((templates) => {
        if (!cancelled) setFloorPlanTemplates(templates);
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : "Unable to load floor plan templates");
      });

    return () => {
      cancelled = true;
    };
  }, []);

  async function createTemplateDraft(template: FloorPlanTemplate) {
    if (!selectedEvent) return;
    const draft = await prismApi.createFloorPlanDraft(selectedEvent.id, {
      name: `${template.name} PMCM draft`,
      sourceType: "template",
      venue: template.venue || selectedEvent.eventName,
      width: template.widthM,
      height: template.heightM,
      gridSize: 1,
      pax: template.pax,
      objects: cloneTemplateObjects(template),
      guests: template.includeGuests ? template.guests : [],
      suppliers: template.includeSuppliers ? template.suppliers : [],
    });
    await onOpenEditor(selectedEvent, draft);
  }

  async function acceptInquiry(inquiry: PrismInquiry) {
    await run("accept inquiry", () => prismApi.acceptInquiry(inquiry.id));
  }

  async function pendInquiry(inquiry: PrismInquiry) {
    await run("pend inquiry", () => prismApi.pendInquiry(inquiry.id));
  }

  async function declineInquiry(inquiry: PrismInquiry, reason: string) {
    await run("decline inquiry", () => prismApi.declineInquiry(inquiry.id, reason));
  }

  async function uploadConformeForInquiry(inquiry: PrismInquiry) {
    await run("upload conforme", () => prismApi.uploadConforme(inquiry.id));
  }

  async function sendConformeReminder(inquiry: PrismInquiry) {
    await run("conforme reminder", () => prismApi.sendConformeReminder(inquiry.id));
  }

  async function toggleSupplierBni(supplier: PrismSupplier, nextValue: boolean) {
    await run("supplier BNI flag", () => prismApi.updateSupplier(supplier.id, { bniMember: nextValue }));
  }

  async function createSupplier(input: {
    categoryId: string;
    name: string;
    contactName?: string;
    email?: string;
    phone?: string;
    tier?: "tier_1" | "tier_2" | "pending_first_event";
    serviceInclusions?: string;
    performanceNotes?: string;
  }) {
    await run("create supplier", () => prismApi.createSupplier(input));
  }

  async function updateSupplierProfile(supplierId: string, input: {
    name?: string;
    contactName?: string;
    email?: string;
    phone?: string;
    serviceInclusions?: string;
    performanceNotes?: string;
  }) {
    await run("update supplier", () => prismApi.updateSupplier(supplierId, input));
  }

  async function changeSupplierTier(supplierId: string, tier: "tier_1" | "tier_2" | "pending_first_event", reason: string) {
    await run("supplier tier change", () => prismApi.changeSupplierTier(supplierId, { tier, reason }));
  }

  async function addSupplierReview(supplierId: string, input: { rating: number; notes: string; reviewedBy?: string }) {
    await run("supplier private review", () => prismApi.addSupplierReview(supplierId, { ...input, eventId: selectedEvent?.id }));
  }

  async function addSupplierCertification(supplierId: string, input: {
    fileName: string;
    documentType: string;
    issuer?: string;
    expiresAt?: string;
    status?: "submitted" | "verified" | "expired" | "rejected";
    notes?: string;
  }) {
    await run("supplier certification", () => prismApi.addSupplierCertification(supplierId, input));
  }

  async function requestSupplierQuotes(input: {
    categoryId: string;
    supplierIds: string[];
    confidentialBid: boolean;
    deadline?: string;
  }) {
    if (!selectedEvent) return;
    await run("request supplier quotes", () => prismApi.requestSupplierQuotes(selectedEvent.id, input));
  }

  async function selectSupplierQuote(quoteId: string) {
    if (!selectedEvent) return;
    await run("select supplier quote", () => prismApi.selectSupplierQuote(selectedEvent.id, quoteId));
  }

  async function recordPayment(
    milestoneId: string,
    input: {
      amountReceived: number;
      paymentDate: string;
      paymentMethod: "Bank Transfer" | "GCash" | "Cheque";
      referenceNumber?: string;
    },
  ) {
    if (!selectedEvent) return;
    await run("record payment", () => prismApi.recordPayment(selectedEvent.id, milestoneId, input));
  }

  async function sendBillingStatement(billingId: string) {
    if (!selectedEvent) return;
    await run("send billing statement", () => prismApi.sendBillingStatement(selectedEvent.id, billingId));
  }

  async function createComplianceRule(input: {
    title: string;
    conditionKey: string;
    phase: string;
    severity: string;
    layer: string;
    note: string;
  }) {
    await run("create compliance rule", () => prismApi.createComplianceRule(input));
  }

  async function runComplianceChecks(phase: string) {
    if (!selectedEvent) return;
    await run("run compliance", () => prismApi.runCompliance(selectedEvent.id, phase));
  }

  async function resolveComplianceCheck(checkId: string) {
    if (!selectedEvent) return;
    await run("resolve compliance", () =>
      prismApi.resolveCompliance(selectedEvent.id, checkId, {
        action: "resolve",
        note: "Resolved during PMCM review.",
        actorName: "Ms. Mys",
      }),
    );
  }

  async function overrideComplianceCheck(checkId: string, reason: string) {
    if (!selectedEvent) return;
    await run("override compliance", () =>
      prismApi.resolveCompliance(selectedEvent.id, checkId, {
        action: "override",
        overrideReason: reason,
        actorName: "Ms. Mys",
      }),
    );
  }

  async function createBillingSource(input: {
    sourceLabel: string;
    lineItems: Array<{ label: string; amount: number }>;
    paymentSchedule: Array<{ label: string; percentage: number }>;
  }) {
    if (!selectedEvent) return;
    await run("create billing source", () => prismApi.createBillingSource(selectedEvent.id, input));
  }

  async function approveBillingSource(sourceId: string) {
    if (!selectedEvent) return;
    await run("approve billing source", () => prismApi.approveBillingSource(selectedEvent.id, sourceId, "Approved by PMCM for billing generation."));
  }

  async function generateBillingStatement(sourceId: string) {
    if (!selectedEvent) return;
    await run("generate billing statement", () => prismApi.generateBillingStatement(selectedEvent.id, sourceId));
  }

  async function loadCloseGates() {
    if (!selectedEvent) throw new Error("No event selected");
    return prismApi.closeGates(selectedEvent.id);
  }

  async function archiveSelectedEvent(overrideReason?: string) {
    if (!selectedEvent) return;
    await run("archive event", () => prismApi.archiveEvent(selectedEvent.id, overrideReason));
  }

  async function loadEventInsights() {
    if (!selectedEvent) throw new Error("No event selected");
    return prismApi.eventInsights(selectedEvent.id);
  }

  async function generateEventInsights() {
    if (!selectedEvent) return;
    await run("generate insights", () => prismApi.generateEventInsights(selectedEvent.id));
  }

  async function assignCoordinator(coordinator: PrismCoordinator, role: string, overrideConflict = false) {
    if (!selectedEvent) return;
    await run("coordinator assignment", () =>
      prismApi.assignCoordinator(selectedEvent.id, {
        coordinatorId: coordinator.id,
        role,
        overrideConflict,
      }),
    );
  }

  async function createEventDayTask(input: {
    title: string;
    assignedRole?: string;
    ownerName?: string;
    priority?: string;
    notes?: string;
    slaDueAt?: string;
  }) {
    if (!selectedEvent) return;
    await runLiveOps("create event-day task", () => prismApi.createEventDayTask(selectedEvent.id, input));
  }

  async function updateEventDayTask(taskId: string, input: { status?: "open" | "in_progress" | "done" | "blocked"; notes?: string }) {
    if (!selectedEvent) return;
    await runLiveOps("update event-day task", () => prismApi.updateEventDayTask(selectedEvent.id, taskId, input));
  }

  async function escalateEventDayTask(
    taskId: string,
    input: { escalationLevel: "role_lead" | "pmcm" | "critical"; notes: string; ownerRole?: string; ownerName?: string },
  ) {
    if (!selectedEvent) return;
    await runLiveOps("escalate event-day task", () => prismApi.escalateEventDayTask(selectedEvent.id, taskId, input));
  }

  async function createUrgentIssue(input: {
    title: string;
    severity?: "low" | "medium" | "high" | "critical";
    ownerRole?: string;
    description?: string;
    slaDueAt?: string;
  }) {
    if (!selectedEvent) return;
    await runLiveOps("create urgent issue", () => prismApi.createUrgentIssue(selectedEvent.id, input));
  }

  async function updateUrgentIssue(issueId: string, input: { status?: "open" | "assigned" | "resolved" | "cancelled"; resolution?: string }) {
    if (!selectedEvent) return;
    await runLiveOps("update urgent issue", () => prismApi.updateUrgentIssue(selectedEvent.id, issueId, input));
  }

  async function escalateUrgentIssue(
    issueId: string,
    input: { escalationLevel: "role_lead" | "pmcm" | "critical"; notes: string; ownerRole?: string; ownerName?: string },
  ) {
    if (!selectedEvent) return;
    await runLiveOps("escalate urgent issue", () => prismApi.escalateUrgentIssue(selectedEvent.id, issueId, input));
  }

  async function updateCoordinatorAttendance(
    assignmentId: string,
    input: { status: "present" | "late" | "absent" | "replaced"; notes?: string },
  ) {
    if (!selectedEvent) return;
    await runLiveOps("update coordinator attendance", () =>
      prismApi.updateCoordinatorAttendance(selectedEvent.id, assignmentId, { ...input, markedBy: session.name }),
    );
  }

  async function replaceCoordinator(
    assignmentId: string,
    input: { replacementCoordinatorId: string; role: string; reason: string },
  ) {
    if (!selectedEvent) return;
    await runLiveOps("replace coordinator", () => prismApi.replaceCoordinator(selectedEvent.id, assignmentId, input));
  }

  async function verifySupplierStatus(
    requestId: string,
    input: { verificationStatus: "self_reported" | "verified" | "disputed"; notes?: string },
  ) {
    if (!selectedEvent) return;
    await runLiveOps("verify supplier setup", () =>
      prismApi.verifySupplierStatus(selectedEvent.id, requestId, { ...input, verifiedBy: session.name }),
    );
  }

  function openSupplierEvent(eventId: string) {
    setSelectedEventId(eventId);
    setSection("events");
    setTab("overview");
  }

  const shellNavItems = [
    { id: "events", icon: Radio, label: "Events", badge: unreviewedInquiries },
    { id: "suppliers", icon: Tags, label: "Suppliers" },
    { id: "audit-log", icon: ShieldCheck, label: "Audit trail" },
  ];

  const commandActions = commandInbox?.items.slice(0, 5).map((item) => ({
    id: item.id,
    label: item.label,
    description: item.description,
    status: item.status,
    onSelect: () => {
      if (item.eventId) {
        setSelectedEventId(item.eventId);
        setSection("events");
      }
      setTab(pmcmCommandTargetTab(item.kind));
    },
  })) ?? defenseReadiness?.nextActions.map((action) => ({
    id: action.key,
    label: action.label,
    description: action.detail,
    status: action.status,
    onSelect: () => setTab(action.targetTab as DetailTab),
  })) ?? [
    {
      id: "review-inquiries",
      label: "Review inquiries",
      description: "Accept a qualified inquiry and unlock the conforme path.",
      onSelect: () => setSection("events"),
    },
    {
      id: "supplier-desk",
      label: "Open supplier desk",
      description: "Review quote coverage and supplier readiness without leaving PMCM command.",
      onSelect: () => setSection("suppliers"),
    },
  ];
  const openActionCount = commandInbox
    ? commandInbox.counts.critical + commandInbox.counts.warning + commandInbox.counts.attention
    : defenseReadiness?.nextActions.length ?? pendingApprovals.length + unreviewedInquiries;
  const selectedEventActions = selectedEvent ? (
    <div className="flex flex-wrap gap-2">
      <Button size="sm" className="rounded-lg font-bold" onClick={() => run("briefing", () => prismApi.submitBriefing(selectedEvent.id))}>
        Submit briefing
      </Button>
      <Button size="sm" variant="outline" className="rounded-lg font-bold" onClick={() => setTab("suppliers")}>
        Supplier desk
      </Button>
      <Button size="sm" variant="outline" className="rounded-lg font-bold" onClick={() => setTab("live-ops")}>
        Live ops
      </Button>
    </div>
  ) : null;

  const openCheckCount = checks.filter((item) => item.status === "open").length;
  const eventTabItems = buildEventWorkflowTabs({
    draftsCount: drafts.length,
    quotesCount: quotes.length,
    assignmentsCount: assignments.length,
    paymentsCount: payments.length,
    openChecksCount: openCheckCount,
    role: session.role,
  });

  const eventRail = (
    <EventQueuePanel
      events={events}
      selectedEventId={selectedEvent?.id}
      onReset={() => run("reset", prismApi.reset)}
      onSelectEvent={(eventId) => {
        setSection("events");
        setSelectedEventId(eventId);
        setTab("overview");
      }}
    />
  );

  return (
    <PrismDashboardShell
      productLabel="P.R.I.S.M"
      roleLabel="PMCM Event Command"
      eyebrow="Operations cockpit"
      title={selectedEvent?.eventName ?? "Event Manager"}
      description="Conforme gates, floorplans, suppliers, billing, compliance, live operations, and closure in one command surface."
      activeItemId={section}
      navItems={shellNavItems}
      onNavSelect={(id) => setSection(id as "events" | "suppliers" | "audit-log")}
      user={{ name: session.name, detail: label(session.role), initials: session.name.slice(0, 2).toUpperCase() }}
      searchPlaceholder="Search events, approval requests, suppliers..."
      commandActions={commandActions}
      onSignOut={onSignOut}
      rightRail={section === "events" ? eventRail : undefined}
    >
      <section className="min-w-0 space-y-4">
        {error && (
          <Alert variant="destructive" className="rounded-xl">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {section === "suppliers" ? (
          <SupplierDirectory
            categories={supplierCategories}
            suppliers={suppliers}
            onToggleBni={toggleSupplierBni}
            onCreateSupplier={createSupplier}
            onUpdateSupplier={updateSupplierProfile}
            onChangeTier={changeSupplierTier}
            onAddReview={addSupplierReview}
            onAddCertification={addSupplierCertification}
            onOpenEvent={openSupplierEvent}
            busy={Boolean(busy)}
          />
        ) : section === "audit-log" ? (
          <AuditTrailPanel events={events} users={state.users} session={session} />
        ) : (
          <>

        <AdminApprovalsPanel
          approvals={pendingApprovals}
          busy={Boolean(busy)}
          onApprove={(request) => run("approve account", () => prismApi.approveApprovalRequest(request.id))}
          onDecline={(request) => run("decline account", () => prismApi.declineApprovalRequest(request.id))}
        />

        <InquiryIntakeLog
          inquiries={state.inquiries}
          onAccept={acceptInquiry}
          onPend={pendInquiry}
          onDecline={declineInquiry}
          busy={Boolean(busy)}
        />

        <ClientOnboardingTracker
          inquiries={state.inquiries}
          onUploadConforme={uploadConformeForInquiry}
          onSendReminder={sendConformeReminder}
          busy={Boolean(busy)}
        />

        {selectedEvent ? (
          <>
            <SelectedEventCockpit
              event={selectedEvent}
              defenseReadiness={defenseReadiness}
              openActionCount={openActionCount}
              action={selectedEventActions}
            />

            <SelectedEventStatusSummary
              drafts={drafts}
              activeDraft={activeDraft}
              quoteRequestCount={quoteRequests.length}
              quoteCount={quotes.length}
              openCheckCount={openCheckCount}
            />

            <EventWorkflowTabs items={eventTabItems} activeTab={tab} onSelectTab={setTab} />

            {tab === "overview" && (
              <EventOverviewPanels
                event={selectedEvent}
                defenseReadiness={defenseReadiness}
                drafts={drafts}
                activeDraft={activeDraft}
                quoteRequestCount={quoteRequests.length}
                quoteCount={quotes.length}
                openCheckCount={openCheckCount}
                onSubmitBriefing={() => run("briefing", () => prismApi.submitBriefing(selectedEvent.id))}
                onOpenSupplierDesk={() => setTab("suppliers")}
                onRunCompliance={() => run("compliance", () => prismApi.runCompliance(selectedEvent.id, "planning"))}
                onOpenCoordinatorDesk={() => setTab("coordinators")}
                onOpenLiveOps={() => setTab("live-ops")}
                onOpenFloorplans={() => setTab("floorplans")}
                onOpenBilling={() => setTab("billing")}
                onOpenClosure={() => setTab("closure")}
              />
            )}

            {tab === "floorplans" && (
              <EventFloorplansTab
                event={selectedEvent}
                drafts={drafts}
                floorPlanTemplates={floorPlanTemplates}
                onCreateTemplateDraft={(template) => run("create floorplan", () => createTemplateDraft(template))}
                onOpenDraft={(event, draft) => run("open draft", () => onOpenEditor(event, draft))}
                onSubmitDraft={(draft) => run("submit draft", () => prismApi.submitFloorPlanDraft(selectedEvent.id, draft.id))}
                onApproveDraft={(draft) => run("approve draft", () => prismApi.approveFloorPlanDraft(selectedEvent.id, draft.id))}
              />
            )}
            {tab === "briefing" && <EventBriefingPanel briefing={briefing ?? null} />}
            {tab === "suppliers" && (
              <EventSuppliersTab
                categories={supplierCategories}
                suppliers={suppliers}
                requests={quoteRequests}
                quotes={quotes}
                onRequestQuotes={requestSupplierQuotes}
                onSelectQuote={selectSupplierQuote}
                busy={Boolean(busy)}
              />
            )}

            {tab === "coordinators" && selectedEvent && (
              <CoordinatorAssignmentDesk
                event={selectedEvent}
                coordinators={coordinators}
                assignments={assignments}
                roleRequirements={coordinatorRoleRequirements}
                busy={Boolean(busy)}
                onAssign={assignCoordinator}
              />
            )}

            {tab === "live-ops" && selectedEvent && (
              <LiveOperationsWorkspace
                event={selectedEvent}
                liveOps={liveOps}
                statusFeed={statusFeed}
                coordinators={coordinators}
                busy={Boolean(busy)}
                onReload={async () => {
                  await refreshEventReadiness();
                }}
                onCreateTask={createEventDayTask}
                onUpdateTask={updateEventDayTask}
                onEscalateTask={escalateEventDayTask}
                onCreateIssue={createUrgentIssue}
                onUpdateIssue={updateUrgentIssue}
                onEscalateIssue={escalateUrgentIssue}
                onUpdateCoordinatorAttendance={updateCoordinatorAttendance}
                onReplaceCoordinator={replaceCoordinator}
                onVerifySupplierStatus={verifySupplierStatus}
              />
            )}

            {tab === "billing" && (
              <FinancialWorkspace
                event={selectedEvent}
                inquiry={selectedInquiry}
                billingStatements={billingStatements}
                payments={payments}
                notificationLogs={notificationLogs}
                busy={Boolean(busy)}
                onRecordPayment={recordPayment}
                onSendBilling={sendBillingStatement}
              />
            )}

            {tab === "closure" && (
              <Phase4Workspace
                event={selectedEvent}
                rules={complianceRules}
                checks={checks}
                billingSources={billingSources}
                billingStatements={billingStatements}
                insights={eventInsights}
                busy={Boolean(busy)}
                onCreateRule={createComplianceRule}
                onRunCompliance={runComplianceChecks}
                onResolveCompliance={resolveComplianceCheck}
                onOverrideCompliance={overrideComplianceCheck}
                onCreateBillingSource={createBillingSource}
                onApproveBillingSource={approveBillingSource}
                onGenerateBillingStatement={generateBillingStatement}
                onLoadCloseGates={loadCloseGates}
                onArchive={archiveSelectedEvent}
                onLoadInsights={loadEventInsights}
                onGenerateInsights={generateEventInsights}
              />
            )}

            {tab === "activity" && (
              <EventActivityPanel
                event={selectedEvent}
                notificationLogs={notificationLogs}
                assignments={assignments}
                audit={audit}
              />
            )}
          </>
        ) : (
          <Panel title="No confirmed events" icon={AlertTriangle}>
            <p className="text-sm text-muted-foreground">Accept an inquiry and upload signed conforme to create the first PMCM event workspace.</p>
          </Panel>
        )}
          </>
        )}
      </section>
    </PrismDashboardShell>
  );
}

export default function EventCommandHome() {
  const router = useRouter();
  const [session, setSession] = useState<EventSession | null>(null);
  const [state, setState] = useState<PrismPmcmDashboardWorkspace | null>(null);
  const [commandInbox, setCommandInbox] = useState<PrismPmcmCommandInbox | null>(null);
  const [coordinatorState, setCoordinatorState] = useState<PrismCoordinatorWorkspace | null>(null);
  const [screen, setScreen] = useState<Screen>({ name: "portal" });
  const [error, setError] = useState<string | null>(null);

  async function refresh(current = session) {
    if (!current) return;
    if (current.role === "coordinator") {
      const next = await prismApi.coordinatorWorkspace(current);
      setCoordinatorState(next);
      setState(null);
      setCommandInbox(null);
      return;
    }
    const [next, nextCommandInbox] = await Promise.all([
      prismApi.pmcmState(),
      prismApi.pmcmCommandInbox().catch(() => null),
    ]);
    setState(next);
    setCommandInbox(nextCommandInbox);
    setCoordinatorState(null);
  }

  useEffect(() => {
    const current = readStoredEventSession();
    if (!current) return;
    setSession(current);
    refresh(current).catch((err) => setError(err instanceof Error ? err.message : "Unable to load event portal"));
    router.replace("/dashboard");
  }, [router]);

  useEffect(() => {
    if (session) router.replace("/dashboard");
  }, [router, session]);

  useEffect(() => {
    if (!session || screen.name !== "portal") return;
    const intervalId = window.setInterval(() => {
      refresh(session).catch((err) => setError(err instanceof Error ? err.message : "Unable to refresh event portal"));
    }, 30_000);

    return () => window.clearInterval(intervalId);
  }, [session, screen.name]);

  async function openEditor(event: PrismEvent, draft: PrismFloorPlanDraft) {
    if (!session || !isPmcmAdmin(session.role)) return;
    const project = await prismApi.loadPlan(draft.floorPlanId);
    setScreen({ name: "editor", event, draft, project });
  }

  if (!session) {
    return (
      <EventCommandLanding
        onSignedIn={(nextSession) => {
          setSession(nextSession);
          refresh(nextSession).catch((err) => setError(err instanceof Error ? err.message : "Unable to load event portal"));
          router.replace("/dashboard");
        }}
      />
    );
  }

  if (screen.name === "editor") {
    return (
      <div className="h-screen w-full overflow-hidden">
        <EditorShell
          project={screen.project}
          eventName={screen.event.eventName}
          draftName={screen.draft.name}
          draftStatus={screen.draft.status}
          onSave={(project) => prismApi.savePlan(project)}
          onSubmit={async (project) => {
            await prismApi.savePlan(project);
            await prismApi.submitFloorPlanDraft(screen.event.id, screen.draft.id);
            await refresh(session);
            setScreen({ name: "portal" });
          }}
          onBack={() => setScreen({ name: "portal" })}
        />
      </div>
    );
  }

  const signOut = () => {
    clearEventSession();
    setSession(null);
    setState(null);
    setCommandInbox(null);
    setCoordinatorState(null);
  };
  const isLoadingRoleData = session.role === "coordinator" ? !coordinatorState : !state;

  if (session.role !== "coordinator" && state) {
    return (
      <PmcmPortal
        session={session}
        state={state}
        commandInbox={commandInbox}
        onRefresh={() => refresh(session)}
        onOpenEditor={openEditor}
        onSignOut={signOut}
      />
    );
  }

  return (
    <main className="min-h-screen bg-background text-foreground">
      <section className="mx-auto max-w-[1480px] px-5 py-6 sm:px-8">
        {error && (
          <Alert variant="destructive" className="mb-5 rounded-lg">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
        {isLoadingRoleData ? (
          <EventRoleLoadingState role={session.role} />
        ) : session.role === "coordinator" && coordinatorState ? (
          <CoordinatorView session={session} state={coordinatorState} onRefresh={() => refresh(session)} onSignOut={signOut} />
        ) : (
          null
        )}
      </section>
    </main>
  );
}
