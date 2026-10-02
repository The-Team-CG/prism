"use client";

import { useEffect, useMemo, useState } from "react";
import type { CoordinatorRole, PrismEvent, PrismFloorPlanDraft, PrismInquiry, PrismSupplier } from "@prism/types";
import { type FloorPlanTemplate, type Project, cloneTemplateObjects } from "@/features/floorplan/editor";
import { isPmcmAdmin } from "@/app/lib/role-guards";
import { eventPortalNavItems, loadingShellNavItems } from "./use-event-dashboard-nav";
import { useEventDashboardNavigationViewModel } from "./use-event-dashboard-navigation-view-model";
import {
  selectClientRecords,
  selectClientRecordsForView,
  selectEventsForView,
  selectUnreviewedInquiryCount,
} from "../model/event-dashboard-selectors";
import {
  selectActiveEvents,
  selectEventWorkspaceResources,
  selectPendingApprovals,
  selectSelectedEvent,
} from "@/features/pmcm-kit/model/pmcm-dashboard-selectors";
import {
  activeSidebarItemFromRoute,
  routeLoadingShellCopy,
  routeShellCopy,
  type DashboardSection,
  type DetailTab,
  type EventDashboardClientProps,
  type RouteState,
} from "../model/event-dashboard-routing";
import { useEventDashboardWorkspaceViewModel } from "./use-event-dashboard-workspace-view-model";
import { eventDashboardCommands } from "../data/event-dashboard-commands";
import { runDashboardActionWithSuccess } from "./dashboard-action-runner";

export type { EventDashboardClientProps };

type Screen =
  | { name: "portal" }
  | { name: "editor"; event: PrismEvent; draft: PrismFloorPlanDraft; project: Project };

