"use client";

import { Card, CardBody, CardHeader, SectionAccent } from "./shell-ui";
import { FileRequirementsMatrixPanel } from "@/features/files/matrix";
import { EventFileHub } from "./event-file-hub";
import { EventCalendarWorkspace } from "./event-calendar-workspace";
import { EventTasksWorkspace } from "./event-tasks-workspace";
import { EventSettingsWorkspace } from "./event-settings-workspace";
import { CommandHomePage } from "./command-home-page";
import { EventQueueCard } from "./event-queue-card";
import { humanizeToken } from "@/features/pmcm-kit/model/formatters";
import {
  AlertTriangle,
  CalendarDays,
  CircleUserRound,
  FileCheck2,
  FileText,
  LayoutGrid,
  MapPinned,
  MessageSquareText,
  ReceiptText,
  ShieldCheck,
  Truck,
  UsersRound,
} from "lucide-react";
import { Button } from "@/app/components/ui/button";
import { StatusBadge } from "@/app/components/ui/status-badge";
import { EmptyState } from "@/app/components/ui/empty-state";
import { ClientOnboardingTracker } from "@/features/clients/onboarding";
import { InquiryIntakeLog } from "@/features/inquiries/intake";
import { ConformeDraftReviewView } from "@/features/inquiries/conforme-drafts";
import { PAREPanel } from "@/features/pare/panel";
import { Phase4Workspace } from "@/features/closure/phase4";
import { EventArchiveSearchView } from "@/features/closure/archive";
import { CoordinatorAssignmentDesk } from "@/features/coordinators/desk";
import { EventCommandInbox, EventOverviewPanels } from "@/features/command-inbox/list";
import { FinancialWorkspace } from "@/features/finance/workspace";
import { LiveOperationsWorkspace } from "@/features/live-ops/workspace";
import { SupplierDirectory, SupplierQuotePlanner } from "@/features/suppliers/directory";
import { SupplierApplicationsInboxView } from "@/features/suppliers/applications";
import { AuditTrailPanel } from "@/features/audit/trail";
import { EventMessagesWorkspace } from "@/features/event-dashboard/messages/views/event-messages-workspace";
import { useEventDashboardLoadedRouteViewModel } from "../event-dashboard-route-context";

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
  } = useEventDashboardLoadedRouteViewModel();
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
  } = useEventDashboardLoadedRouteViewModel();
  return (

          <EventSettingsWorkspace session={session} selectedEvent={selectedEvent} />
  );
}

