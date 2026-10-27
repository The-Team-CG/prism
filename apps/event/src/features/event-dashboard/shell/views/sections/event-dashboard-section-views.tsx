"use client";

import { Card, CardHeader } from "./shell-ui";
import { FileRequirementsMatrixPanel } from "@/features/files/matrix";
import { PmcmDocumentHubView } from "@/features/files/hub";
import { EventFileHub } from "./event-file-hub";
import { EventCalendarWorkspace } from "./event-calendar-workspace";
import { EventTasksWorkspace } from "./event-tasks-workspace";
import { isPmcmAdmin } from "@/app/lib/role-guards";
import { EventSettingsWorkspace } from "./event-settings-workspace";
import { CommandHomeSelectedEvent } from "./command-home-selected-event";
import { EventRegister } from "./event-register";
import { InquiryViews } from "./inquiry-views";
import { ClientDirectory, ClientDossier } from "./client-directory";
import { humanizeToken } from "@/features/pmcm-kit/model/formatters";
import {
  FileText,
  MessageSquareText,
  ReceiptText,
  ShieldCheck,
  UsersRound,
} from "lucide-react";
import { Button } from "@/app/components/ui/button";
import { StatusBadge } from "@/app/components/ui/status-badge";
import { EmptyState } from "@/app/components/ui/empty-state";
import { ClientOnboardingTracker } from "@/features/clients/onboarding";
import { InquiryIntakeLog } from "@/features/inquiries/intake";
import { ConformeDraftReviewView } from "@/features/inquiries/conforme-drafts";
import { EventArchiveSearchView } from "@/features/closure/archive";
import { CoordinatorAssignmentDesk } from "@/features/coordinators/desk";
import { EventCommandInbox } from "@/features/command-inbox/list";
import { FinancialWorkspace } from "@/features/finance/workspace";
import { LiveOperationsWorkspace } from "@/features/live-ops/workspace";
import { SupplierDirectory, SupplierQuotePlanner } from "@/features/suppliers/directory";
import { SupplierApplicationsInboxView } from "@/features/suppliers/applications";
import { AuditTrailPanel } from "@/features/audit/trail";
import { PrivacyConsoleView } from "@/features/privacy/console";
import { EventMessagesWorkspace } from "@/features/event-dashboard/messages/views/event-messages-workspace";
import { useEventDashboardLoadedRouteViewModel, useEventDashboardRouteViewModel, useEventDashboardScopedRouteViewModel } from "../event-dashboard-route-context";

const phpMoney = new Intl.NumberFormat("en-PH", { style: "currency", currency: "PHP", maximumFractionDigits: 0 });
export function EventDashboardCalendarSectionView() {
  const {
    events,
    selectedEvent,
    navigateEvent,
  } = useEventDashboardLoadedRouteViewModel();
  return (

          <EventCalendarWorkspace
            events={events}
            selectedEventId={selectedEvent?.id}
            onOpenEvent={(eventId) => navigateEvent(eventId, "overview")}
          />
  );
}

export function EventDashboardTasksSectionView() {
  const {
    unreviewedInquiries,
    pendingApprovals,
    selectedEvent,
    selectedEventWorkspace,
    session,
    busy,
    scheduleOcularVisit,
    completeOcularVisit,
    waiveOcularVisit,
    defenseReadiness,
    commandInbox,
    drafts,
    quotes,
    payments,
    openCheckCount,
    navigateSection,
    navigateEventTab,
  } = useEventDashboardLoadedRouteViewModel();
  return (

          <EventTasksWorkspace
            unreviewedInquiries={unreviewedInquiries}
            pendingApprovals={pendingApprovals}
            selectedEvent={selectedEvent}
            ocularVisit={selectedEventWorkspace?.event.id === selectedEvent?.id
              ? selectedEventWorkspace?.ocularVisit ?? null
              : null}
            isAdmin={isPmcmAdmin(session.role)}
            busy={busy !== null}
            onScheduleOcularVisit={scheduleOcularVisit}
            onCompleteOcularVisit={completeOcularVisit}
            onWaiveOcularVisit={waiveOcularVisit}
            defenseReadiness={defenseReadiness}
            commandInbox={commandInbox}
            draftsCount={drafts.length}
            quoteCount={quotes.length}
            paymentCount={payments.length}
            openCheckCount={openCheckCount}
            onNavigateSection={navigateSection}
            onNavigateEventTab={(nextTab) => navigateEventTab(nextTab)}
          />
  );
}

export function EventDashboardCommandInboxSectionView() {
  const {
    commandInbox,
    refreshCommandInbox,
    changeCommandInboxPage,
    commandInboxLoadFailed,
  } = useEventDashboardScopedRouteViewModel();
  return (

          <EventCommandInbox
            inbox={commandInbox}
            onRefresh={() => refreshCommandInbox().catch(() => undefined)}
            onPageChange={(page) => changeCommandInboxPage(page).catch(() => undefined)}
            loadFailed={commandInboxLoadFailed}
          />
  );
}

