"use client";

import { PostEventDeliverablesPanel } from "@/features/closure/deliverables/views/post-event-deliverables-panel";


import { FileCheck2, Gavel } from "lucide-react";
import { Button } from "@/app/components/ui/button";
import { EmptyState } from "@/app/components/ui/empty-state";
import { PAREPanel } from "@/features/pare/panel";
import { Phase4Workspace } from "@/features/closure/phase4";
import { CoordinatorAssignmentDesk } from "@/features/coordinators/desk";
import { PostponementImpactPanel } from "@/features/event-decisions/postponement-impact";
import { ChangeRegisterPanel } from "@/features/change-management/register";
import { isScopeFrozen } from "@/features/change-management/register/model/change-register-rules";
import { EventWorkspaceOverview } from "./event-overview";
import { FinancialWorkspace } from "@/features/finance/workspace";
import { BillingSourcePanel } from "@/features/finance/billing-source/views/billing-source-panel";
import { canStartEventDay } from "../../model/event-dashboard-selectors";
import { BillingAdjustmentsPanel } from "@/features/finance/billing-adjustments/views/billing-adjustments-panel";
import { LiveOperationsWorkspace } from "@/features/live-ops/workspace";
import { HandoffBriefPanel } from "@/features/live-ops/handoff-brief";
import { DecisionLogPanel } from "@/features/decision-log";
import { SupplierQuotePlanner } from "@/features/suppliers/directory";
import { PmcmSupplierReadinessBoard, supplierReadinessRefreshKey } from "@/features/suppliers/readiness";
import { PmcmSupplierWorkflowsPanel } from "@/features/suppliers/workflows/views/pmcm-supplier-workflows-panel";
import { EventRegistrationTab } from "@/app/components/pmcm/event-registration-tab";
import { EventGamesHostView } from "@/features/event-games/host";
import { EventFloorplansTab } from "@/features/floorplan/workspace";
import { EventMessagesWorkspace } from "@/features/event-dashboard/messages/views/event-messages-workspace";
import { FeedbackModerationPanel } from "@/features/feedback/moderation";
import { EventClientFloorplanAccessPanel } from "@/features/event-dashboard/client-floorplan-access/views/event-client-floorplan-access-panel";
import { canManageClientFloorplanAccess } from "@/features/event-dashboard/client-floorplan-access/model/client-floorplan-access";
import { isPmcmAdmin } from "@/app/lib/role-guards";
import { WorkspaceSubTabs, type WorkspaceSubTab } from "./workspace-sub-tabs";
import { formatPortalDate, formatPortalDateTime } from "@prism/ui/format-date";
import type { PrismBriefing } from "@prism/types";
import { useEventDashboardLoadedRouteViewModel } from "../event-dashboard-route-context";
import { PmcmClientReviewPanel } from "@/features/commercial/client-review/views/pmcm-client-review-panel";
import { PmcmProposalIssuerPanel } from "@/features/commercial/proposal-issuer/views/pmcm-proposal-issuer-panel";

export function EventWorkspaceOverviewTab() {
  const vm = useEventDashboardLoadedRouteViewModel();
  if (!vm.selectedEvent) return null;
  return (
    <EventWorkspaceOverview
      event={vm.selectedEvent}
      readiness={vm.defenseReadiness}
      drafts={vm.drafts}
      activeDraft={vm.activeDraft}
      quoteRequestCount={vm.quoteRequests.length}
      quoteCount={vm.quotes.length}
      openCheckCount={vm.openCheckCount}
      canStartEventDay={isPmcmAdmin(vm.session.role) && canStartEventDay(vm.selectedEvent)}
      busy={Boolean(vm.busy)}
      onStartEventDay={() => void vm.startEventDay()}
      onSubmitBriefing={() => void vm.submitBriefing()}
      onRunCompliance={() => void vm.runPlanningCompliance()}
      onOpenTab={(tab) => vm.navigateEventTab(tab)}
    />
  );
}