export function EventDashboardClientsSectionView() {
  const {
    selectedClient,
    payments,
    activeNavItem,
    clientRecordsForView,
    navigateClient,
    navigateSection,
    routeState,
    navigateEvent,
    state,
    unreviewedInquiries,
    pendingApprovals,
    inquiries,
    acceptInquiry,
    pendInquiry,
    declineInquiry,
    logInquiryOnBehalf,
    busy,
    openConformeUpload,
    sendConformeReminder,
  } = useEventDashboardLoadedRouteViewModel();
  return (

          <>
            <EventArchiveSearchView />
            {selectedClient ? (
              <Card>
                <CardHeader>
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <SectionAccent>Client overview</SectionAccent>
                      <h2 className="mt-1 text-base font-black text-foreground">{selectedClient.name}</h2>
                      <p className="mt-1 text-sm text-muted-foreground">{selectedClient.contact ?? "Primary contact pending"}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button variant="outline" className="h-8 rounded-md px-3 text-xs font-bold" onClick={() => navigateSection("clients")}>
                        All Clients
                      </Button>
                      <StatusBadge status={selectedClient.events.length ? "active" : "prospect"} />
                    </div>
                  </div>
                </CardHeader>
                <CardBody className="grid gap-3 md:grid-cols-4">
                  {[
                    { label: "Active Events", value: selectedClient.events.length },
                    { label: "Open Inquiries", value: selectedClient.inquiries.length },
                    { label: "Balance", value: phpMoney.format(payments.reduce((sum, item) => sum + item.remainingBalance, 0)) },
                    { label: "Last Activity", value: selectedClient.events[0]?.eventDate ?? "Pending" },
                  ].map((item) => (
                    <div key={item.label} className="rounded-md border border-border bg-muted/20 px-4 py-3">
                      <p className="text-lg font-black text-foreground">{item.value}</p>
                      <p className="mt-1 text-xs font-bold text-muted-foreground">{item.label}</p>
                    </div>
                  ))}
                </CardBody>
              </Card>
            ) : (
              <Card>
                <CardHeader>
                  <div className="flex items-center gap-2">
                    <CircleUserRound className="size-4 text-(--prism-signal)" />
                    <h2 className="text-sm font-bold text-foreground">{activeNavItem?.label ?? "All clients"}</h2>
                  </div>
                </CardHeader>
                <div className="divide-y divide-border">
                  {clientRecordsForView.map((client) => (
                    <button key={client.id} type="button" onClick={() => navigateClient(client.id)} className="flex w-full items-center justify-between gap-4 px-6 py-4 text-left transition hover:bg-muted/30">
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-black text-foreground">{client.name}</span>
                        <span className="mt-1 block truncate text-xs text-muted-foreground">{client.contact ?? "Contact pending"} - {client.events.length} event(s)</span>
                      </span>
                      <StatusBadge status={client.events.length ? "active" : "prospect"} />
                    </button>
                  ))}
                  {clientRecordsForView.length === 0 ? (
                    <div className="px-6 py-8">
                      <EmptyState icon={CircleUserRound} title="No clients in this view" description="Client records will appear here once their inquiry and event state matches this filter." />
                    </div>
                  ) : null}
                </div>
              </Card>
            )}
            {selectedClient && (routeState.view ?? "overview") !== "overview" ? (
              <Card>
                <CardHeader>
                  <div className="flex items-center gap-2">
                    <FileText className="size-4 text-(--prism-signal)" />
                    <h2 className="text-sm font-bold text-foreground">{activeNavItem?.label ?? "Client detail"}</h2>
                  </div>
                </CardHeader>
                <CardBody>
                  {routeState.view === "events" ? (
                    <div className="divide-y divide-border overflow-hidden rounded-md border border-border">
                      {selectedClient.events.map((event) => (
                        <button key={event.id} type="button" onClick={() => navigateEvent(event.id, "overview")} className="flex w-full items-center justify-between gap-4 px-4 py-3 text-left transition hover:bg-muted/30">
                          <span className="min-w-0">
                            <span className="block truncate text-sm font-black text-foreground">{event.eventName}</span>
                            <span className="mt-1 block text-xs text-muted-foreground">{event.eventDate}</span>
                          </span>
                          <StatusBadge status={event.status} />
                        </button>
                      ))}
                      {selectedClient.events.length === 0 ? (
                        <div className="px-4 py-6">
                          <EmptyState icon={CalendarDays} title="No events yet" description="Accepted inquiries with signed conforme will create client event workspaces here." />
                        </div>
                      ) : null}
                    </div>
                  ) : (
                    <div className="grid gap-3 md:grid-cols-3">
                      {[
                        { label: "Contact Person", value: selectedClient.contact ?? "Pending" },
                        { label: "Company", value: selectedClient.company ?? selectedClient.name },
                        { label: "Record Scope", value: `${selectedClient.events.length} events / ${selectedClient.inquiries.length} inquiries` },
                      ].map((item) => (
                        <div key={item.label} className="rounded-md border border-border bg-muted/20 px-4 py-3">
                          <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">{item.label}</p>
                          <p className="mt-1 text-sm font-black text-foreground">{item.value}</p>
                        </div>
                      ))}
                    </div>
                  )}
                </CardBody>
              </Card>
            ) : null}
            <Card>
              <CardHeader>
                <div className="flex items-center gap-2">
                  <CircleUserRound className="size-4 text-(--prism-signal)" />
                  <h2 className="text-sm font-bold text-foreground">Client pipeline</h2>
                </div>
              </CardHeader>
              <CardBody className="grid gap-3 sm:grid-cols-3">
                {[
                  { label: "Total inquiries", value: state.inquiries.length, tone: "text-(--prism-signal)" },
                  { label: "Need review", value: unreviewedInquiries, tone: "text-(--prism-amber)" },
                  { label: "Pending accounts", value: pendingApprovals.length, tone: "text-(--prism-success)" },
                ].map((item) => (
                  <div key={item.label} className="rounded-xl border border-border bg-muted/20 px-4 py-3">
                    <p className={`text-2xl font-black ${item.tone}`}>{item.value}</p>
                    <p className="mt-1 text-xs font-bold text-muted-foreground">{item.label}</p>
                  </div>
                ))}
              </CardBody>
            </Card>
            <InquiryIntakeLog
              inquiries={state.inquiries}
              onAccept={acceptInquiry}
              onPend={pendInquiry}
              onDecline={declineInquiry}
              onLogOnBehalf={logInquiryOnBehalf}
              busy={Boolean(busy)}
            />
            <ClientOnboardingTracker
              inquiries={state.inquiries}
               onUploadConforme={openConformeUpload}
              onSendReminder={sendConformeReminder}
              busy={Boolean(busy)}
            />
          </>
  );
}

