"use client";

import { FileCheck2, LayoutGrid, MapPinned, Truck } from "lucide-react";
import { Button } from "@/app/components/ui/button";
import { StatusBadge } from "@/app/components/ui/status-badge";
import { EmptyState } from "@/app/components/ui/empty-state";
import { humanizeToken } from "@/features/pmcm-kit/model/formatters";
import { PAREPanel } from "@/features/pare/panel";
import { Phase4Workspace } from "@/features/closure/phase4";
import { CoordinatorAssignmentDesk } from "@/features/coordinators/desk";
import { EventOverviewPanels } from "@/features/command-inbox/list";
import { FinancialWorkspace } from "@/features/finance/workspace";
import { LiveOperationsWorkspace } from "@/features/live-ops/workspace";
import { SupplierQuotePlanner } from "@/features/suppliers/directory";
import { PmcmSupplierReadinessBoard } from "@/features/suppliers/readiness";
import { EventRegistrationTab } from "@/app/components/pmcm/event-registration-tab";
import { EventMessagesWorkspace } from "@/features/event-dashboard/messages/views/event-messages-workspace";
import { FeedbackModerationPanel } from "@/features/feedback/moderation";
import { isPmcmAdmin } from "@/app/lib/role-guards";
import { Card, CardBody, CardHeader } from "./shell-ui";
import { useEventDashboardLoadedRouteViewModel } from "../event-dashboard-route-context";
import type { PrismFloorPlanDraft } from "@prism/types";

export function EventWorkspaceOverviewTab() {
  const vm = useEventDashboardLoadedRouteViewModel();
  if (!vm.selectedEvent) return null;
  return (
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
  );
}

export function EventWorkspaceFloorplansTab() {
  const vm = useEventDashboardLoadedRouteViewModel();
  if (!vm.selectedEvent) return null;
  return (
    <div className="space-y-4">
      <EventFloorplanTemplatePicker />
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <LayoutGrid className="size-4 text-(--prism-signal)" />
            <h2 className="text-sm font-bold text-foreground">Floorplan drafts and client preferences</h2>
          </div>
        </CardHeader>
        <CardBody>
          {vm.drafts.length === 0 ? (
            <EmptyState icon={LayoutGrid} title="No floorplan drafts yet" description="Pick a saved template above to create the first PMCM draft for this event." />
          ) : (
            <div className="space-y-4">
              {vm.drafts.map((draft) => (
                <EventFloorplanDraftCard key={draft.id} draft={draft} />
              ))}
            </div>
          )}
        </CardBody>
      </Card>
    </div>
  );
}

function EventFloorplanTemplatePicker() {
  const { floorPlanTemplates, run, createTemplateDraft } = useEventDashboardLoadedRouteViewModel();
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <MapPinned className="size-4 text-(--prism-signal)" />
          <h2 className="text-sm font-bold text-foreground">Start PMCM draft</h2>
        </div>
      </CardHeader>
      <CardBody>
        {floorPlanTemplates.length ? (
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {floorPlanTemplates.slice(0, 4).map((template) => (
              <button
                key={template.id}
                onClick={() => run("create floorplan", () => createTemplateDraft(template))}
                className="rounded-xl border border-border bg-muted/30 p-4 text-left transition hover:border-(--prism-signal)/40 hover:bg-(--prism-signal-soft)"
              >
                <p className="text-sm font-bold text-foreground">{template.name}</p>
                <p className="mt-1 text-xs leading-5 text-muted-foreground">{template.description || template.venue || "Saved PMCM template"}</p>
              </button>
            ))}
          </div>
        ) : (
          <p className="rounded-xl border border-dashed border-border bg-muted/20 p-4 text-xs text-muted-foreground">
            No saved templates yet. Save reusable layouts from the editor before starting a template-based draft.
          </p>
        )}
      </CardBody>
    </Card>
  );
}

function EventFloorplanDraftCard({ draft }: { draft: PrismFloorPlanDraft }) {
  const { selectedEvent, run, openEditor, submitFloorPlanDraft, approveFloorPlanDraft } = useEventDashboardLoadedRouteViewModel();
  if (!selectedEvent) return null;
  const canSubmit = draft.status !== "in_review" && draft.status !== "approved";
  return (
    <div className="rounded-xl border border-border bg-muted/20 p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-sm font-bold text-foreground">{draft.name}</p>
          <p className="mt-0.5 text-xs text-muted-foreground">{humanizeToken(draft.sourceType)} — {draft.createdByRole ?? "pmcm-admin"}</p>
        </div>
        <StatusBadge status={draft.status} />
      </div>
      {draft.clientPreference ? (
        <div className="mt-3 rounded-lg border border-border bg-card px-3 py-2 text-xs leading-5 text-muted-foreground">
          <p><span className="font-bold text-foreground">Seating:</span> {draft.clientPreference.seatingStyle}</p>
          <p><span className="font-bold text-foreground">Stage:</span> {draft.clientPreference.stagePreference}</p>
        </div>
      ) : null}
      <div className="mt-3 flex flex-wrap gap-2">
        <Button size="sm" variant="outline" className="rounded-lg font-bold" onClick={() => run("open draft", () => openEditor(selectedEvent, draft))}>
          Open / Edit
        </Button>
        {canSubmit ? (
          <Button size="sm" className="rounded-lg font-bold" onClick={() => submitFloorPlanDraft(draft)}>
            Submit
          </Button>
        ) : null}
        {draft.status !== "approved" ? (
          <Button size="sm" variant="outline" className="rounded-lg border-(--prism-success)/25 bg-(--prism-success)/8 font-bold text-(--prism-success) hover:bg-(--prism-success)/15" onClick={() => approveFloorPlanDraft(draft)}>
            Approve
          </Button>
        ) : null}
      </div>
    </div>
  );
}