export function EventWorkspaceFloorplansTab() {
  const vm = useEventDashboardLoadedRouteViewModel();
  const { selectedEvent, run } = vm;
  if (!selectedEvent) return null;
  // The workspace leads with the approved official plan; creation controls come last (UX-13).
  return (
    <EventFloorplansTab
      event={selectedEvent}
      drafts={vm.drafts}
      floorPlanTemplates={vm.floorPlanTemplates}
      onCreateTemplateDraft={(template) => run("create floorplan", () => vm.createTemplateDraft(template))}
      onCreateBlankDraft={() => run("create floorplan", () => vm.createBlankDraft())}
      onOpenDraft={(event, draft, readOnly) => run(readOnly ? "view preference layout" : "open draft", () => vm.openEditor(event, draft, readOnly))}
      onSubmitDraft={(draft) => vm.submitFloorPlanDraft(draft)}
      onApproveDraft={(draft) => vm.approveFloorPlanDraft(draft)}
      onReopenClientPreference={(draft) => vm.reopenClientPreference(draft)}
      accessPanel={
        canManageClientFloorplanAccess(String(vm.session.role)) ? (
          <details className="rounded-lg border border-border bg-card">
            <summary className="flex min-h-11 cursor-pointer items-center px-5 text-sm font-semibold">Client floorplan access</summary>
            <EventClientFloorplanAccessPanel eventId={selectedEvent.id} />
          </details>
        ) : null
      }
    />
  );
}

function briefingFacts(briefing: PrismBriefing) {
  const times = [briefing.confirmedStartTime, briefing.confirmedEndTime].filter(Boolean).join("–");
  const schedule = [briefing.confirmedDate ? formatPortalDate(briefing.confirmedDate) : null, times || null].filter(Boolean).join(" · ");
  return [
    { label: "Venue", value: briefing.venue || "Not set" },
    { label: "Guests", value: briefing.guestCount ? briefing.guestCount.toLocaleString("en-PH") : "Not set" },
    { label: "Budget", value: briefing.budgetRange || "Not set" },
    { label: "Confirmed schedule", value: schedule || "Not confirmed" },
  ];
}

function BriefingServices({ services }: { services: string[] }) {
  if (services.length === 0) return null;
  return (
    <div className="border-t border-border px-5 py-4">
      <p className="text-xs text-muted-foreground">Services requested</p>
      <ul className="mt-2 flex flex-wrap gap-1.5">
        {services.map((service) => (
          <li key={service} className="rounded-md bg-muted px-2 py-0.5 text-xs font-medium text-foreground">{service}</li>
        ))}
      </ul>
    </div>
  );
}

function BriefingNotes({ entries }: { entries: Array<{ label: string; text?: string | null }> }) {
  const present = entries.filter((entry) => entry.text);
  if (present.length === 0) return null;
  return (
    <div className="grid gap-4 border-t border-border px-5 py-4 sm:grid-cols-2">
      {present.map((entry) => (
        <div key={entry.label}>
          <p className="text-xs text-muted-foreground">{entry.label}</p>
          <p className="mt-1 whitespace-pre-wrap text-sm text-foreground">{entry.text}</p>
        </div>
      ))}
    </div>
  );
}

function BriefingSummary({ briefing, canSubmit, busy, onSubmit }: { briefing?: PrismBriefing | null; canSubmit: boolean; busy: boolean; onSubmit: () => void }) {
  if (!briefing) {
    return (
      <EmptyState
        icon={FileCheck2}
        title="No briefing yet"
        description="The client's briefing sets the venue, guest count, budget and services PMCM plans against."
        action={canSubmit ? <Button size="sm" disabled={busy} onClick={onSubmit}>Submit briefing</Button> : undefined}
      />
    );
  }
  return (
    <section className="rounded-xl border border-border bg-card">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-5 py-3">
        <div>
          <h2 className="font-semibold text-foreground">Client briefing</h2>
          <p className="text-xs text-muted-foreground">Submitted {formatPortalDateTime(briefing.submittedAt)}</p>
        </div>
        {canSubmit ? <Button size="sm" variant="outline" disabled={busy} onClick={onSubmit}>Resubmit briefing</Button> : null}
      </div>
      <dl className="grid gap-x-6 gap-y-4 px-5 py-4 sm:grid-cols-2 lg:grid-cols-4">
        {briefingFacts(briefing).map((fact) => (
          <div key={fact.label} className="min-w-0">
            <dt className="text-xs text-muted-foreground">{fact.label}</dt>
            <dd className="mt-1 break-words text-sm font-semibold text-foreground">{fact.value}</dd>
          </div>
        ))}
      </dl>
      <BriefingServices services={briefing.serviceRequirements} />
      <BriefingNotes entries={[{ label: "Mood and styling", text: briefing.moodAndStyling }, { label: "Notes", text: briefing.notes }]} />
    </section>
  );
}