export function EventDashboardTeamSectionView() {
  const {
    selectedEvent,
    coordinators,
    state,
    coordinatorRoleRequirements,
    busy,
    assignCoordinator,
    saveCoordinatorCoverage,
    sendCoordinatorAcknowledgementReminders,
    designateEventDayOperator,
    loadEventDayOperator,
    loadCoordinatorAvailability,
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
              onSaveCoverage={saveCoordinatorCoverage}
              onSendReminders={sendCoordinatorAcknowledgementReminders}
              onDesignateOperator={designateEventDayOperator}
              onLoadOperator={loadEventDayOperator}
              onLoadAvailability={loadCoordinatorAvailability}
              onCreateAvailability={createCoordinatorAvailability}
              onDeleteAvailability={deleteCoordinatorAvailability}
            />
          ) : (
            <Card>
              <CardHeader>
                <div className="flex items-center gap-2">
                  <UsersRound className="size-4 text-(--prism-signal)" />
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
  const {
    supplierCategories,
    suppliers,
    selectedEvent,
    session,
    toggleSupplierBni,
    createSupplier,
    updateSupplierProfile,
    changeSupplierTier,
    promoteSupplier,
    addSupplierReview,
    addSupplierCertification,
    navigateEvent,
    busy,
  } = useEventDashboardLoadedRouteViewModel();
  return (
    <div className="space-y-5">
      <SupplierApplicationsInboxView />
      <SupplierDirectory
        categories={supplierCategories}
        suppliers={suppliers}
        onToggleBni={toggleSupplierBni}
        onCreateSupplier={createSupplier}
        onUpdateSupplier={updateSupplierProfile}
        onChangeTier={changeSupplierTier}
        eventId={selectedEvent?.id}
        onPromote={promoteSupplier}
        onAddReview={addSupplierReview}
        onAddCertification={addSupplierCertification}
        onOpenEvent={(eventId) => navigateEvent(eventId, "overview")}
        busy={Boolean(busy)}
      />
    </div>
  );
}

export function EventDashboardAuditSectionView() {
  const {
  } = useEventDashboardLoadedRouteViewModel();
  return (

          <AuditTrailPanel />
  );
}

export function EventDashboardInquiriesSectionView() {
  const {
    state,
    acceptInquiry,
    pendInquiry,
    declineInquiry,
    logInquiryOnBehalf,
    busy,
    openConformeUpload,
    sendConformeReminder,
  } = useEventDashboardLoadedRouteViewModel();
  return (

          <>
            <InquiryIntakeLog
              inquiries={state.inquiries}
              onAccept={acceptInquiry}
              onPend={pendInquiry}
              onDecline={declineInquiry}
              onLogOnBehalf={logInquiryOnBehalf}
              busy={Boolean(busy)}
            />
            <ClientOnboardingTracker
              inquiries={state.inquiries}
              onUploadConforme={openConformeUpload}
              onSendReminder={sendConformeReminder}
              busy={Boolean(busy)}
            />
            <ConformeDraftReviewView inquiries={state.inquiries} />
          </>
  );
}

export function EventDashboardEventsListSectionView() {
  const {
    eventsForView,
    selectedEvent,
    navigateEvent,
  } = useEventDashboardLoadedRouteViewModel();
  return (

          <EventQueueCard
            events={eventsForView}
            selectedEventId={selectedEvent?.id}
            onSelectEvent={(id) => navigateEvent(id)}
            onNavigateEvent={(id) => navigateEvent(id, "overview")}
          />
  );
}

export function EventDashboardHomeSectionView() {
  const {
    session,
    commandInbox,
    pendingApprovals,
    navigateSection,
    busy,
    approveApprovalRequest,
    declineApprovalRequest,
  } = useEventDashboardLoadedRouteViewModel();
  return (

          <>
            <EventDashboardCommandInboxSectionView />
            <CommandHomePage
              session={session}
              summary={commandInbox?.summary ?? { activeEvents: 0, pendingInquiries: 0, pendingApprovals: 0 }}
              onNavigateSection={navigateSection}
            />

            {/* Pending account approvals */}
            {pendingApprovals.length > 0 && (
              <Card>
                <CardHeader>
                  <div className="flex items-center gap-2">
                    <ShieldCheck className="size-4 text-(--prism-signal)" />
                    <h2 className="text-sm font-bold text-foreground">Account approvals</h2>
                  </div>
                </CardHeader>
                <div className="divide-y divide-border">
                  {pendingApprovals.map((request) => (
                    <div key={request.id} className="flex items-start justify-between gap-4 px-6 py-4">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-bold text-foreground">{request.name}</p>
                        <p className="mt-0.5 text-xs text-muted-foreground">{request.email}</p>
                        <p className="mt-1 text-[10px] font-bold uppercase tracking-wider text-(--prism-amber)">
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