export function EventWorkspaceBriefingTab() {
  const { briefing } = useEventDashboardLoadedRouteViewModel();
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <FileCheck2 className="size-4 text-(--prism-signal)" />
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
          <EmptyState icon={FileCheck2} title="No briefing submitted yet" description="Use the quick action to submit a sample briefing for this event." />
        )}
      </CardBody>
    </Card>
  );
}

export function EventWorkspaceSuppliersTab() {
  const vm = useEventDashboardLoadedRouteViewModel();
  if (!vm.selectedEvent) return null;
  return (
    <div className="space-y-5">
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Truck className="size-4 text-(--prism-signal)" />
            <h2 className="text-sm font-bold text-foreground">Supplier desk</h2>
          </div>
        </CardHeader>
        <CardBody>
          <SupplierQuotePlanner
            categories={vm.supplierCategories}
            suppliers={vm.suppliers}
            requests={vm.quoteRequests}
            quotes={vm.quotes}
            onRequestQuotes={vm.requestSupplierQuotes}
            onSelectQuote={vm.selectSupplierQuote}
            busy={Boolean(vm.busy)}
          />
        </CardBody>
      </Card>

      <PmcmSupplierReadinessBoard requests={vm.quoteRequests} quotes={vm.quotes} />

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <span className="grid size-5 place-items-center rounded bg-[var(--prism-signal)] text-white">
                <svg viewBox="0 0 16 16" fill="none" className="size-3" aria-hidden="true">
                  <path d="M8 2l1.5 3 3.5.5-2.5 2.5.5 3.5L8 10l-3 1.5.5-3.5L3 5.5l3.5-.5L8 2z" fill="currentColor"/>
                </svg>
              </span>
              <h2 className="text-sm font-bold text-foreground">PARE · Emergency Response Engine</h2>
            </div>
            <span className="rounded-full border border-border bg-muted px-2 py-0.5 text-[10px] font-black uppercase tracking-wide text-muted-foreground">
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
    </div>
  );
}

export function EventWorkspaceCoordinatorsTab() {
  const vm = useEventDashboardLoadedRouteViewModel();
  if (!vm.selectedEvent) return null;
  return (
    <CoordinatorAssignmentDesk
      event={vm.selectedEvent}
      coordinators={vm.coordinators}
      assignments={vm.state.coordinatorAssignments}
      roleRequirements={vm.coordinatorRoleRequirements}
      busy={Boolean(vm.busy)}
      onAssign={vm.assignCoordinator}
      onSaveCoverage={vm.saveCoordinatorCoverage}
      onSendReminders={vm.sendCoordinatorAcknowledgementReminders}
      onDesignateOperator={vm.designateEventDayOperator}
      onLoadAvailability={vm.loadCoordinatorAvailability}
      onCreateAvailability={vm.createCoordinatorAvailability}
      onDeleteAvailability={vm.deleteCoordinatorAvailability}
    />
  );
}

export function EventWorkspaceLiveOpsTab() {
  const vm = useEventDashboardLoadedRouteViewModel();
  if (!vm.selectedEvent) return null;
  return (
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
      onVerifySupplierStatus={vm.verifySupplierStatus}
      onDecideTaskReassignment={vm.decideEventTaskReassignment}
    />
  );
}

export function EventWorkspaceBillingTab() {
  const vm = useEventDashboardLoadedRouteViewModel();
  if (!vm.selectedEvent) return null;
  return (
    <FinancialWorkspace
      event={vm.selectedEvent}
      inquiry={vm.selectedInquiry}
      billingStatements={vm.billingStatements}
      payments={vm.payments}
      notificationLogs={vm.notificationLogs}
      busy={Boolean(vm.busy)}
      onRecordPayment={vm.recordPayment}
      onSendBilling={vm.sendBillingStatement}
    />
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
        reviewerName={vm.session.name}
        canReviewSuppliers={isPmcmAdmin(vm.session.role)}
        busy={Boolean(vm.busy)}
        onCreateRule={vm.createComplianceRule}
        onRunCompliance={vm.runComplianceChecks}
        onResolveCompliance={vm.resolveComplianceCheck}
        onOverrideCompliance={vm.overrideComplianceCheck}
        onCreateBillingSource={vm.createBillingSource}
        onApproveBillingSource={vm.approveBillingSource}
        onGenerateBillingStatement={vm.generateBillingStatement}
        onLoadCloseGates={vm.loadCloseGates}
        onArchive={vm.archiveSelectedEvent}
        onRecordActualEventEnd={vm.recordActualEventEnd}
        onLoadInsights={vm.loadEventInsights}
        onGenerateInsights={vm.generateEventInsights}
        onAddReview={vm.addSupplierReview}
      />
      <FeedbackModerationPanel eventId={vm.selectedEvent.id} />
    </>
  );
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
    />
  );
}