export function EventWorkspaceBriefingTab() {
  const vm = useEventDashboardLoadedRouteViewModel();
  const { briefing, selectedEvent } = vm;
  if (!selectedEvent) return null;
  const admin = isPmcmAdmin(vm.session.role);
  const tabs: WorkspaceSubTab[] = [
    {
      id: "briefing",
      label: "Briefing",
      attention: !briefing,
      render: () => <BriefingSummary briefing={briefing} canSubmit busy={Boolean(vm.busy)} onSubmit={() => void vm.submitBriefing()} />,
    },
    ...(admin ? [{ id: "proposal", label: "Proposal", render: () => <PmcmProposalIssuerPanel eventId={selectedEvent.id} /> }] : []),
    { id: "reviews", label: "Client reviews", render: () => <PmcmClientReviewPanel eventId={selectedEvent.id} /> },
    { id: "changes", label: "Scope changes", render: () => <ChangeRegisterPanel eventId={selectedEvent.id} frozen={isScopeFrozen(selectedEvent.freezeStatus)} /> },
    ...(admin ? [{ id: "decisions", label: "Decision log", render: () => <DecisionLogPanel eventId={selectedEvent.id} /> }] : []),
  ];
  return <WorkspaceSubTabs label="Planning sections" tabs={tabs} />;
}

export function EventWorkspaceSuppliersTab() {
  const vm = useEventDashboardLoadedRouteViewModel();
  if (!vm.selectedEvent) return null;
  const event = vm.selectedEvent;
  const confirmed = vm.quoteRequests.filter((request) => request.assignmentStatus === "confirmed");
  const awaitingQuotes = vm.quoteRequests.filter((request) => !vm.quotes.some((quote) => quote.requestId === request.id)).length;
  const tabs: WorkspaceSubTab[] = [
    {
      id: "quotes",
      label: "Requests & quotes",
      count: awaitingQuotes,
      attention: awaitingQuotes > 0,
      render: () => (
        <SupplierQuotePlanner
          key={event.id}
          categories={vm.supplierCategories}
          suppliers={vm.suppliers}
          requests={vm.quoteRequests}
          quotes={vm.quotes}
          onRequestQuotes={vm.requestSupplierQuotes}
          onSelectQuote={vm.selectSupplierQuote}
          onCompareRound={vm.compareSupplierQuoteRound}
          onSetAvailability={vm.setSupplierAvailability}
          busy={Boolean(vm.busy)}
        />
      ),
    },
    { id: "readiness", label: "Readiness", render: () => <PmcmSupplierReadinessBoard eventId={event.id} refreshKey={supplierReadinessRefreshKey(vm.quoteRequests)} /> },
    { id: "bookings", label: "Bookings & contracts", count: confirmed.length, render: () => <PmcmSupplierWorkflowsPanel eventId={event.id} requests={vm.quoteRequests} quotes={vm.quotes} /> },
    {
      id: "emergency",
      label: "Replace a supplier",
      render: () => (
        <section className="rounded-xl border border-border bg-card p-5">
          <h2 className="font-semibold text-foreground">Replace a supplier</h2>
          <p className="mt-0.5 text-sm text-muted-foreground">If a confirmed supplier drops out, withdraw them here and review suggested replacements.</p>
          <div className="mt-4">
            <PAREPanel eventId={event.id} assignedRequests={confirmed} suppliers={vm.suppliers} onWithdraw={vm.withdrawSupplier} busy={Boolean(vm.busy)} />
          </div>
        </section>
      ),
    },
  ];
  return <WorkspaceSubTabs label="Supplier sections" tabs={tabs} />;
}

export function EventWorkspaceCoordinatorsTab() {
  const vm = useEventDashboardLoadedRouteViewModel();
  if (!vm.selectedEvent) return null;
  const event = vm.selectedEvent;
  const tabs: WorkspaceSubTab[] = [
    {
      id: "assignments",
      label: "Assignments",
      render: () => (
        <div id="coordinator-assignment-desk">
          <CoordinatorAssignmentDesk
            event={event}
            coordinators={vm.coordinators}
            assignments={vm.state.coordinatorAssignments}
            roleRequirements={vm.coordinatorRoleRequirements}
            busy={Boolean(vm.busy)}
            onAssign={vm.assignCoordinator}
            onLoadSuggestions={vm.loadCoordinatorSuggestions}
            onSaveCoverage={vm.saveCoordinatorCoverage}
            onSendReminders={vm.sendCoordinatorAcknowledgementReminders}
            onDesignateOperator={vm.designateEventDayOperator}
            onRevokeOperator={vm.revokeEventDayOperator}
            onLoadOperator={vm.loadEventDayOperator}
            onLoadAvailability={vm.loadCoordinatorAvailability}
            onLoadReliabilityHistory={vm.loadCoordinatorReliabilityHistory}
            onCreateAvailability={vm.createCoordinatorAvailability}
            onDeleteAvailability={vm.deleteCoordinatorAvailability}
          />
        </div>
      ),
    },
    { id: "postponement", label: "If the date moves", render: () => <PostponementImpactPanel eventId={event.id} /> },
  ];
  return <WorkspaceSubTabs label="Team sections" tabs={tabs} />;
}