export function EventDashboardSettingsSectionView() {
  const {
    session,
    selectedEvent,
    toggleClientEventDayView,
  } = useEventDashboardLoadedRouteViewModel();
  return (
    <EventSettingsWorkspace
      session={session}
      selectedEvent={selectedEvent}
      onToggleClientEventDayView={toggleClientEventDayView}
    />
  );
}

export function EventDashboardClientsSectionView() {
  const { selectedClient, state, clientRecordsForView, navigateClient, navigateSection, navigateEvent } =
    useEventDashboardLoadedRouteViewModel();
  if (selectedClient) {
    const eventIds = new Set(selectedClient.events.map((event) => event.id));
    const balance = state.paymentMilestones
      .filter((payment) => eventIds.has(payment.eventId))
      .reduce((sum, payment) => sum + payment.remainingBalance, 0);
    return (
      <ClientDossier
        client={selectedClient}
        balance={phpMoney.format(balance)}
        onBack={() => navigateSection("clients")}
        onOpenEvent={(id) => navigateEvent(id, "overview")}
      />
    );
  }
  return <ClientDirectory clients={clientRecordsForView} onOpenClient={navigateClient} />;
}

export function EventDashboardTeamSectionView() {
  const {
    selectedEvent,
    coordinators,
    state,
    coordinatorRoleRequirements,
    busy,
    assignCoordinator,
    loadCoordinatorSuggestions,
    saveCoordinatorCoverage,
    sendCoordinatorAcknowledgementReminders,
    designateEventDayOperator,
    loadEventDayOperator,
    loadCoordinatorAvailability,
    loadCoordinatorReliabilityHistory,
    createCoordinatorAvailability,
    deleteCoordinatorAvailability,
  } = useEventDashboardLoadedRouteViewModel();
  return (

          selectedEvent ? (
            <CoordinatorAssignmentDesk
              event={selectedEvent}
              coordinators={coordinators}
              assignments={state.coordinatorAssignments}
              roleRequirements={coordinatorRoleRequirements}
              busy={Boolean(busy)}
              onAssign={assignCoordinator}
              onLoadSuggestions={loadCoordinatorSuggestions}
              onSaveCoverage={saveCoordinatorCoverage}
              onSendReminders={sendCoordinatorAcknowledgementReminders}
              onDesignateOperator={designateEventDayOperator}
              onLoadOperator={loadEventDayOperator}
              onLoadAvailability={loadCoordinatorAvailability}
              onLoadReliabilityHistory={loadCoordinatorReliabilityHistory}
              onCreateAvailability={createCoordinatorAvailability}
              onDeleteAvailability={deleteCoordinatorAvailability}
            />
          ) : (
            <Card>
              <CardHeader>
                <div className="flex items-center gap-2">
                  <UsersRound className="size-4 text-primary" />
                  <h2 className="text-sm font-bold text-foreground">Coordinator roster</h2>
                </div>
              </CardHeader>
              <div className="divide-y divide-border">
                {coordinators.map((coordinator) => (
                  <div key={coordinator.id} className="flex items-start justify-between gap-4 px-6 py-4">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-bold text-foreground">{coordinator.name}</p>
                      <p className="mt-1 text-xs text-muted-foreground">{coordinator.roleTags.join(", ") || "General coordinator"}</p>
                      {coordinator.skillsTags.length > 0 && (
                        <p className="mt-0.5 text-xs text-muted-foreground/70">{coordinator.skillsTags.join(", ")}</p>
                      )}
                    </div>
                    <StatusBadge status={coordinator.active ? "active" : "inactive"} />
                  </div>
                ))}
              </div>
            </Card>
          )
  );
}

export function EventDashboardFilesSectionView() {
  const {
    selectedEvent,
    documents,
    drafts,
    billingStatements,
    quoteRequests,
    briefing,
    checks,
    postEventDocuments,
    navigateEventTab,
  } = useEventDashboardLoadedRouteViewModel();
  return (

          selectedEvent ? (
            <div className="space-y-5">
              <FileRequirementsMatrixPanel eventId={selectedEvent.id} />
              <PmcmDocumentHubView eventId={selectedEvent.id} />
              <EventFileHub
                event={selectedEvent}
                documents={documents}
                drafts={drafts}
                billingStatements={billingStatements}
                quoteRequests={quoteRequests}
                briefing={briefing}
                checks={checks}
                postEventDocuments={postEventDocuments}
                onOpenFloorplans={() => navigateEventTab("floorplans")}
                onOpenBriefing={() => navigateEventTab("briefing")}
                onOpenSuppliers={() => navigateEventTab("suppliers")}
                onOpenBilling={() => navigateEventTab("billing")}
                onOpenClosure={() => navigateEventTab("closure")}
              />
            </div>
          ) : (
            <EmptyState icon={FileText} title="Select an event" description="Files are organized by event workspace after conforme activation." />
          )
  );
}