export function useEventDashboardShellViewModel({
  section: initialSection,
  tab: initialTab,
  eventId: initialEventId,
  clientId: initialClientId,
  view: initialView,
}: EventDashboardClientProps = {}) {
  const commands = eventDashboardCommands;
  const routeState = useMemo<RouteState>(() => {
    return {
      section: initialSection ?? "dashboard",
      tab: initialTab ?? "overview",
      eventId: initialEventId,
      clientId: initialClientId,
      view: initialView,
    };
  }, [initialClientId, initialEventId, initialSection, initialTab, initialView]);

  const [screen, setScreen] = useState<Screen>({ name: "portal" });
  const [selectedEventId, setSelectedEventId] = useState<string | null>(routeState.eventId ?? null);
  const [selectedClientId, setSelectedClientId] = useState<string | null>(routeState.clientId ?? null);
  const [section, setSection] = useState<DashboardSection>(routeState.section);
  const [tab, setTab] = useState<DetailTab>(routeState.tab);
  const [busy, setBusy] = useState<string | null>(null);

  const workspace = useEventDashboardWorkspaceViewModel({
    selectedEventId,
    screenName: screen.name,
    section,
  });
  const {
    session,
    state,
    coordinatorState,
    error,
    setError,
    approvalRequests,
    liveOps,
    statusFeed,
    defenseReadiness,
    registrationPlatform,
    commandDataErrors,
    floorPlanTemplates,
    commandInbox,
    setCommandInbox,
    conformeUploadTarget,
    setConformeUploadTarget,
    commandInboxLoadFailed,
    setCommandInboxLoadFailed,
    refresh,
    refreshApprovals,
    loadLiveOps,
    refreshSelectedEventWorkspace,
    selectedEventWorkspace,
    setState,
    setCoordinatorState,
    setLiveOps,
    setStatusFeed,
    setDefenseReadiness,
    setFloorPlanTemplates,
    refreshCommandInbox,
    changeCommandInboxPage,
  } = workspace;
  useEffect(() => {
    setSection(routeState.section);
    setTab(routeState.tab);
    if (routeState.eventId) setSelectedEventId(routeState.eventId);
    if (routeState.section === "clients") setSelectedClientId(routeState.clientId ?? null);
  }, [routeState.clientId, routeState.eventId, routeState.section, routeState.tab, routeState.view]);

  useEffect(() => {
    if (!state) return;
    setSelectedEventId((prev) => routeState.eventId ?? prev);
  }, [routeState.eventId, state]);

  const events = useMemo(() => selectActiveEvents(state), [state]);
  const selectedEvent = selectedEventWorkspace?.event.id === selectedEventId
    ? selectedEventWorkspace.event
    : selectSelectedEvent(events, selectedEventId);
  const supplierCategories = state?.supplierCategories ?? [];
  const suppliers = state?.suppliers ?? [];
  const coordinators = state?.coordinators ?? [];
  const inquiries = state?.inquiries ?? [];
  const unreviewedInquiries = selectUnreviewedInquiryCount(inquiries);
  const complianceRules = state?.complianceRules ?? [];
  const {
    activeDraft,
    assignments,
    coordinatorCoverage,
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
  } = selectEventWorkspaceResources(state, selectedEvent, selectedEventWorkspace);
  const coordinatorRoleRequirements = coordinatorCoverage;
  const selectedInquiry = inquiries.find((item) => item.id === selectedEvent?.inquiryId);
  const pendingApprovals = selectPendingApprovals(approvalRequests);
  const clientRecords = useMemo(() => selectClientRecords(events, inquiries), [events, inquiries]);
  const selectedClient = clientRecords.find((client) => client.id === selectedClientId) ?? null;
  const clientListView = !selectedClient ? routeState.view ?? "all" : "all";
  const clientRecordsForView = useMemo(() => selectClientRecordsForView(clientRecords, clientListView), [clientListView, clientRecords]);
  const eventListView = routeState.view ?? "all";
  const eventsForView = useMemo(() => selectEventsForView(events, eventListView), [eventListView, events]);

  async function run(actionLabel: string, action: () => Promise<unknown>) {
    setBusy(actionLabel);
    setError(null);
    try {
      await action();
      await refresh();
      await refreshSelectedEventWorkspace();
      await refreshApprovals();
      if (selectedEvent?.id) {
        await loadLiveOps(true).catch(() => undefined);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Action failed");
    } finally {
      setBusy(null);
    }
  }

  async function runAsBoolean(actionLabel: string, action: () => Promise<unknown>) {
    let succeeded = false;
    await run(actionLabel, async () => {
      await action();
      succeeded = true;
    });
    return succeeded;
  }

  async function runForResult<T>(actionLabel: string, action: () => Promise<T>): Promise<T | null> {
    let result: T | null = null;
    await run(actionLabel, async () => {
      result = await action();
    });
    return result;
  }

  async function runWithSuccess(actionLabel: string, action: () => Promise<unknown>) {
    setBusy(actionLabel);
    setError(null);
    try {
      return await runDashboardActionWithSuccess(
        action,
        {
          refresh,
          refreshSelectedEventWorkspace,
          refreshApprovals,
          loadLiveOps: selectedEvent?.id ? () => loadLiveOps(true) : undefined,
        },
        (message) => setError(message),
      );
    } finally {
      setBusy(null);
    }
  }

  async function runLiveOps(actionLabel: string, action: () => Promise<unknown>) {
    setBusy(actionLabel);
    setError(null);
    try {
      await action();
      await refresh();
      await loadLiveOps(true);
      await refreshApprovals();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Action failed");
    } finally {
      setBusy(null);
    }
  }

  async function createTemplateDraft(template: FloorPlanTemplate) {
    if (!selectedEvent) return;
    const draft = await commands.createFloorPlanDraft(selectedEvent.id, {
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
    await openEditor(selectedEvent, draft);
  }

  async function openEditor(event: PrismEvent, draft: PrismFloorPlanDraft) {
    if (!session || !isPmcmAdmin(session.role)) return;
    const project = await commands.loadPlan(draft.floorPlanId);
    setScreen({ name: "editor", event, draft, project });
  }

  const navigation = useEventDashboardNavigationViewModel({
    routeState,
    session,
    screenName: screen.name,
    selectedEvent,
    selectedEventId,
    selectedClient,
    setSection,
    setTab,
    setSelectedEventId,
    setSelectedClientId,
  });
  const {
    sidebarActiveOverride,
    navigateEvent,
    navigateClient,
    navigateEventTab,
    navigateSection,
    handleSidebarNav,
    signOut,
  } = navigation;
  const openCheckCount = checks.filter((item) => item.status === "open").length;
  const openActionCount = defenseReadiness?.nextActions.length ?? pendingApprovals.length + unreviewedInquiries;
  const eventWorkspaceDisabled = !selectedEvent;
  const activeSidebarItemId = activeSidebarItemFromRoute(routeState);
  const shellNavItems = eventPortalNavItems({
    hasEvent: !eventWorkspaceDisabled,
    eventName: selectedEvent?.eventName,
    inquiryCount: unreviewedInquiries + pendingApprovals.length,
    taskCount: openActionCount,
    commandInboxCount: commandInboxLoadFailed
      ? "!"
      : commandInbox
        ? commandInbox.counts.critical + commandInbox.counts.warning + commandInbox.counts.attention
        : undefined,
    assignmentCount: assignments.length,
    quoteCount: quotes.length,
    draftCount: drafts.length,
    paymentCount: payments.length,
    closeoutCount: openCheckCount,
  });
  const activeNavItem = shellNavItems.find((item) => item.id === activeSidebarItemId);

  return {
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
    registrationPlatform,
    commandDataErrors,
    busy,
    floorPlanTemplates,
    commandInbox,
    conformeUploadTarget,
    commandInboxLoadFailed,
    events,
    selectedEvent,
    selectedEventWorkspace,
    supplierCategories,
    suppliers,
    coordinators,
    coordinatorRoleRequirements,
    inquiries,
    unreviewedInquiries,
    complianceRules,
    activeDraft,
    assignments,
    coordinatorCoverage,
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
    shellCopy: routeShellCopy(routeState, {
      activeNavLabel: activeNavItem?.label,
      selectedEvent,
    }),
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
    setTab,
    setScreen,
    setConformeUploadTarget,
    setCommandInbox,
    setCommandInboxLoadFailed,
    setSelectedEventId,
    setSection,
    setSelectedClientId,
    setError,
    setState,
    setCoordinatorState,
    setLiveOps,
    setStatusFeed,
    setDefenseReadiness,
    setBusy,
    setFloorPlanTemplates,
    acceptInquiry: (inquiry: PrismInquiry) => run("accept inquiry", () => commands.acceptInquiry(inquiry.id)),
    pendInquiry: (inquiry: PrismInquiry) => run("pend inquiry", () => commands.pendInquiry(inquiry.id)),
    declineInquiry: (inquiry: PrismInquiry, reason: string) => run("decline inquiry", () => commands.declineInquiry(inquiry.id, reason)),
    logInquiryOnBehalf: (input: Parameters<typeof commands.logInquiryOnBehalf>[0]) => session ? run("log inquiry on behalf", () => commands.logInquiryOnBehalf(input, session)) : Promise.resolve(),
    sendConformeReminder: (inquiry: PrismInquiry) => run("conforme reminder", () => commands.sendConformeReminder(inquiry.id)),
    toggleSupplierBni: (supplier: PrismSupplier, nextValue: boolean) => run("supplier BNI flag", () => commands.updateSupplier(supplier.id, { bniMember: nextValue })),
    createSupplier: (input: Parameters<typeof commands.createSupplier>[0]) => run("create supplier", () => commands.createSupplier(input)),
    updateSupplierProfile: (supplierId: string, input: Parameters<typeof commands.updateSupplier>[1]) => run("update supplier", () => commands.updateSupplier(supplierId, input)),
    changeSupplierTier: (supplierId: string, tier: Parameters<typeof commands.changeSupplierTier>[1]["tier"], reason: string) => run("supplier tier change", () => commands.changeSupplierTier(supplierId, { tier, reason })),
    promoteSupplier: (supplierId: string, tier: Parameters<typeof commands.promoteSupplier>[1]["tier"], reason: string) => selectedEvent ? run("supplier promotion", () => commands.promoteSupplier(supplierId, { eventId: selectedEvent.id, tier, reason, idempotencyKey: `promotion-${supplierId}-${selectedEvent.id}` })) : Promise.resolve(),
    addSupplierReview: (supplierId: string, input: Parameters<typeof commands.addSupplierReview>[1]) => session
      ? runWithSuccess("supplier private review", () => commands.addSupplierReview(supplierId, { ...input, eventId: selectedEvent?.id }))
      : Promise.resolve(false),
    addSupplierCertification: (supplierId: string, input: Parameters<typeof commands.addSupplierCertification>[1]) => run("supplier certification", () => commands.addSupplierCertification(supplierId, input)),
    requestSupplierQuotes: (input: Parameters<typeof commands.requestSupplierQuotes>[1]) => selectedEvent ? run("request supplier quotes", () => commands.requestSupplierQuotes(selectedEvent.id, input)) : Promise.resolve(),
    selectSupplierQuote: (quoteId: string) => selectedEvent ? run("select supplier quote", () => commands.selectSupplierQuote(selectedEvent.id, quoteId)) : Promise.resolve(),
    recordPayment: (milestoneId: string, input: Parameters<typeof commands.recordPayment>[2]) => selectedEvent ? run("record payment", () => commands.recordPayment(selectedEvent.id, milestoneId, input)) : Promise.resolve(),
    sendBillingStatement: (billingId: string) => selectedEvent ? run("send billing statement", () => commands.sendBillingStatement(selectedEvent.id, billingId)) : Promise.resolve(),
    createComplianceRule: (input: Parameters<typeof commands.createComplianceRule>[0]) => run("create compliance rule", () => commands.createComplianceRule(input)),
    runComplianceChecks: (phase: string) => selectedEvent ? run("run compliance", () => commands.runCompliance(selectedEvent.id, phase)) : Promise.resolve(),
    resolveComplianceCheck: (checkId: string) => selectedEvent ? run("resolve compliance", () => commands.resolveCompliance(selectedEvent.id, checkId, { action: "resolve", note: "Resolved during PMCM review." })) : Promise.resolve(),
    overrideComplianceCheck: (checkId: string, reason: string) => selectedEvent ? run("override compliance", () => commands.resolveCompliance(selectedEvent.id, checkId, { action: "override", overrideReason: reason,  })) : Promise.resolve(),
    createBillingSource: (input: Parameters<typeof commands.createBillingSource>[1]) => selectedEvent ? run("create billing source", () => commands.createBillingSource(selectedEvent.id, input)) : Promise.resolve(),
    approveBillingSource: (sourceId: string) => selectedEvent ? run("approve billing source", () => commands.approveBillingSource(selectedEvent.id, sourceId, "Approved by PMCM.")) : Promise.resolve(),
    generateBillingStatement: (sourceId: string) => selectedEvent ? run("generate billing statement", () => commands.generateBillingStatement(selectedEvent.id, sourceId)) : Promise.resolve(),
    loadCloseGates: () => selectedEvent ? commands.closeGates(selectedEvent.id) : Promise.reject(new Error("No event selected")),
    archiveSelectedEvent: (reason?: string) => selectedEvent ? run("archive event", () => commands.archiveEvent(selectedEvent.id, reason)) : Promise.resolve(),
    recordActualEventEnd: (input: Parameters<typeof commands.recordActualEventEnd>[1]) => selectedEvent ? run("record actual event end", () => commands.recordActualEventEnd(selectedEvent.id, input)) : Promise.resolve(),
    toggleClientEventDayView: (enabled: boolean) => selectedEvent && session && isPmcmAdmin(session.role)
      ? runAsBoolean("client event-day view", () => commands.setClientEventDayView(selectedEvent.id, { enabled }))
      : Promise.resolve(false),
    scheduleOcularVisit: (input: Parameters<typeof commands.scheduleOcularVisit>[1]) => selectedEvent && session && isPmcmAdmin(session.role)
      ? run("schedule ocular visit", () => commands.scheduleOcularVisit(selectedEvent.id, input))
      : Promise.resolve(),
    completeOcularVisit: () => selectedEvent && session && isPmcmAdmin(session.role)
      ? run("complete ocular visit", () => commands.completeOcularVisit(selectedEvent.id))
      : Promise.resolve(),
    waiveOcularVisit: (input: Parameters<typeof commands.waiveOcularVisit>[1]) => selectedEvent && session && isPmcmAdmin(session.role)
      ? run("waive ocular visit", () => commands.waiveOcularVisit(selectedEvent.id, input))
      : Promise.resolve(),
    loadEventInsights: () => selectedEvent ? commands.eventInsights(selectedEvent.id) : Promise.reject(new Error("No event selected")),
    generateEventInsights: () => selectedEvent ? run("generate insights", () => commands.generateEventInsights(selectedEvent.id)) : Promise.resolve(),
    assignCoordinator: (coordinator: { id: string }, role: CoordinatorRole, overrideConflict = false) => selectedEvent ? run("coordinator assignment", () => commands.assignCoordinator(selectedEvent.id, { coordinatorId: coordinator.id, role, overrideConflict })) : Promise.resolve(),
    saveCoordinatorCoverage: (input: Parameters<typeof commands.upsertCoordinatorCoverage>[1]) => selectedEvent && session ? runAsBoolean("coordinator coverage", () => commands.upsertCoordinatorCoverage(selectedEvent.id, input)) : Promise.resolve(false),
    sendCoordinatorAcknowledgementReminders: () => selectedEvent && session ? runForResult("acknowledgement reminders", () => commands.sendCoordinatorAcknowledgementReminders(selectedEvent.id)) : Promise.resolve(null),
    designateEventDayOperator: (coordinatorId: string) => selectedEvent && session ? runAsBoolean("designate event operator", () => commands.designateEventDayOperator(selectedEvent.id, { coordinatorId })) : Promise.resolve(false),
    loadEventDayOperator: () => selectedEvent && session ? commands.getEventDayOperator(selectedEvent.id).then((designation) => designation.operator) : Promise.resolve(null),
    loadCoordinatorAvailability: (coordinatorId: string) => selectedEvent && session ? commands.listCoordinatorAvailability(selectedEvent.id, coordinatorId) : Promise.resolve([]),
    createCoordinatorAvailability: (coordinatorId: string, input: Parameters<typeof commands.createCoordinatorAvailability>[2]) => selectedEvent && session ? runAsBoolean("coordinator availability", () => commands.createCoordinatorAvailability(selectedEvent.id, coordinatorId, input)) : Promise.resolve(false),
    deleteCoordinatorAvailability: (coordinatorId: string, availabilityId: string) => selectedEvent && session ? runAsBoolean("remove coordinator availability", () => commands.deleteCoordinatorAvailability(selectedEvent.id, coordinatorId, availabilityId)) : Promise.resolve(false),
    decideEventTaskReassignment: (requestId: string, input: Parameters<typeof commands.decidePmcmEventTaskReassignment>[2]) => selectedEvent && session ? runLiveOps("task reassignment", () => commands.decidePmcmEventTaskReassignment(selectedEvent.id, requestId, input)) : Promise.resolve(),
    createEventDayTask: (input: Parameters<typeof commands.createEventDayTask>[1]) => selectedEvent ? runLiveOps("create task", () => commands.createEventDayTask(selectedEvent.id, input)) : Promise.resolve(),
    updateEventDayTask: (taskId: string, input: Parameters<typeof commands.updateEventDayTask>[2]) => selectedEvent ? runLiveOps("update task", () => commands.updateEventDayTask(selectedEvent.id, taskId, input)) : Promise.resolve(),
    escalateEventDayTask: (taskId: string, input: Parameters<typeof commands.escalateEventDayTask>[2]) => selectedEvent ? runLiveOps("escalate task", () => commands.escalateEventDayTask(selectedEvent.id, taskId, input)) : Promise.resolve(),
    createUrgentIssue: (input: Parameters<typeof commands.createUrgentIssue>[1]) => selectedEvent ? runLiveOps("create issue", () => commands.createUrgentIssue(selectedEvent.id, input)) : Promise.resolve(),
    updateUrgentIssue: (issueId: string, input: Parameters<typeof commands.updateUrgentIssue>[2]) => selectedEvent ? runLiveOps("update issue", () => commands.updateUrgentIssue(selectedEvent.id, issueId, input)) : Promise.resolve(),
    escalateUrgentIssue: (issueId: string, input: Parameters<typeof commands.escalateUrgentIssue>[2]) => selectedEvent ? runLiveOps("escalate issue", () => commands.escalateUrgentIssue(selectedEvent.id, issueId, input)) : Promise.resolve(),
    updateCoordinatorAttendance: (assignmentId: string, input: Parameters<typeof commands.updateCoordinatorAttendance>[2]) => selectedEvent ? runLiveOps("attendance", () => commands.updateCoordinatorAttendance(selectedEvent.id, assignmentId, input)) : Promise.resolve(),
    replaceCoordinator: (assignmentId: string, input: Parameters<typeof commands.replaceCoordinator>[2]) => selectedEvent ? runLiveOps("replace coordinator", () => commands.replaceCoordinator(selectedEvent.id, assignmentId, input)) : Promise.resolve(),
    verifySupplierStatus: (requestId: string, input: Parameters<typeof commands.verifySupplierStatus>[2]) => selectedEvent ? runLiveOps("verify supplier", () => commands.verifySupplierStatus(selectedEvent.id, requestId, input)) : Promise.resolve(),
    createTemplateDraftAction: (template: FloorPlanTemplate) => run("create floorplan", () => createTemplateDraft(template)),
    openDraft: (event: PrismEvent, draft: PrismFloorPlanDraft) => run("open draft", () => openEditor(event, draft)),
    uploadConforme: async (file: { name: string; type: string; size: number }) => {
      if (!conformeUploadTarget) return;
      await commands.uploadConforme(conformeUploadTarget.id, {
        fileName: file.name,
        mimeType: file.type,
        sizeBytes: file.size,
      });
      await refresh();
    },
    saveEditorPlan: (project: Project) => commands.savePlan(project),
    submitEditorPlan: async (project: Project) => {
      if (screen.name !== "editor") return;
      await commands.savePlan(project);
      await commands.submitFloorPlanDraft(screen.event.id, screen.draft.id);
      await refresh(session);
      setScreen({ name: "portal" });
    },
    closeEditor: () => setScreen({ name: "portal" }),
    refreshCommandInbox,
    changeCommandInboxPage,
    approveApprovalRequest: (requestId: string) => run("approve account", () => commands.approveApprovalRequest(requestId)),
    declineApprovalRequest: (requestId: string) => run("decline account", () => commands.declineApprovalRequest(requestId)),
    submitBriefing: () => selectedEvent ? run("briefing", () => commands.submitBriefing(selectedEvent.id)) : Promise.resolve(),
    runPlanningCompliance: () => selectedEvent ? run("compliance", () => commands.runCompliance(selectedEvent.id, "planning")) : Promise.resolve(),
    submitFloorPlanDraft: (draft: PrismFloorPlanDraft) => selectedEvent ? run("submit draft", () => commands.submitFloorPlanDraft(selectedEvent.id, draft.id)) : Promise.resolve(),
    approveFloorPlanDraft: (draft: PrismFloorPlanDraft) => selectedEvent ? run("approve draft", () => commands.approveFloorPlanDraft(selectedEvent.id, draft.id)) : Promise.resolve(),
    withdrawSupplier: (requestId: string) => selectedEvent ? run("withdraw supplier", () => commands.withdrawSupplier(selectedEvent.id, requestId)) : Promise.resolve(),
    upsertRegistrationPlatform: (input: Parameters<typeof commands.upsertRegistrationPlatform>[1]) => selectedEvent ? run("registration platform", () => commands.upsertRegistrationPlatform(selectedEvent.id, input)) : Promise.resolve(),
    updateRegistrationPlatform: (input: Parameters<typeof commands.updateRegistrationPlatform>[1]) => selectedEvent ? run("registration platform", () => commands.updateRegistrationPlatform(selectedEvent.id, input)) : Promise.resolve(),
    importHeadcount: (input: Parameters<typeof commands.importHeadcount>[1]) => selectedEvent ? run("import headcount", () => commands.importHeadcount(selectedEvent.id, input)) : Promise.resolve(),
    searchGuestRoster: (filters = {}) => selectedEvent ? commands.searchGuestRosterWithFilters(selectedEvent.id, filters) : Promise.resolve([]),
    importGuestRoster: (input: Parameters<typeof commands.importGuestRoster>[1]) => selectedEvent ? commands.importGuestRoster(selectedEvent.id, input) : Promise.resolve([]),
    checkInGuestRoster: (rosterEntryId: string) => selectedEvent ? run("check in guest", () => commands.checkInGuestRoster(selectedEvent.id, rosterEntryId)) : Promise.resolve(),
    verifyGuestRoster: (rosterEntryId: string, status: Parameters<typeof commands.verifyGuestRoster>[2]) => selectedEvent ? run("verify guest", () => commands.verifyGuestRoster(selectedEvent.id, rosterEntryId, status)) : Promise.resolve(),
    getWalkInPolicy: () => selectedEvent ? commands.getWalkInPolicy(selectedEvent.id) : Promise.resolve(null),
    updateWalkInPolicy: (input: Parameters<typeof commands.updateWalkInPolicy>[1]) => selectedEvent ? run("walk-in policy", () => commands.updateWalkInPolicy(selectedEvent.id, input)) : Promise.resolve(),
    uploadConformeTarget: (inquiry: PrismInquiry) => setConformeUploadTarget(inquiry),
    openConformeUpload: (inquiry: PrismInquiry) => {
      setConformeUploadTarget(inquiry);
      return Promise.resolve();
    },
    closeConformeUpload: () => setConformeUploadTarget(null),
    loadingShellCopy: routeLoadingShellCopy(routeState),
    loadingShellNavItems: loadingShellNavItems(Boolean(routeState.eventId)),
  };
}

export type EventDashboardShellViewModel = ReturnType<typeof useEventDashboardShellViewModel>;