export function EventWorkspaceLiveOpsTab() {
  const vm = useEventDashboardLoadedRouteViewModel();
  if (!vm.selectedEvent) return null;
  const event = vm.selectedEvent;
  const tabs: WorkspaceSubTab[] = [
    {
      id: "desk",
      label: "Live desk",
      render: () => (
        <LiveOperationsWorkspace
          event={event}
          liveOps={vm.liveOps}
          statusFeed={vm.statusFeed}
          coordinators={vm.coordinators}
          busy={Boolean(vm.busy)}
          onReload={vm.loadLiveOps}
          onCreateTask={vm.createEventDayTask}
          onUpdateTask={vm.updateEventDayTask}
          onEscalateTask={vm.escalateEventDayTask}
          onCreateIssue={vm.createUrgentIssue}
          onUpdateIssue={vm.updateUrgentIssue}
          onEscalateIssue={vm.escalateUrgentIssue}
          onUpdateCoordinatorAttendance={vm.updateCoordinatorAttendance}
          onReplaceCoordinator={vm.replaceCoordinator}
          onLoadCoordinatorSuggestions={vm.loadCoordinatorSuggestions}
          onVerifySupplierStatus={vm.verifySupplierStatus}
          onDecideTaskReassignment={vm.decideEventTaskReassignment}
        />
      ),
    },
    { id: "handoff", label: "Shift handoff", render: () => <HandoffBriefPanel eventId={event.id} /> },
  ];
  return <WorkspaceSubTabs label="Live operations sections" tabs={tabs} />;
}

export function EventWorkspaceBillingTab() {
  const vm = useEventDashboardLoadedRouteViewModel();
  if (!vm.selectedEvent) return null;
  const event = vm.selectedEvent;
  const outstanding = vm.payments.filter((payment) => payment.status !== "paid" && !payment.supersededAt).length;
  const tabs: WorkspaceSubTab[] = [
    {
      id: "payments",
      label: "Statements & payments",
      count: outstanding,
      attention: outstanding > 0,
      render: () => (
        <FinancialWorkspace
          event={event}
          inquiry={vm.selectedInquiry}
          billingStatements={vm.billingStatements}
          payments={vm.payments}
          notificationLogs={vm.notificationLogs}
          busy={Boolean(vm.busy)}
          onRecordPayment={vm.recordPayment}
          onSendBilling={vm.sendBillingStatement}
          onMarkPayment={vm.markPayment}
        />
      ),
    },
    {
      id: "sources",
      label: "Billing sources",
      count: vm.billingSources.length,
      render: () => (
        <BillingSourcePanel
          key={event.id}
          eventName={event.eventName}
          billingSources={vm.billingSources}
          proposalDocuments={vm.documents.filter((document) => document.eventId === event.id && /proposal/i.test(document.type))}
          busy={Boolean(vm.busy)}
          onCreate={vm.createBillingSource}
          onApprove={vm.approveBillingSource}
          onGenerate={vm.generateBillingStatement}
        />
      ),
    },
    {
      id: "adjustments",
      label: "Adjustments & disputes",
      render: () => <BillingAdjustmentsPanel eventId={event.id} statements={vm.billingStatements} billingSources={vm.billingSources} payments={vm.payments} />,
    },
  ];
  return <WorkspaceSubTabs label="Billing sections" tabs={tabs} />;
}

