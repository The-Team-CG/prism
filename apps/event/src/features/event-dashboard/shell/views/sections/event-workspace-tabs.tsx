"use client";

import { PostEventDeliverablesPanel } from "@/features/closure/deliverables/views/post-event-deliverables-panel";


import { FileCheck2, Gavel, Truck } from "lucide-react";
import { Button } from "@/app/components/ui/button";
import { EmptyState } from "@/app/components/ui/empty-state";
import { PAREPanel } from "@/features/pare/panel";
import { Phase4Workspace } from "@/features/closure/phase4";
import { CoordinatorAssignmentDesk } from "@/features/coordinators/desk";
import { PostponementImpactPanel } from "@/features/event-decisions/postponement-impact";
import { ChangeRegisterPanel } from "@/features/change-management/register";
import { isScopeFrozen } from "@/features/change-management/register/model/change-register-rules";
import { EventOverviewPanels } from "@/features/command-inbox/list";
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
import { Card, CardBody, CardHeader } from "./shell-ui";
import { useEventDashboardLoadedRouteViewModel } from "../event-dashboard-route-context";
import { PmcmClientReviewPanel } from "@/features/commercial/client-review/views/pmcm-client-review-panel";
import { PmcmProposalIssuerPanel } from "@/features/commercial/proposal-issuer/views/pmcm-proposal-issuer-panel";

