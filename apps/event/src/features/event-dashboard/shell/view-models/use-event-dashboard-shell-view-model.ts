"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { CoordinatorRole, FloorplanSceneDocument, PrismConformeExecution, PrismEvent, PrismEventPrivacy, PrismFloorPlanDraft, PrismFloorplanSeatingGuest, PrismFloorplanSupplier, PrismInquiry, PrismSupplier, SetEventModulesInput } from "@prism/types";
import { derivePrismLifecycleStage } from "@prism/types";
import { type FloorPlanTemplate } from "@prism/floorplan-canvas";
import { isPmcmAdmin } from "@/app/lib/role-guards";
import { opensReadOnly } from "@/features/floorplan/editor/model/editor-access";
import { createSceneSaver, type SceneSaver } from "@/features/floorplan/editor/use-cases/scene-saver";
import { loadSeatingGuests } from "@/features/floorplan/editor/data/seating-data";
import { bookedSuppliers } from "@/features/floorplan/editor/model/seating";
import { submitFromEditor } from "@/features/floorplan/editor/use-cases/submit-from-editor";
import { eventPortalNavItems, loadingShellNavItems } from "./use-event-dashboard-nav";
import { useEventUnreadMessages } from "../../messages/view-models/use-event-unread-messages";
import { useEventUnreadNotices } from "@/features/account-notifications/view-models/use-event-unread-notices";
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
  eventSidebarItemHref,
  routeLoadingShellCopy,
  routeShellCopy,
  type DashboardSection,
  type DetailTab,
  type EventDashboardClientProps,
  type RouteState,
} from "../model/event-dashboard-routing";
import { useEventDashboardWorkspaceViewModel } from "./use-event-dashboard-workspace-view-model";
import { eventDashboardCommands } from "../data/event-dashboard-commands";
import { toast } from "@prism/ui/components/sonner";
import { dashboardActionSuccessToast, runDashboardAction, runDashboardActionWithSuccess, type DashboardActionRefreshers } from "./dashboard-action-runner";
import { countersignConformeExecution, downloadConformePdf, prepareConformeExecution, refreshConformeExecution } from "@/features/conforme/signing/use-cases/conforme-signing";
import { assignedSupplierRequests } from "@/features/suppliers/readiness";
import { useResource } from "@prism/portal-query";
import { financeDesk } from "@/features/finance/desk";
import { isScopeFrozen } from "@/features/change-management/register/model/change-register-rules";

export type { EventDashboardClientProps };