export function EventWorkspaceClosureTab() {
  const vm = useEventDashboardLoadedRouteViewModel();
  if (!vm.selectedEvent) return null;
  const event = vm.selectedEvent;
  const tabs: WorkspaceSubTab[] = [
    {
      id: "checklist",
      label: "Close checklist",
      count: vm.openCheckCount,
      attention: vm.openCheckCount > 0,
      render: () => (
        <Phase4Workspace
          event={event}
          rules={vm.complianceRules}
          checks={vm.checks}
          billingSources={vm.billingSources}
          billingStatements={vm.billingStatements}
          insights={vm.eventInsights}
          supplierCategories={vm.supplierCategories}
          suppliers={vm.suppliers}
          quoteRequests={vm.quoteRequests}
          canReviewSuppliers={isPmcmAdmin(vm.session.role)}
          busy={Boolean(vm.busy)}
          onCreateRule={vm.createComplianceRule}
          onRunCompliance={vm.runComplianceChecks}
          onResolveCompliance={vm.resolveComplianceCheck}
          onOverrideCompliance={vm.overrideComplianceCheck}
          onLoadCloseGates={vm.loadCloseGates}
          onArchive={vm.archiveSelectedEvent}
          onRecordActualEventEnd={vm.recordActualEventEnd}
          onLoadInsights={vm.loadEventInsights}
          onGenerateInsights={vm.generateEventInsights}
          onAddReview={vm.addSupplierReview}
        />
      ),
    },
    {
      id: "deliverables",
      label: "Deliverables",
      count: vm.postEventDocuments.length,
      render: () => <PostEventDeliverablesPanel eventId={event.id} documents={vm.postEventDocuments} archived={event.archived} />,
    },
    { id: "feedback", label: "Guest feedback", render: () => <FeedbackModerationPanel eventId={event.id} /> },
  ];
  return <WorkspaceSubTabs label="Closure sections" tabs={tabs} />;
}

/** PMCM-only (FL-019). Other roles get no panel here, and the API refuses them independently. */
export function EventWorkspaceDecisionsTab() {
  const vm = useEventDashboardLoadedRouteViewModel();
  if (!vm.selectedEvent) return null;
  if (!isPmcmAdmin(vm.session.role)) {
    return <EmptyState icon={Gavel} title="Decision log is PMCM-only" description="Overrides, approvals, and scope decisions are visible to PMCM administrators." />;
  }
  return <DecisionLogPanel eventId={vm.selectedEvent.id} />;
}

export function EventWorkspaceActivityTab() {
  const vm = useEventDashboardLoadedRouteViewModel();
  if (!vm.selectedEvent) return null;
  return (
    <EventMessagesWorkspace
      event={vm.selectedEvent}
      session={vm.session}
    />
  );
}

function RegistrationAndGames({ initial }: { initial: "registration" | "games" }) {
  const vm = useEventDashboardLoadedRouteViewModel();
  if (!vm.selectedEvent) return null;
  const event = vm.selectedEvent;
  const tabs: WorkspaceSubTab[] = [
    {
      id: "registration",
      label: "Registration",
      render: () => (
        <EventRegistrationTab
          platform={vm.registrationPlatform}
          suppliers={vm.suppliers}
          busy={Boolean(vm.busy)}
          loadError={vm.commandDataErrors.registrationPlatform}
          onUpsert={vm.upsertRegistrationPlatform}
          onUpdate={vm.updateRegistrationPlatform}
          onImportHeadcount={vm.importHeadcount}
          eventId={event.id}
          onSearchRoster={vm.searchGuestRoster}
          onImportRoster={vm.importGuestRoster}
          onCheckInRoster={vm.checkInGuestRoster}
          onVerifyRoster={vm.verifyGuestRoster}
          walkInPolicy={event.walkInPolicy ?? "closed"}
          walkInThreshold={event.walkInThreshold ?? 200}
          onUpdateWalkInPolicy={vm.updateWalkInPolicy}
          guestPrivacyClassification={vm.guestPrivacyClassification?.classification ?? "unclassified"}
          onUpdateGuestPrivacyClassification={vm.updateGuestPrivacyClassification}
        />
      ),
    },
    {
      id: "games",
      label: "Games",
      render: () => (
        <EventGamesHostView eventId={event.id} role={vm.session.role} eventStatus={event.status} archived={event.archived} actualEndedAt={event.actualEndedAt} />
      ),
    },
  ];
  return <WorkspaceSubTabs label="Registration and games" tabs={tabs} defaultId={initial} />;
}

export function EventWorkspaceRegistrationTab() {
  return <RegistrationAndGames initial="registration" />;
}

export function EventWorkspaceGamesTab() {
  return <RegistrationAndGames initial="games" />;
}