export function EventWorkspaceOverviewTab() {
  const vm = useEventDashboardLoadedRouteViewModel();
  if (!vm.selectedEvent) return null;
  return (
    <div className="space-y-4">
      {isPmcmAdmin(vm.session.role) && canStartEventDay(vm.selectedEvent) ? (
        <section className="rounded-lg border border-border bg-card p-5">
          <h2 className="text-lg font-bold">Event day</h2>
          <p className="mt-1 text-sm text-muted-foreground">Start live operations after the conforme is signed and the official floorplan is approved.</p>
          <Button className="mt-4" disabled={Boolean(vm.busy)} onClick={() => void vm.startEventDay()}>Start event day</Button>
        </section>
      ) : null}
      <EventOverviewPanels
        event={vm.selectedEvent}
        defenseReadiness={vm.defenseReadiness}
        drafts={vm.drafts}
        activeDraft={vm.activeDraft}
        quoteRequestCount={vm.quoteRequests.length}
        quoteCount={vm.quotes.length}
        openCheckCount={vm.openCheckCount}
        onSubmitBriefing={vm.submitBriefing}
        onOpenSupplierDesk={() => vm.navigateEventTab("suppliers")}
        onRunCompliance={vm.runPlanningCompliance}
        onOpenCoordinatorDesk={() => vm.navigateEventTab("coordinators")}
        onOpenLiveOps={() => vm.navigateEventTab("live-ops")}
        onOpenFloorplans={() => vm.navigateEventTab("floorplans")}
        onOpenBilling={() => vm.navigateEventTab("billing")}
        onOpenClosure={() => vm.navigateEventTab("closure")}
      />
    </div>
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

export function EventWorkspaceBriefingTab() {
  const vm = useEventDashboardLoadedRouteViewModel();
  const { briefing, selectedEvent } = vm;
  if (!selectedEvent) return null;
  return (
    <div className="space-y-4">
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <FileCheck2 className="size-4 text-primary" />
          <h2 className="text-sm font-bold text-foreground">Event briefing</h2>
        </div>
      </CardHeader>
      <CardBody>
        {briefing ? (
          <div className="grid gap-3 sm:grid-cols-2">
            {[
              { label: "Venue", value: briefing.venue },
              { label: "Guest count", value: String(briefing.guestCount) },
              { label: "Budget range", value: briefing.budgetRange },
              { label: "Services", value: briefing.serviceRequirements.join(", ") },
            ].map(({ label: lbText, value }) => (
              <div key={lbText} className="rounded-xl bg-muted/40 p-4">
                <p className="text-xs font-semibold text-muted-foreground">{lbText}</p>
                <p className="mt-1.5 text-sm font-bold text-foreground">{value}</p>
              </div>
            ))}
          </div>
        ) : (
          <EmptyState icon={FileCheck2} title="No briefing submitted yet" description="Use the quick action to submit a briefing for this event." />
        )}
        <Button size="sm" className="mt-4" onClick={vm.submitBriefing}>Submit briefing</Button>
        {isPmcmAdmin(vm.session.role) ? <Button size="sm" variant="outline" className="ml-2 mt-4" onClick={() => vm.navigateEventTab("decisions")}>Decision log</Button> : null}
      </CardBody>
    </Card>
    {isPmcmAdmin(vm.session.role) ? (
      <details className="rounded-lg border border-border bg-card">
        <summary className="cursor-pointer px-5 py-4 text-sm font-semibold">Commercial proposal</summary>
        <PmcmProposalIssuerPanel eventId={selectedEvent.id} />
      </details>
    ) : null}
    <details className="rounded-lg border border-border bg-card">
      <summary className="cursor-pointer px-5 py-4 text-sm font-semibold">Client proposals and reviews</summary>
      <PmcmClientReviewPanel eventId={selectedEvent.id} />
    </details>
    <details className="rounded-lg border border-border bg-card">
      <summary className="cursor-pointer px-5 py-4 text-sm font-semibold">Scope changes and decisions</summary>
      <ChangeRegisterPanel eventId={selectedEvent.id} frozen={isScopeFrozen(selectedEvent.freezeStatus)} />
    </details>
    </div>
  );
}

export function EventWorkspaceSuppliersTab() {
  const vm = useEventDashboardLoadedRouteViewModel();
  if (!vm.selectedEvent) return null;
  return (
    <div className="space-y-5">
      <details name="pmcm-supplier-work" className="rounded-lg border border-border bg-card">
      <summary className="cursor-pointer px-5 py-4 text-sm font-semibold">Requests and quotes</summary>
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Truck className="size-4 text-primary" />
            <h2 className="text-sm font-bold text-foreground">Supplier desk</h2>
          </div>
        </CardHeader>
        <CardBody>
          <SupplierQuotePlanner
            key={vm.selectedEvent.id}
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
        </CardBody>
      </Card>
      </details>
      <details name="pmcm-supplier-work" className="rounded-lg border border-border bg-card">
      <summary className="cursor-pointer px-5 py-4 text-sm font-semibold">Readiness</summary>
      <PmcmSupplierReadinessBoard eventId={vm.selectedEvent.id} refreshKey={supplierReadinessRefreshKey(vm.quoteRequests)} />
      </details>
      <details name="pmcm-supplier-work" className="rounded-lg border border-border bg-card">
      <summary className="cursor-pointer px-5 py-4 text-sm font-semibold">Bookings and contracts</summary>
      <PmcmSupplierWorkflowsPanel eventId={vm.selectedEvent.id} requests={vm.quoteRequests} quotes={vm.quotes} />
      </details>
      <details name="pmcm-supplier-work" className="rounded-lg border border-border bg-card">
      <summary className="cursor-pointer px-5 py-4 text-sm font-semibold">Emergency response</summary>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <span className="grid size-5 place-items-center rounded bg-primary text-white">
                <svg viewBox="0 0 16 16" fill="none" className="size-3" aria-hidden="true">
                  <path d="M8 2l1.5 3 3.5.5-2.5 2.5.5 3.5L8 10l-3 1.5.5-3.5L3 5.5l3.5-.5L8 2z" fill="currentColor"/>
                </svg>
              </span>
              <h2 className="text-sm font-bold text-foreground">PARE · Emergency Response Engine</h2>
            </div>
            <span className="rounded-full border border-border bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
              FR-AI-04
            </span>
          </div>
        </CardHeader>
        <CardBody>
          <PAREPanel
            eventId={vm.selectedEvent.id}
            assignedRequests={vm.quoteRequests.filter((r) => r.assignmentStatus === "confirmed")}
            suppliers={vm.suppliers}
            onWithdraw={vm.withdrawSupplier}
            busy={Boolean(vm.busy)}
          />
        </CardBody>
      </Card>
      </details>
    </div>
  );
}

export function EventWorkspaceCoordinatorsTab() {
  const vm = useEventDashboardLoadedRouteViewModel();
  if (!vm.selectedEvent) return null;
  return (
    <div className="space-y-5">
      <div id="coordinator-assignment-desk">
        <CoordinatorAssignmentDesk
          event={vm.selectedEvent}
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
      <details className="rounded-lg border border-border bg-card">
        <summary className="cursor-pointer px-5 py-4 text-sm font-semibold">Postponement impact</summary>
        <PostponementImpactPanel eventId={vm.selectedEvent.id} />
      </details>
    </div>
  );
}

export function EventWorkspaceLiveOpsTab() {
  const vm = useEventDashboardLoadedRouteViewModel();
  if (!vm.selectedEvent) return null;
  return (
    <div className="space-y-5">
    <HandoffBriefPanel eventId={vm.selectedEvent.id} />
      <LiveOperationsWorkspace
        event={vm.selectedEvent}
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
    </div>
  );
}

export function EventWorkspaceBillingTab() {
  const vm = useEventDashboardLoadedRouteViewModel();
  if (!vm.selectedEvent) return null;
  return (
    <div className="space-y-5">
      <BillingSourcePanel
        key={vm.selectedEvent.id}
        eventName={vm.selectedEvent.eventName}
        billingSources={vm.billingSources}
        proposalDocuments={vm.documents.filter((document) => document.eventId === vm.selectedEvent!.id && /proposal/i.test(document.type))}
        busy={Boolean(vm.busy)}
        onCreate={vm.createBillingSource}
        onApprove={vm.approveBillingSource}
        onGenerate={vm.generateBillingStatement}
      />
      <FinancialWorkspace
        event={vm.selectedEvent}
        inquiry={vm.selectedInquiry}
        billingStatements={vm.billingStatements}
        payments={vm.payments}
        notificationLogs={vm.notificationLogs}
        busy={Boolean(vm.busy)}
        onRecordPayment={vm.recordPayment}
        onSendBilling={vm.sendBillingStatement}
        onMarkPayment={vm.markPayment}
      />
      <details className="rounded-lg border border-border bg-card">
      <summary className="cursor-pointer px-5 py-4 text-sm font-semibold">Billing adjustments and disputes</summary>
      <BillingAdjustmentsPanel
        eventId={vm.selectedEvent.id}
        statements={vm.billingStatements}
        billingSources={vm.billingSources}
        payments={vm.payments}
      />
      </details>
    </div>
  );
}

export function EventWorkspaceClosureTab() {
  const vm = useEventDashboardLoadedRouteViewModel();
  if (!vm.selectedEvent) return null;
  return (
    <>
      <Phase4Workspace
        event={vm.selectedEvent}
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
      <PostEventDeliverablesPanel eventId={vm.selectedEvent.id} documents={vm.postEventDocuments} archived={vm.selectedEvent.archived} />
      <details className="rounded-lg border border-border bg-card">
        <summary className="cursor-pointer px-5 py-4 text-sm font-semibold">Guest feedback review</summary>
        <FeedbackModerationPanel eventId={vm.selectedEvent.id} />
      </details>
    </>
  );
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

export function EventWorkspaceRegistrationTab() {
  const vm = useEventDashboardLoadedRouteViewModel();
  if (!vm.selectedEvent) return null;
  return (
    <div className="space-y-4">
    <Button variant="outline" onClick={() => vm.navigateEventTab("games")}>Games</Button>
    <EventRegistrationTab
      platform={vm.registrationPlatform}
      suppliers={vm.suppliers}
      busy={Boolean(vm.busy)}
      loadError={vm.commandDataErrors.registrationPlatform}
      onUpsert={vm.upsertRegistrationPlatform}
      onUpdate={vm.updateRegistrationPlatform}
      onImportHeadcount={vm.importHeadcount}
      eventId={vm.selectedEvent.id}
      onSearchRoster={vm.searchGuestRoster}
      onImportRoster={vm.importGuestRoster}
      onCheckInRoster={vm.checkInGuestRoster}
      onVerifyRoster={vm.verifyGuestRoster}
      walkInPolicy={vm.selectedEvent.walkInPolicy ?? "closed"}
      walkInThreshold={vm.selectedEvent.walkInThreshold ?? 200}
      onUpdateWalkInPolicy={vm.updateWalkInPolicy}
      guestPrivacyClassification={vm.guestPrivacyClassification?.classification ?? "unclassified"}
      onUpdateGuestPrivacyClassification={vm.updateGuestPrivacyClassification}
    />
    </div>
  );
}


export function EventWorkspaceGamesTab() {
  const vm = useEventDashboardLoadedRouteViewModel();
  if (!vm.selectedEvent) return null;
  return (
    <div className="space-y-4">
    <Button variant="outline" onClick={() => vm.navigateEventTab("registration")}>Registration</Button>
    <EventGamesHostView
      eventId={vm.selectedEvent.id}
      role={vm.session.role}
      eventStatus={vm.selectedEvent.status}
      archived={vm.selectedEvent.archived}
      actualEndedAt={vm.selectedEvent.actualEndedAt}
    />
    </div>
  );
}