type Screen =
  | { name: "portal" }
  | {
      name: "editor";
      event: PrismEvent;
      draft: PrismFloorPlanDraft;
      /** The plan's stored Pascal scene, the guest count and privacy that decide seating, and the plan's version. */
      scene: FloorplanSceneDocument;
      pax: number;
      eventPrivacy: PrismEventPrivacy;
      /** Saves the open Pascal scene one autosave at a time, each against the version the last one returned. */
      saver: SceneSaver;
      /** The event's roster as the Pascal editor seats it, and its booked suppliers. */
      seatingGuests: PrismFloorplanSeatingGuest[];
      suppliers: PrismFloorplanSupplier[];
      /** Changes on every open, so reloading the same draft remounts the editor. */
      openId: number;
      readOnly: boolean;
    };

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
  const editorOpens = useRef(0);
  const [selectedEventId, setSelectedEventId] = useState<string | null>(routeState.eventId ?? null);
  const [selectedClientId, setSelectedClientId] = useState<string | null>(routeState.clientId ?? null);
  const [section, setSection] = useState<DashboardSection>(routeState.section);
  const [tab, setTab] = useState<DetailTab>(routeState.tab);
  const [busy, setBusy] = useState<string | null>(null);

  const workspace = useEventDashboardWorkspaceViewModel({
    selectedEventId,
    screenName: screen.name,
    section,
    tab,
  });
  const {
    session,
    coordinatorState,
    error,
    setError,
    approvalRequests,
    liveOps,
    statusFeed,
    defenseReadiness,
    registrationPlatform,
    guestPrivacyClassification,
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
    setReference,
    reference,
    commandReferenceLoading,
    loadCommandReference,
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
    if (!reference) return;
    setSelectedEventId((prev) => routeState.eventId ?? prev);
  }, [routeState.eventId, reference]);

  const events = useMemo(() => selectActiveEvents(reference), [reference]);
  const selectedEvent = selectedEventWorkspace?.event.id === selectedEventId
    ? selectedEventWorkspace.event
    : selectSelectedEvent(events, selectedEventId);
  const supplierCategories = reference?.supplierCategories ?? [];
  const suppliers = reference?.suppliers ?? [];
  const coordinators = reference?.coordinators ?? [];
  const inquiries = reference?.inquiries ?? [];
  const unreviewedInquiries = selectUnreviewedInquiryCount(inquiries);
  const complianceRules = reference?.complianceRules ?? [];
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
  } = selectEventWorkspaceResources(selectedEvent, selectedEventWorkspace);
  const coordinatorRoleRequirements = coordinatorCoverage;
  const selectedInquiry = inquiries.find((item) => item.id === selectedEvent?.inquiryId);
  const pendingApprovals = selectPendingApprovals(approvalRequests);
  const clientRecords = useMemo(() => selectClientRecords(events, inquiries), [events, inquiries]);
  const selectedClient = clientRecords.find((client) => client.id === selectedClientId) ?? null;
  const clientListView = !selectedClient ? routeState.view ?? "all" : "all";
  const clientRecordsForView = useMemo(() => selectClientRecordsForView(clientRecords, clientListView), [clientListView, clientRecords]);
  const eventListView = routeState.view ?? "all";
  const eventsForView = useMemo(() => selectEventsForView(events, eventListView), [eventListView, events]);

  function commandRefreshers(): DashboardActionRefreshers {
    return {
      refresh,
      refreshSelectedEventWorkspace,
      loadLiveOps: selectedEvent?.id ? () => loadLiveOps(true) : undefined,
    };
  }

  function announceSuccess(actionLabel: string) {
    const { title, description } = dashboardActionSuccessToast(actionLabel);
    toast.success(title, { description });
  }

  async function run(actionLabel: string, action: () => Promise<unknown>) {
    setBusy(actionLabel);
    setError(null);
    try {
      await runDashboardAction(actionLabel, action, commandRefreshers(), {
        reportError: setError,
        announce: ({ title, description }) => toast.success(title, { description }),
      });
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
        commandRefreshers(),
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
      announceSuccess(actionLabel);
      await Promise.all([refresh(), loadLiveOps(true)]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Action failed");
    } finally {
      setBusy(null);
    }
  }

  /**
   * An empty official draft for events with no saved template yet. The room starts at 40 m × 30 m and the
   * briefing's venue and guest count carry over; PMCM resizes the room in the editor.
   */
  async function createBlankDraft() {
    if (!selectedEvent) return;
    const draft = await commands.createFloorPlanDraft(selectedEvent.id, {
      name: `${selectedEvent.eventName} official layout`,
      sourceType: "blank",
      venue: briefing?.venue || selectedEvent.venue || selectedEvent.eventName,
      width: 40,
      height: 30,
      gridSize: 1,
      pax: briefing?.guestCount,
    });
    await openEditor(selectedEvent, draft);
  }

  async function createTemplateDraft(template: FloorPlanTemplate) {
    if (!selectedEvent) return;
    const draft = await commands.createFloorPlanDraft(selectedEvent.id, {
      name: `${template.name} PMCM draft`,
      sourceType: "template",
      venueTemplateId: template.id,
      venue: template.venue || selectedEvent.eventName,
      // This event's guest count decides seating, not the count of the event the template was saved from.
      pax: briefing?.guestCount,
    });
    await openEditor(selectedEvent, draft);
  }

  async function openEditor(event: PrismEvent, draft: PrismFloorPlanDraft, requestedReadOnly = false) {
    if (!session || !isPmcmAdmin(session.role)) return;
    const [opened, seatingGuests] = await Promise.all([commands.loadPlanScene(draft.floorPlanId), loadSeatingGuests(event.id)]);
    const readOnly = opensReadOnly({ requested: requestedReadOnly, storedStatus: opened.draftStatus, screenStatus: draft.status, archived: event.archived, frozen: isScopeFrozen(event.freezeStatus) });
    const saver = createSceneSaver({ planId: draft.floorPlanId, updatedAt: opened.updatedAt, save: commands.savePlanScene });
    editorOpens.current += 1;
    setScreen({ name: "editor", event, draft, scene: opened.scene, pax: opened.pax, eventPrivacy: opened.eventPrivacy, saver, seatingGuests, suppliers: bookedSuppliers(quoteRequests, event.id), openId: editorOpens.current, readOnly });
  }

  /** Saves and submits the draft open in either editor, then shows it as in review on the floor plans page. */
  async function submitOpenDraft(save: () => Promise<unknown>) {
    if (screen.name !== "editor") return;
    const { event, draft } = screen;
    await submitFromEditor({
      save,
      submit: () => commands.submitFloorPlanDraft(event.id, draft.id),
      refreshDashboard: () => refresh(session),
      refreshEventDrafts: () => refreshSelectedEventWorkspace(),
      close: () => setScreen({ name: "portal" }),
    });
  }

  /** Submitting saves first; after a conflict that save would send nothing, so the submit stops instead. */
  function saveSceneForSubmit(scene: FloorplanSceneDocument) {
    const saver = screen.name === "editor" ? screen.saver : null;
    if (!saver) throw new Error("Open a floor plan in the Pascal editor before submitting it.");
    if (saver.state() === "conflict") throw new Error("This floor plan changed elsewhere. Reload it before submitting.");
    return saver.save(scene);
  }

  /** Opens the draft again from the stored plan, dropping the edits a conflict kept from saving. */
  function reloadEditor() {
    if (screen.name !== "editor") return Promise.resolve();
    const { event, draft, readOnly } = screen;
    return run("reload floor plan", () => openEditor(event, draft, readOnly));
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
  const inEventWorkspace = Boolean(routeState.eventId) && !eventWorkspaceDisabled;
  // Messages inside an event counts that event's conversations only.
  const unreadMessages = useEventUnreadMessages({ eventId: selectedEvent?.id });
  const unreadNotices = useEventUnreadNotices();
  // The Finance count is the desk's queue: what is late, to verify or apply, disputed, or owed to a supplier.
  const financeQueue = useResource(financeDesk, "signed-in");
  const shellNavItems = eventPortalNavItems({
    inEventWorkspace,
    unreadMessages,
    unreadNotices,
    eventStage: selectedEvent ? derivePrismLifecycleStage(selectedEvent) : undefined,
    disabledModules: selectedEvent?.disabledModules ?? [],
    inquiryCount: unreviewedInquiries + pendingApprovals.length,
    commandInboxCount: commandInboxLoadFailed
      ? "!"
      : commandInbox
        ? commandInbox.counts.critical + commandInbox.counts.warning + commandInbox.counts.attention
        : undefined,
    assignmentCount: assignments.length,
    quoteCount: assignedSupplierRequests(quoteRequests).length,
    draftCount: drafts.length,
    paymentCount: payments.length,
    closeoutCount: openCheckCount,
    financeCount: financeQueue.data ? financeQueue.data.queue.filter((item) => item.severity !== "info").length : undefined,
  }).map((item) => ({ ...item, href: item.disabled ? undefined : eventSidebarItemHref(item.id, selectedEvent?.id) }));
  const activeNavItem = shellNavItems.find((item) => item.id === activeSidebarItemId);

  return {
    routeState,
    session,
    reference,
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
    guestPrivacyClassification,
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
      selectedClient: selectedClient ?? undefined,
    }),
    refresh,
    refreshApprovals,
    commandReferenceLoading,
    loadCommandReference,
    loadLiveOps,
    run,
    runLiveOps,
    createTemplateDraft,
    createBlankDraft,
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
    setReference,
    setCoordinatorState,
    setLiveOps,
    setStatusFeed,
    setDefenseReadiness,
    setBusy,
    setFloorPlanTemplates,
    acceptInquiry: (inquiry: PrismInquiry) => run("accept inquiry", () => commands.acceptInquiry(inquiry.id)),
    startEventDay: () => selectedEvent ? run("start event day", () => commands.startEventDay(selectedEvent.id)) : Promise.resolve(false),
    pendInquiry: (inquiry: PrismInquiry) => run("pend inquiry", () => commands.pendInquiry(inquiry.id)),
    declineInquiry: (inquiry: PrismInquiry, reason?: string) => run("decline inquiry", () => commands.declineInquiry(inquiry.id, reason)),
    mergeInquiry: (primary: PrismInquiry, input: { sourceInquiryId: string; reason: string }) =>
      run("merge inquiry", () => commands.mergeInquiry(primary.id, input)),
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
    compareSupplierQuoteRound: (roundId: string) => selectedEvent ? commands.compareSupplierQuoteRound(selectedEvent.id, roundId) : Promise.reject(new Error("No event selected")),
    setSupplierAvailability: (supplierId: string, input: Parameters<typeof commands.setSupplierAvailability>[1]) => runForResult("supplier availability", () => commands.setSupplierAvailability(supplierId, input)),
    selectSupplierQuote: (quoteId: string) => selectedEvent ? run("select supplier quote", () => commands.selectSupplierQuote(selectedEvent.id, quoteId)) : Promise.resolve(),
    recordPayment: (milestoneId: string, input: Parameters<typeof commands.recordPayment>[2]) => selectedEvent ? run("record payment", () => commands.recordPayment(selectedEvent.id, milestoneId, input)) : Promise.resolve(),
    markPayment: (milestoneId: string, input: Parameters<typeof commands.markPayment>[2]) => selectedEvent ? run("update payment risk", () => commands.markPayment(selectedEvent.id, milestoneId, input)) : Promise.resolve(),
    sendBillingStatement: (billingId: string) => selectedEvent ? run("send billing statement", () => commands.sendBillingStatement(selectedEvent.id, billingId)) : Promise.resolve(),
    createComplianceRule: (input: Parameters<typeof commands.createComplianceRule>[0]) => run("create compliance rule", () => commands.createComplianceRule(input)),
    runComplianceChecks: (phase: string) => selectedEvent ? run("run compliance", () => commands.runCompliance(selectedEvent.id, phase)) : Promise.resolve(),
    resolveComplianceCheck: (checkId: string) => selectedEvent ? run("resolve compliance", () => commands.resolveCompliance(selectedEvent.id, checkId, { action: "resolve", note: "Resolved during PMCM review." })) : Promise.resolve(),
    overrideComplianceCheck: (checkId: string, reason: string) => selectedEvent ? run("override compliance", () => commands.resolveCompliance(selectedEvent.id, checkId, { action: "override", overrideReason: reason,  })) : Promise.resolve(),
    createBillingSource: (input: Parameters<typeof commands.createBillingSource>[1]) => selectedEvent ? runAsBoolean("create billing source", () => commands.createBillingSource(selectedEvent.id, input)) : Promise.resolve(false),
    approveBillingSource: (sourceId: string) => selectedEvent ? run("approve billing source", () => commands.approveBillingSource(selectedEvent.id, sourceId, "Approved by PMCM.")) : Promise.resolve(),
    generateBillingStatement: (sourceId: string) => selectedEvent ? run("generate billing statement", () => commands.generateBillingStatement(selectedEvent.id, sourceId)) : Promise.resolve(),
    loadCloseGates: () => selectedEvent ? commands.closeGates(selectedEvent.id) : Promise.reject(new Error("No event selected")),
    archiveSelectedEvent: (reason?: string) => selectedEvent ? run("archive event", () => commands.archiveEvent(selectedEvent.id, reason)) : Promise.resolve(),
    recordActualEventEnd: (input: Parameters<typeof commands.recordActualEventEnd>[1]) => selectedEvent ? run("record actual event end", () => commands.recordActualEventEnd(selectedEvent.id, input)) : Promise.resolve(),
    setEventModules: (disabledModules: SetEventModulesInput["disabledModules"]) => selectedEvent && session && isPmcmAdmin(session.role)
      ? runAsBoolean("event modules", () => commands.setEventModules(selectedEvent.id, { disabledModules }))
      : Promise.resolve(false),
    setEventPrivacy: (privacy: "private" | "public") => selectedEvent && session && isPmcmAdmin(session.role)
      ? runAsBoolean("event privacy", () => commands.setEventPrivacy(selectedEvent.id, { privacy }))
      : Promise.resolve(false),
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
    loadCoordinatorSuggestions: (role: CoordinatorRole, skills: string[]) => selectedEvent ? commands.loadCoordinatorSuggestions(selectedEvent.id, { role, skills }) : Promise.resolve([]),
    loadCoordinatorPoolAvailability: () => selectedEvent ? commands.loadCoordinatorPoolAvailability(selectedEvent.id) : Promise.resolve(null),
    loadCoordinatorReliabilityHistory: (coordinatorId: string) => session ? commands.loadCoordinatorReliabilityHistory(coordinatorId) : Promise.resolve([]),
    saveCoordinatorCoverage: (input: Parameters<typeof commands.upsertCoordinatorCoverage>[1]) => selectedEvent && session ? runAsBoolean("coordinator coverage", () => commands.upsertCoordinatorCoverage(selectedEvent.id, input)) : Promise.resolve(false),
    sendCoordinatorAcknowledgementReminders: () => selectedEvent && session ? runForResult("acknowledgement reminders", () => commands.sendCoordinatorAcknowledgementReminders(selectedEvent.id)) : Promise.resolve(null),
    revokeEventDayOperator: () => selectedEvent && session ? runAsBoolean("revoke event operator", () => commands.revokeEventDayOperator(selectedEvent.id)) : Promise.resolve(false),
    designateEventDayOperator: (coordinatorId: string) => selectedEvent && session ? runAsBoolean("designate event operator", () => commands.designateEventDayOperator(selectedEvent.id, { coordinatorId })) : Promise.resolve(false),
    loadEventDayOperator: () => selectedEvent && session ? commands.getEventDayOperator(selectedEvent.id).then((designation) => designation.operator) : Promise.resolve(null),
    loadCoordinatorAvailability: (coordinatorId: string) => selectedEvent && session ? commands.listCoordinatorAvailability(selectedEvent.id, coordinatorId) : Promise.resolve([]),
    createCoordinatorAvailability: (coordinatorId: string, input: Parameters<typeof commands.createCoordinatorAvailability>[2]) => selectedEvent && session ? runAsBoolean("coordinator availability", () => commands.createCoordinatorAvailability(selectedEvent.id, coordinatorId, input)) : Promise.resolve(false),
    deleteCoordinatorAvailability: (coordinatorId: string, availabilityId: string) => selectedEvent && session ? runAsBoolean("remove coordinator availability", () => commands.deleteCoordinatorAvailability(selectedEvent.id, coordinatorId, availabilityId)) : Promise.resolve(false),
    decideEventTaskReassignment: (requestId: string, input: Parameters<typeof commands.decidePmcmEventTaskReassignment>[2]) => selectedEvent && session ? runLiveOps("task reassignment", () => commands.decidePmcmEventTaskReassignment(selectedEvent.id, requestId, input)) : Promise.resolve(),
    createEventDayTask: (input: Parameters<typeof commands.createEventDayTask>[1]) => selectedEvent ? runLiveOps("create task", () => commands.createEventDayTask(selectedEvent.id, input)) : Promise.resolve(),
    updateEventDayTask: (taskId: string, input: Parameters<typeof commands.updateEventDayTask>[2]) => selectedEvent ? runLiveOps("update task", () => commands.updateEventDayTask(selectedEvent.id, taskId, input)) : Promise.resolve(),
    blockEventDayTask: (taskId: string, input: Parameters<typeof commands.blockEventDayTask>[2]) => selectedEvent ? runLiveOps("block task", () => commands.blockEventDayTask(selectedEvent.id, taskId, input)) : Promise.resolve(),
    unblockEventDayTask: (taskId: string) => selectedEvent ? runLiveOps("unblock task", () => commands.unblockEventDayTask(selectedEvent.id, taskId)) : Promise.resolve(),
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
    prepareConformeSigning: async (templateContent?: string) => {
      if (!conformeUploadTarget) throw new Error("Select an accepted inquiry first.");
      const execution = await prepareConformeExecution(conformeUploadTarget.id, templateContent);
      await refresh();
      return execution;
    },
    refreshConformeSigning: async () => {
      if (!conformeUploadTarget) throw new Error("Select an accepted inquiry first.");
      return refreshConformeExecution(conformeUploadTarget.id);
    },
    downloadConformePdf: async () => {
      if (!conformeUploadTarget) throw new Error("Select an accepted inquiry first.");
      await downloadConformePdf(conformeUploadTarget.id);
    },
    countersignConforme: async (execution: PrismConformeExecution) => {
      if (!conformeUploadTarget) throw new Error("Select an accepted inquiry first.");
      const updated = await countersignConformeExecution(conformeUploadTarget.id, execution);
      await refresh();
      return updated;
    },
    submitEditorScene: (scene: FloorplanSceneDocument) => submitOpenDraft(() => saveSceneForSubmit(scene)),
    reloadEditor,
    closeEditor: () => setScreen({ name: "portal" }),
    refreshCommandInbox,
    changeCommandInboxPage,
    approveApprovalRequest: (requestId: string) => run("approve account", () => commands.approveApprovalRequest(requestId)),
    declineApprovalRequest: (requestId: string) => run("decline account", () => commands.declineApprovalRequest(requestId)),
    runPlanningCompliance: () => selectedEvent ? run("compliance", () => commands.runCompliance(selectedEvent.id, "planning")) : Promise.resolve(),
    submitFloorPlanDraft: (draft: PrismFloorPlanDraft) => selectedEvent ? run("submit draft", () => commands.submitFloorPlanDraft(selectedEvent.id, draft.id)) : Promise.resolve(),
    approveFloorPlanDraft: (draft: PrismFloorPlanDraft) => selectedEvent ? run("approve draft", () => commands.approveFloorPlanDraft(selectedEvent.id, draft.id)) : Promise.resolve(),
    reopenClientPreference: (draft: PrismFloorPlanDraft) => selectedEvent ? run("reopen preference", () => commands.reopenClientPreference(selectedEvent.id, draft.id)) : Promise.resolve(),
    withdrawSupplier: (requestId: string) => selectedEvent ? run("withdraw supplier", () => commands.withdrawSupplier(selectedEvent.id, requestId)) : Promise.resolve(),
    upsertRegistrationPlatform: (input: Parameters<typeof commands.upsertRegistrationPlatform>[1]) => selectedEvent ? run("registration platform", () => commands.upsertRegistrationPlatform(selectedEvent.id, input)) : Promise.resolve(),
    updateRegistrationPlatform: (input: Parameters<typeof commands.updateRegistrationPlatform>[1]) => selectedEvent ? run("registration platform", () => commands.updateRegistrationPlatform(selectedEvent.id, input)) : Promise.resolve(),
    updateRegistrationPlatformSetup: (input: Parameters<typeof commands.updateRegistrationPlatformSetup>[1]) => selectedEvent ? run("registration platform setup", () => commands.updateRegistrationPlatformSetup(selectedEvent.id, input)) : Promise.resolve(),
    updateGuestPrivacyClassification: (input: Parameters<typeof commands.updateGuestPrivacyClassification>[1]) => selectedEvent && session ? runAsBoolean("guest privacy classification", () => commands.updateGuestPrivacyClassification(selectedEvent.id, input)) : Promise.resolve(false),
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
