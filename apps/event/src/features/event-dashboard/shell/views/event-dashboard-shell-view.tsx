"use client";



import { Card, CardBody, CardHeader, SectionAccent } from "./sections/shell-ui";
import { EventFileHub } from "./sections/event-file-hub";
import { EventCalendarWorkspace } from "./sections/event-calendar-workspace";
import { EventTasksWorkspace } from "./sections/event-tasks-workspace";
import { EventSettingsWorkspace } from "./sections/event-settings-workspace";
import { CommandHomePage } from "./sections/command-home-page";
import { EventQueueCard } from "./sections/event-queue-card";

import { humanizeToken } from "@/features/event-ops";
import dynamic from "next/dynamic";
import {
  AlertTriangle,
  Archive,
  CalendarClock,
  CalendarDays,
  CheckCircle2,
  ClipboardCheck,
  CircleUserRound,
  Download,
  Eye,
  FileCheck2,
  FileSignature,
  FileText,
  Grid2X2,
  Home,
  Inbox,
  LayoutGrid,
  List,
  MapPinned,
  MessageSquareText,
  MoreHorizontal,
  Pencil,
  Radio,
  ReceiptText,
  RotateCcw,
  Search,
  Settings,
  ShieldCheck,
  Share2,
  Tags,
  Truck,
  Upload,
  UsersRound,
  type LucideIcon,
  } from "lucide-react";
import { PrismDashboardShell } from "@prism/ui";
import { Alert, AlertDescription } from "@/app/components/ui/alert";
import { Button } from "@/app/components/ui/button";
import { StatusBadge } from "@/app/components/ui/status-badge";
import { EmptyState } from "@/app/components/ui/empty-state";
import { Badge } from "@/app/components/ui/badge";
import { ClientOnboardingTracker } from "@/features/clients/onboarding";
import { ConformeUploadModal } from "@/features/conforme/upload";
import { InquiryIntakeLog } from "@/features/inquiries/intake";
import { PAREPanel } from "@/features/pare/panel";
import { Phase4Workspace } from "@/features/closure/phase4";
import { CoordinatorAssignmentDesk, CoordinatorView } from "@/features/coordinators/desk";
import { EventCommandInbox, EventOverviewPanels } from "@/features/command-inbox/list";
import { FinancialWorkspace } from "@/features/finance/workspace";
import { LiveOperationsWorkspace } from "@/features/live-ops/workspace";
import { SupplierDirectory, SupplierQuotePlanner } from "@/features/suppliers/directory";
import {
  EventDashboardSessionSkeleton,
  EventDashboardSkeleton,
  SkeletonCard,
  SkeletonLine,
  eventDashboardSkeletonVariant,
} from "@/app/(portal)/dashboard/components/event-dashboard-skeleton";
import { type EventSession } from "@/app/lib/session";
import { isPmcmAdmin } from "@/app/lib/role-guards";
import { EventMessagesWorkspace } from "@/app/(portal)/dashboard/components/event-messages-workspace";
import type { EventDashboardClientProps } from "../model/event-dashboard-routing";
import { useEventDashboardShellViewModel } from "../view-models/use-event-dashboard-shell-view-model";

export type { EventDashboardClientProps };

const EditorShell = dynamic(
  () => import("@/features/floorplan/editor").then((mod) => mod.EditorShell),
  {
    ssr: false,
    loading: () => (
      <div className="grid size-full place-items-center bg-background text-sm text-muted-foreground">
        Loading PMCM editor...
      </div>
    ),
  },
);

const phpMoney = new Intl.NumberFormat("en-PH", { style: "currency", currency: "PHP", maximumFractionDigits: 0 });