export function EventDashboardMessagesSectionView() {
  const {
    selectedEvent,
    session,
  } = useEventDashboardLoadedRouteViewModel();
  return (

          selectedEvent ? (
            <EventMessagesWorkspace
              event={selectedEvent}
              session={session}
            />
          ) : (
            <EmptyState icon={MessageSquareText} title="Select an event" description="Client, supplier, coordinator, and internal threads are event-scoped." />
          )
  );
}

export function EventDashboardFinanceSectionView() {
  const {
    selectedEvent,
    selectedInquiry,
    billingStatements,
    payments,
    notificationLogs,
    busy,
    recordPayment,
    sendBillingStatement,
  } = useEventDashboardLoadedRouteViewModel();
  return (

          selectedEvent ? (
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
          ) : (
            <EmptyState icon={ReceiptText} title="Select an event" description="Finance opens inside a confirmed event so billing can stay tied to proposal and conforme records." />
          )
  );
}

export function EventDashboardSuppliersSectionView() {
  const viewModel = useEventDashboardRouteViewModel();
  return <SupplierDirectory
    view={viewModel.routeState.view ?? "all"}
    session={viewModel.session}
    onOpenEvent={(eventId) => viewModel.navigateEvent(eventId, "suppliers")}
  />;
}

export function EventDashboardAuditSectionView() {
  const {
  } = useEventDashboardLoadedRouteViewModel();
  return (

          <AuditTrailPanel />
  );
}

export function EventDashboardPrivacySectionView() {
  return <PrivacyConsoleView />;
}

export function EventDashboardInquiriesSectionView() {
  const {
    state,
    acceptInquiry,
    pendInquiry,
    declineInquiry,
    mergeInquiry,
    logInquiryOnBehalf,
    busy,
    openConformeUpload,
    sendConformeReminder,
  } = useEventDashboardLoadedRouteViewModel();
  return (
    <InquiryViews
      intake={
        <InquiryIntakeLog
          inquiries={state.inquiries}
          onAccept={acceptInquiry}
          onPend={pendInquiry}
          onDecline={declineInquiry}
          onMerge={mergeInquiry}
          onLogOnBehalf={logInquiryOnBehalf}
          busy={Boolean(busy)}
        />
      }
      onboarding={
        <ClientOnboardingTracker
          inquiries={state.inquiries}
          onUploadConforme={openConformeUpload}
          onSendReminder={sendConformeReminder}
          busy={Boolean(busy)}
        />
      }
      followUp={<ConformeDraftReviewView inquiries={state.inquiries} />}
    />
  );
}

export function EventDashboardEventsListSectionView() {
  const { eventsForView, navigateEvent } = useEventDashboardLoadedRouteViewModel();
  return (
    <div className="grid gap-8">
      <EventRegister events={eventsForView} onOpenEvent={(id) => navigateEvent(id, "overview")} />
      <EventArchiveSearchView />
    </div>
  );
}

export function EventDashboardHomeSectionView() {
  const {
    selectedEvent,
    drafts,
    activeDraft,
    quoteRequests,
    quotes,
    openCheckCount,
    pendingApprovals,
    navigateEvent,
    navigateSection,
    busy,
    approveApprovalRequest,
    declineApprovalRequest,
  } = useEventDashboardScopedRouteViewModel();
  return (

          <>
            <EventDashboardCommandInboxSectionView />
            <CommandHomeSelectedEvent
              event={selectedEvent}
              drafts={drafts}
              activeDraft={activeDraft}
              quoteRequestCount={quoteRequests.length}
              quoteCount={quotes.length}
              openCheckCount={openCheckCount}
              onOpenEvent={(eventId) => navigateEvent(eventId, "overview")}
              onBrowseEvents={() => navigateSection("events-list")}
            />

            {/* Pending account approvals */}
            {pendingApprovals.length > 0 && (
              <Card>
                <CardHeader>
                  <div className="flex items-center gap-2">
                    <ShieldCheck className="size-4 text-primary" />
                    <h2 className="text-sm font-bold text-foreground">Account approvals</h2>
                  </div>
                </CardHeader>
                <div className="divide-y divide-border">
                  {pendingApprovals.map((request) => (
                    <div key={request.id} className="flex items-start justify-between gap-4 px-6 py-4">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-bold text-foreground">{request.name}</p>
                        <p className="mt-0.5 text-xs text-muted-foreground">{request.email}</p>
                        <p className="mt-1 text-3xs font-bold uppercase tracking-wider text-attention">
                          {humanizeToken(request.role)} — {request.organization}
                        </p>
                      </div>
                      <div className="flex shrink-0 flex-wrap gap-2">
                        <Button size="sm" disabled={!!busy} onClick={() => approveApprovalRequest(request.id)} className="rounded-lg font-bold">
                          Approve
                        </Button>
                        <Button size="sm" variant="outline" disabled={!!busy} onClick={() => declineApprovalRequest(request.id)} className="rounded-lg font-bold">
                          Decline
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </Card>
            )}
          </>
  );
}