export function EventDashboardShellView(props: EventDashboardClientProps = {}) {
  const {
    routeState,
    session,
    state,
    coordinatorState,
    screen,
    error,
    selectedEventId,
    selectedClientId,
    section,
    tab,
    sidebarActiveOverride,
    approvalRequests,
    liveOps,
    statusFeed,
    defenseReadiness,
    busy,
    floorPlanTemplates,
    commandInbox,
    conformeUploadTarget,
    commandInboxLoadFailed,
    events,
    selectedEvent,
    supplierCategories,
    suppliers,
    coordinators,
    coordinatorRoleRequirements,
    inquiries,
    unreviewedInquiries,
    complianceRules,
    activeDraft,
    assignments,
    audit,
    billingSources,
    billingStatements,
    briefing,
    checks,
    documents,
    drafts,
    eventInsights,
    notificationLogs,
    payments,
    postEventDocuments,
    quoteRequests,
    quotes,
    selectedInquiry,
    pendingApprovals,
    clientRecords,
    selectedClient,
    clientListView,
    clientRecordsForView,
    eventListView,
    eventsForView,
    openCheckCount,
    openActionCount,
    eventWorkspaceDisabled,
    activeSidebarItemId,
    shellNavItems,
    activeNavItem,
    isHome,
    isCommandInbox,
    isEventsList,
    isInquiries,
    isClients,
    isCalendar,
    isTasks,
    isTeam,
    isFiles,
    isMessages,
    isFinance,
    isSettings,
    refresh,
    refreshApprovals,
    loadLiveOps,
    run,
    runLiveOps,
    createTemplateDraft,
    openEditor,
    navigateEvent,
    navigateClient,
    navigateEventTab,
    navigateSection,
    handleSidebarNav,
    signOut,
    uploadConforme,
    saveEditorPlan,
    submitEditorPlan,
    closeEditor,
    refreshCommandInbox,
    resetDashboard,
    approveApprovalRequest,
    declineApprovalRequest,
    submitBriefing,
    runPlanningCompliance,
    submitFloorPlanDraft,
    approveFloorPlanDraft,
    withdrawSupplier,
    uploadConformeTarget,
    openConformeUpload,
    closeConformeUpload,
    loadingShellCopy,
    loadingShellNavItems,
    acceptInquiry,
    pendInquiry,
    declineInquiry,
    logInquiryOnBehalf,
    sendConformeReminder,
    toggleSupplierBni,
    createSupplier,
    updateSupplierProfile,
    changeSupplierTier,
    addSupplierReview,
    addSupplierCertification,
    requestSupplierQuotes,
    selectSupplierQuote,
    recordPayment,
    sendBillingStatement,
    createComplianceRule,
    runComplianceChecks,
    resolveComplianceCheck,
    overrideComplianceCheck,
    createBillingSource,
    approveBillingSource,
    generateBillingStatement,
    loadCloseGates,
    archiveSelectedEvent,
    loadEventInsights,
    generateEventInsights,
    assignCoordinator,
    createEventDayTask,
    updateEventDayTask,
    escalateEventDayTask,
    createUrgentIssue,
    updateUrgentIssue,
    escalateUrgentIssue,
    updateCoordinatorAttendance,
    replaceCoordinator,
    verifySupplierStatus,
    createTemplateDraftAction,
    openDraft,
  } = useEventDashboardShellViewModel(props);
  /* Loading */
  if (!session) {
    return <EventDashboardSessionSkeleton />;
  }

  /* Wrong role */
  if (session.role !== "pmcm-admin" && session.role !== "coordinator") {
    return (
      <main className="grid min-h-screen place-items-center bg-background px-6">
        <section className="w-full max-w-md rounded-2xl border border-border bg-card p-8 shadow-sm">
          <ShieldCheck className="size-12 rounded-xl bg-amber-50 p-2.5 text-amber-600" />
          <h1 className="mt-5 text-xl font-bold text-foreground">Wrong portal for this account.</h1>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            {session.role === "client"
              ? "Client accounts belong in the client portal at http://localhost:3001."
              : "Supplier accounts belong in the supplier portal at http://localhost:3002."}
          </p>
          <Button className="mt-5 rounded-lg font-bold" onClick={signOut}>
            Use event team sign-in
          </Button>
        </section>
      </main>
    );
  }

  /* Editor fullscreen */
  if (screen.name === "editor") {
    return (
      <div className="h-screen w-full overflow-hidden">
        <EditorShell
          project={screen.project}
          eventName={screen.event.eventName}
          draftName={screen.draft.name}
          draftStatus={screen.draft.status}
          readOnly={!isPmcmAdmin(session.role)}
          onSave={saveEditorPlan}
          onSubmit={submitEditorPlan}
          onBack={closeEditor}
        />
      </div>
    );
  }

  /* Coordinator view */
  if (session.role === "coordinator") {
    if (!coordinatorState) {
      return (
        <main className="grid min-h-screen place-items-center bg-background px-6">
          {error ? (
            <Alert variant="destructive" className="max-w-md rounded-xl"><AlertDescription>{error}</AlertDescription></Alert>
          ) : (
            <div className="w-full max-w-5xl">
              <SkeletonCard>
                <div className="flex items-center gap-3">
                  <SkeletonLine className="size-10 rounded-md" />
                  <div>
                    <SkeletonLine className="h-4 w-44 rounded-md" />
                    <SkeletonLine className="mt-2 h-3 w-64 rounded-md" />
                  </div>
                </div>
              </SkeletonCard>
              <div className="mt-5">
                <EventDashboardSkeleton variant="coordinator" />
              </div>
            </div>
          )}
        </main>
      );
    }
    return (
      <CoordinatorView session={session} state={coordinatorState} onRefresh={() => refresh(session)} onSignOut={signOut} />
    );
  }

  /* PMCM loading */
  if (!state) {
    const loadingVariant = eventDashboardSkeletonVariant(routeState);
    return (
      <PrismDashboardShell
        productLabel="P.R.I.S.M"
        roleLabel="PMCM Event Command"
        eyebrow={loadingShellCopy.eyebrow}
        title={loadingShellCopy.title}
        description="Loading the PMCM event command data, route context, and workspace queue."
        activeItemId={activeSidebarItemId}
        navItems={loadingShellNavItems}
        sidebarMode="single"
        onNavSelect={handleSidebarNav}
        user={{ name: session.name, detail: humanizeToken(session.role), initials: session.name.slice(0, 2).toUpperCase() }}
        searchPlaceholder="Search events, suppliers, inquiries..."
        showTopBarSearch={false}
        onSignOut={signOut}
      >
        {error ? (
          <Alert variant="destructive" className="max-w-md rounded-xl"><AlertDescription>{error}</AlertDescription></Alert>
        ) : (
          <EventDashboardSkeleton variant={loadingVariant} />
        )}
      </PrismDashboardShell>
    );
  }

  return (
    <PrismDashboardShell
      productLabel="P.R.I.S.M"
      roleLabel="PMCM Event Command"
      eyebrow={
        section === "suppliers" ? "Supplier directory"
        : section === "audit" ? "Audit log"
        : isClients ? "Clients"
        : isCalendar ? "Calendar"
        : isTasks ? "Tasks"
        : isCommandInbox ? "Command inbox"
        : isTeam ? "Team"
        : isFiles ? "Files"
        : isMessages ? "Messages"
        : isFinance ? "Finance"
        : isSettings ? "Settings"
        : isInquiries ? "Inquiries"
        : isEventsList ? "Events"
        : isHome ? "Command home"
        : "Event workspace"
      }
      title={
        section === "suppliers" ? "Supplier Directory"
        : section === "audit" ? "Audit Trail"
        : isClients ? activeNavItem?.label ?? "Client Desk"
        : isCalendar ? activeNavItem?.label ?? "Calendar"
        : isTasks ? activeNavItem?.label ?? "Task Queue"
        : isCommandInbox ? "Command Inbox"
        : isTeam ? "Team & Coordinators"
        : isFiles ? activeNavItem?.label ?? "Event File Hub"
        : isMessages ? activeNavItem?.label ?? "Event Messages"
        : isFinance ? activeNavItem?.label ?? "Finance Desk"
        : isSettings ? activeNavItem?.label ?? "Settings"
        : isInquiries ? "Inquiry Intake"
        : isEventsList ? activeNavItem?.label ?? "All Events"
        : isHome ? activeNavItem?.label ?? "Event Manager"
        : selectedEvent?.eventName ?? "Event Manager"
      }
      description={
        section === "suppliers" ? "Master supplier directory with category tagging, tiering, and performance reviews."
        : section === "audit" ? "Complete audit trail of all actions, approvals, and system events."
        : isClients ? "Client intake, conforme status, approval requests, and portal readiness."
        : isCalendar ? "Event dates, planning windows, supplier deadlines, and onsite schedule checkpoints."
        : isTasks ? "PMCM actions across inquiries, approvals, planning, finance, live operations, and closure."
        : isCommandInbox ? "Prioritized action queue across inquiries, suppliers, billing, coordinators, and closure."
        : isTeam ? "Coordinator roster, assignment coverage, availability, and event-day staffing."
        : isFiles ? "Operational documents, official floorplans, billing statements, contracts, and closeout records."
        : isMessages ? "Client, supplier, coordinator, and internal PMCM communication threads."
        : isFinance ? "Billing statements, payment milestones, balances, and statement delivery."
        : isSettings ? "Workspace preferences, account context, notification defaults, and role-safe system controls."
        : isInquiries ? "Review, accept, pend, or decline incoming event inquiries."
        : isEventsList ? "Confirmed event workspaces ready for planning and operations."
        : isHome ? "Active event workspaces, inquiry intake, and client onboarding."
        : selectedEvent ? `${selectedEvent.clientName} — ${selectedEvent.eventDate}`
        : "Select an event or accept an inquiry to begin."
      }
      activeItemId={sidebarActiveOverride ?? activeSidebarItemId}
      navItems={shellNavItems}
      sidebarMode="single"
      onNavSelect={handleSidebarNav}
      user={{ name: session.name, detail: humanizeToken(session.role), initials: session.name.slice(0, 2).toUpperCase() }}
      searchPlaceholder="Search events, suppliers, inquiries..."
      showTopBarSearch={false}
      onSignOut={signOut}
    >
      <div className="space-y-5">
        {error && (
          <Alert variant="destructive" className="rounded-xl">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {isCalendar ? (
          <EventCalendarWorkspace
            events={events}
            selectedEventId={selectedEvent?.id}
            onOpenEvent={(eventId) => navigateEvent(eventId, "overview")}
          />
        ) : isTasks ? (
          <EventTasksWorkspace
            unreviewedInquiries={unreviewedInquiries}
            pendingApprovals={pendingApprovals}
            selectedEvent={selectedEvent}
            defenseReadiness={defenseReadiness}
            draftsCount={drafts.length}
            quoteCount={quotes.length}
            paymentCount={payments.length}
            openCheckCount={openCheckCount}
            onNavigateSection={navigateSection}
            onNavigateEventTab={(nextTab) => navigateEventTab(nextTab)}
          />
        ) : isCommandInbox ? (
          <EventCommandInbox
            inbox={commandInbox}
            onRefresh={() => refreshCommandInbox().catch(() => undefined)}
            loadFailed={commandInboxLoadFailed}
          />
        ) : isSettings ? (
          <EventSettingsWorkspace session={session} selectedEvent={selectedEvent} />
        ) : isClients ? (
          <>
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
        ) : isTeam ? (
          selectedEvent ? (
            <CoordinatorAssignmentDesk
              event={selectedEvent}
              coordinators={coordinators}
              assignments={state.coordinatorAssignments}
              roleRequirements={coordinatorRoleRequirements}
              busy={Boolean(busy)}
              onAssign={assignCoordinator}
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
        ) : isFiles ? (
          selectedEvent ? (
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
          ) : (
            <EmptyState icon={FileText} title="Select an event" description="Files are organized by event workspace after conforme activation." />
          )
        ) : isMessages ? (
          selectedEvent ? (
            <EventMessagesWorkspace
              event={selectedEvent}
              session={session}
              audit={audit}
              notificationLogs={notificationLogs}
            />
          ) : (
            <EmptyState icon={MessageSquareText} title="Select an event" description="Client, supplier, coordinator, and internal threads are event-scoped." />
          )
        ) : isFinance ? (
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
        ) : section === "suppliers" ? (
          <SupplierDirectory
            categories={supplierCategories}
            suppliers={suppliers}
            session={session}
            onToggleBni={toggleSupplierBni}
            onCreateSupplier={createSupplier}
            onUpdateSupplier={updateSupplierProfile}
            onChangeTier={changeSupplierTier}
            onAddReview={addSupplierReview}
            onAddCertification={addSupplierCertification}
            onOpenEvent={(eventId) => navigateEvent(eventId, "overview")}
            busy={Boolean(busy)}
          />
        ) : section === "audit" ? (
          null
        ) : isInquiries ? (
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
          </>
        ) : isEventsList ? (
          <EventQueueCard
            events={eventsForView}
            selectedEventId={selectedEvent?.id}
            onSelectEvent={(id) => navigateEvent(id)}
            onReset={resetDashboard}
            onNavigateEvent={(id) => navigateEvent(id, "overview")}
          />
        ) : isHome ? (
          <>
            <CommandHomePage
              session={session}
              state={state}
              events={events}
              selectedEvent={selectedEvent}
              unreviewedInquiries={unreviewedInquiries}
              pendingApprovals={pendingApprovals}
              defenseReadiness={defenseReadiness}
              onNavigateSection={navigateSection}
              onNavigateEvent={navigateEvent}
              onReset={resetDashboard}
            />

            {/* Inquiry + onboarding below the command grid */}
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
        ) : (
          /* Event workspace */
          selectedEvent ? (
            <div className="space-y-5">
              {/* Event header */}
              <div className="flex flex-wrap items-start justify-between gap-4 rounded-2xl border border-border bg-card px-6 py-5 shadow-sm">
                <div className="min-w-0">
                  <p className="text-xs font-bold uppercase tracking-widest text-(--prism-signal)">Event workspace</p>
                  <h1 className="mt-1 text-xl font-bold text-foreground">{selectedEvent.eventName}</h1>
                  <p className="mt-1 text-sm text-muted-foreground">{selectedEvent.clientName} — {selectedEvent.eventDate}</p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    <StatusBadge status={selectedEvent.status} />
                    <StatusBadge status={selectedEvent.floorPlanStatus} label={`Floorplan ${humanizeToken(selectedEvent.floorPlanStatus)}`} />
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button size="sm" className="rounded-lg font-bold" onClick={submitBriefing}>
                    Submit briefing
                  </Button>
                  <Button size="sm" variant="outline" className="rounded-lg font-bold" onClick={() => navigateEventTab("suppliers")}>
                    Supplier desk
                  </Button>
                  <Button size="sm" variant="outline" className="rounded-lg font-bold" onClick={() => navigateEventTab("live-ops")}>
                    Live ops
                  </Button>
                </div>
              </div>

              {tab === "overview" && (
                <EventOverviewPanels
                  event={selectedEvent}
                  defenseReadiness={defenseReadiness}
                  drafts={drafts}
                  activeDraft={activeDraft}
                  quoteRequestCount={quoteRequests.length}
                  quoteCount={quotes.length}
                  openCheckCount={openCheckCount}
                  onSubmitBriefing={submitBriefing}
                  onOpenSupplierDesk={() => navigateEventTab("suppliers")}
                  onRunCompliance={runPlanningCompliance}
                  onOpenCoordinatorDesk={() => navigateEventTab("coordinators")}
                  onOpenLiveOps={() => navigateEventTab("live-ops")}
                  onOpenFloorplans={() => navigateEventTab("floorplans")}
                  onOpenBilling={() => navigateEventTab("billing")}
                  onOpenClosure={() => navigateEventTab("closure")}
                />
              )}

              {tab === "floorplans" && (
                <div className="space-y-4">
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
                  <Card>
                    <CardHeader>
                      <div className="flex items-center gap-2">
                        <LayoutGrid className="size-4 text-(--prism-signal)" />
                        <h2 className="text-sm font-bold text-foreground">Floorplan drafts and client preferences</h2>
                      </div>
                    </CardHeader>
                    <CardBody>
                      {drafts.length === 0 ? (
                        <EmptyState icon={LayoutGrid} title="No floorplan drafts yet" description="Pick a saved template above to create the first PMCM draft for this event." />
                      ) : (
                        <div className="space-y-4">
                          {drafts.map((draft) => (
                            <div key={draft.id} className="rounded-xl border border-border bg-muted/20 p-4">
                              <div className="flex items-start justify-between gap-3">
                                <div className="min-w-0">
                                  <p className="truncate text-sm font-bold text-foreground">{draft.name}</p>
                                  <p className="mt-0.5 text-xs text-muted-foreground">{humanizeToken(draft.sourceType)} — {draft.createdByRole ?? "pmcm-admin"}</p>
                                </div>
                                <StatusBadge status={draft.status} />
                              </div>
                              {draft.clientPreference && (
                                <div className="mt-3 rounded-lg border border-border bg-card px-3 py-2 text-xs leading-5 text-muted-foreground">
                                  <p><span className="font-bold text-foreground">Seating:</span> {draft.clientPreference.seatingStyle}</p>
                                  <p><span className="font-bold text-foreground">Stage:</span> {draft.clientPreference.stagePreference}</p>
                                </div>
                              )}
                              <div className="mt-3 flex flex-wrap gap-2">
                                <Button size="sm" variant="outline" className="rounded-lg font-bold" onClick={() => run("open draft", () => openEditor(selectedEvent, draft))}>
                                  Open / Edit
                                </Button>
                                {draft.status !== "in_review" && draft.status !== "approved" && (
                                  <Button size="sm" className="rounded-lg font-bold" onClick={() => submitFloorPlanDraft(draft)}>
                                    Submit
                                  </Button>
                                )}
                                {draft.status !== "approved" && (
                                  <Button size="sm" variant="outline" className="rounded-lg border-(--prism-success)/25 bg-(--prism-success)/8 font-bold text-(--prism-success) hover:bg-(--prism-success)/15" onClick={() => approveFloorPlanDraft(draft)}>
                                    Approve
                                  </Button>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </CardBody>
                  </Card>
                </div>
              )}

              {tab === "briefing" && (
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
              )}

              {tab === "suppliers" && (
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
                        categories={supplierCategories}
                        suppliers={suppliers}
                        requests={quoteRequests}
                        quotes={quotes}
                        onRequestQuotes={requestSupplierQuotes}
                        onSelectQuote={selectSupplierQuote}
                        busy={Boolean(busy)}
                      />
                    </CardBody>
                  </Card>

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
                        eventId={selectedEvent.id}
                        assignedRequests={quoteRequests.filter((r) => r.assignmentStatus === "confirmed")}
                        suppliers={suppliers}
                        onWithdraw={withdrawSupplier}
                        busy={Boolean(busy)}
                      />
                    </CardBody>
                  </Card>
                </div>
              )}

              {tab === "coordinators" && (
                <CoordinatorAssignmentDesk
                  event={selectedEvent}
                  coordinators={coordinators}
                  assignments={state.coordinatorAssignments}
                  roleRequirements={coordinatorRoleRequirements}
                  busy={Boolean(busy)}
                  onAssign={assignCoordinator}
                />
              )}

              {tab === "live-ops" && (
                <LiveOperationsWorkspace
                  event={selectedEvent}
                  liveOps={liveOps}
                  statusFeed={statusFeed}
                  coordinators={coordinators}
                  busy={Boolean(busy)}
                  onReload={loadLiveOps}
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
                <EventMessagesWorkspace
                  event={selectedEvent}
                  session={session}
                  audit={audit}
                  notificationLogs={notificationLogs}
                />
              )}
            </div>
          ) : (
            <Card>
              <CardBody>
                <EmptyState
                  icon={AlertTriangle}
                  title="No confirmed events"
                  description="Accept an inquiry and upload signed conforme to create the first PMCM event workspace."
                />
              </CardBody>
            </Card>
          )
        )}
      </div>
      {conformeUploadTarget && (
        <ConformeUploadModal
          inquiry={conformeUploadTarget}
          onUpload={uploadConforme}
          onClose={closeConformeUpload}
        />
      )}
    </PrismDashboardShell>
  );
}
