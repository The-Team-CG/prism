"use client";

import { PostEventDeliverablesPanel } from "@/features/closure/deliverables/views/post-event-deliverables-panel";


import { useEffect, useState, type ReactNode } from "react";
import { FileCheck2, Gavel, Sparkles } from "lucide-react";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from "@prism/ui/components/sheet";
import { Button } from "@prism/ui/components/button";
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@prism/ui/components/empty";
import { PAREPanel } from "@/features/pare/panel";
import { CLOSURE_TABS, Phase4Workspace, type CloseGateDestination, type ClosureStep, type ClosureTabId } from "@/features/closure/phase4";
import { useListFilter } from "@/features/pmcm-kit";
import { CoordinatorAssignmentDesk } from "@/features/coordinators/desk";
import { PostponementImpactPanel } from "@/features/event-decisions/postponement-impact";
import { ChangeRegisterPanel, eventDecisionClosedReason } from "@/features/change-management/register";
import { EventPlanPanel } from "@/features/planning/event-plan";
import { DateImpactPanel } from "@/features/planning/date-impact";
import { isScopeFrozen } from "@/features/change-management/register/model/change-register-rules";
import { EventWorkspaceOverview } from "./event-overview";
import { useEventCoverUrl, useEventOverviewGlance } from "@/features/pmcm-overview";
import { EventOcularVisitTask } from "./event-ocular-visit-task";
import { FinancialWorkspace } from "@/features/finance/workspace";
import { BillingSourcesTab } from "./billing-sources-tab";
import { canStartEventDay } from "../../model/event-dashboard-selectors";
import { BillingAdjustmentsPanel } from "@/features/finance/billing-adjustments/views/billing-adjustments-panel";
import { LiveOperationsWorkspace } from "@/features/live-ops/workspace";
import { HandoffBriefPanel } from "@/features/live-ops/handoff-brief";
import { DecisionLogPanel } from "@/features/decision-log";
import { SupplierQuotePlanner } from "@/features/suppliers/directory";
import { PmcmSupplierReadinessBoard, assignedSupplierRequests, supplierReadinessRefreshKey } from "@/features/suppliers/readiness";
import { SupplierFileReadiness } from "@/features/files/matrix";
import { PmcmSupplierWorkflowsPanel } from "@/features/suppliers/workflows/views/pmcm-supplier-workflows-panel";
import { EventRegistrationTab } from "@/app/components/pmcm/event-registration-tab";
import { EventGamesHostView } from "@/features/event-games/host";
import { EventFloorplansTab, isOcularVisitCleared } from "@/features/floorplan/workspace";
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
import { VenueScoutingPanel } from "@/features/commercial/venue-scouting/views/venue-scouting-panel";
import { PmcmProposalIssuerPanel } from "@/features/commercial/proposal-issuer/views/pmcm-proposal-issuer-panel";
import { PmcmProposalComments } from "@/features/commercial/proposal-comments/views/pmcm-proposal-comments";
import { PmcmRoleBriefEditor } from "@/features/coordinators/role-briefs/views/pmcm-role-brief-editor";
import { CoordinatorReplacementPanel } from "@/features/pare/coordinator/views/coordinator-replacement-panel";
import { PreConformeContextPanel } from "@/features/inquiries/context-notes/views/context-notes-log";
import { AccreditationPanel } from "@/features/compliance/accreditation/views/accreditation-panel";
import { ClientOwnedSuppliersPanel, UnresponsiveSuppliersPanel } from "@/features/suppliers/follow-ups/views/supplier-follow-ups";
import { ThemeSuggestionsPanel } from "@/features/ai-advisory/views/ai-advisory-panels";
import { EventDayCopilotPanel, OperationsAssistantPanel } from "@/features/ai-advisory/views/live-assist-panels";
import { PresentationMeetingsPanel } from "@/features/commercial/presentation-meetings/views/presentation-meetings-panel";
import { isEventModuleEnabled } from "@prism/types";
import { PmcmClientFollowUps } from "@/features/commercial/client-follow-ups/views/pmcm-client-follow-ups";
import { PmcmSupplierGapWarning } from "@/features/suppliers/supplier-gaps/views/pmcm-supplier-gap-warning";
import { PmcmExternalCreativePanel } from "@/features/suppliers/external-creative/views/pmcm-external-creative-panel";
import { VenueConfirmationsPanel } from "@/features/event-decisions/venue-confirmations/views/venue-confirmations-panel";

function selectedOcularVisit(vm: ReturnType<typeof useEventDashboardLoadedRouteViewModel>) {
  if (!vm.selectedEvent) return null;
  return vm.selectedEventWorkspace?.event.id === vm.selectedEvent.id ? vm.selectedEventWorkspace?.ocularVisit ?? null : null;
}

export function EventWorkspaceOverviewTab() {
  const vm = useEventDashboardLoadedRouteViewModel();
  const glance = useEventOverviewGlance(vm.selectedEvent?.id ?? null);
  const coverUrl = useEventCoverUrl(vm.selectedEvent?.id ?? "", vm.selectedEvent?.coverObjectId);
  if (!vm.selectedEvent) return null;
  const visit = selectedOcularVisit(vm);
  const workspace = vm.selectedEventWorkspace?.event.id === vm.selectedEvent.id ? vm.selectedEventWorkspace : null;
  // The official floorplan waits on the ocular visit, so it stays on the overview until it is completed or waived.
  const visitOpen = !isOcularVisitCleared(visit?.status);
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
      onRunCompliance={() => void vm.runPlanningCompliance()}
      onOpenTab={(tab) => vm.navigateEventTab(tab)}
      glance={glance}
      coverUrl={coverUrl}
      visitRequested={visit?.status === "requested"}
      briefing={workspace?.briefings.at(-1) ?? null}
      milestones={workspace?.paymentMilestones}
      ocularVisit={visitOpen ? (
        <EventOcularVisitTask
          eventName={vm.selectedEvent.eventName}
          visit={visit}
          isAdmin={isPmcmAdmin(vm.session.role)}
          busy={vm.busy !== null}
          onSchedule={vm.scheduleOcularVisit}
          onComplete={vm.completeOcularVisit}
          onWaive={vm.waiveOcularVisit}
        />
      ) : null}
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
      ocularVisit={{
        cleared: isOcularVisitCleared(selectedOcularVisit(vm)?.status),
        onOpenOverview: () => vm.navigateEventTab("overview"),
      }}
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

/** The client owns the briefing; PMCM reads it here and plans against it. */
function BriefingSummary({ briefing }: { briefing?: PrismBriefing | null }) {
  if (!briefing) {
    return (
      <Empty>
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <FileCheck2 />
          </EmptyMedia>
          <EmptyTitle>No briefing yet</EmptyTitle>
          <EmptyDescription>The client submits the briefing from their portal. It sets the venue, guest count, budget and services PMCM plans against.</EmptyDescription>
        </EmptyHeader>
      </Empty>
    );
  }
  return (
    <section className="rounded-lg border border-border bg-card">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-5 py-3">
        <div>
          <h2 className="font-semibold text-foreground">Client briefing</h2>
          <p className="text-xs text-muted-foreground">Submitted {formatPortalDateTime(briefing.submittedAt)}</p>
        </div>
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

/** A planning section; `adminOnly` sections are PMCM admin's, and `hidden` ones are switched off for this event. */
type BriefingSubTab = WorkspaceSubTab & { adminOnly?: boolean; hidden?: boolean };

/**
 * Old planning tabs, each now a section of a broader one. Links the API and other pages still build (an Inbox
 * follow-up opens `?part=follow-ups`) land on the tab that holds that section, scrolled to it.
 */
export const PLANNING_PART_ALIASES: Record<string, string> = {
  reviews: "proposal",
  "follow-ups": "proposal",
  "date-change": "changes",
  "pre-conforme": "briefing",
  assistant: "briefing",
  accreditation: "briefing",
};

/** One part of a broader planning tab, with an anchor an old link can scroll to. */
function PlanningPart({ id, title, children }: { id: string; title?: string; children: ReactNode }) {
  return (
    <section id={`planning-${id}`} className="scroll-mt-24 space-y-3">
      {title ? <h2 className="text-base font-semibold text-foreground">{title}</h2> : null}
      {children}
    </section>
  );
}

/**
 * Planning and decisions in the order the work happens, five tabs instead of eleven: the client's briefing (with the
 * context from before the conforme folded under it), the proposal and everything the client says about it, the
 * changes asked for after it, PMCM's plan, and the decision log. The assistant opens beside any tab.
 */
export function EventWorkspaceBriefingTab() {
  const vm = useEventDashboardLoadedRouteViewModel();
  const { briefing, selectedEvent } = vm;
  const [part, setPart] = useListFilter("part", "briefing");
  const [assistantOpen, setAssistantOpen] = useState(false);
  const alias = PLANNING_PART_ALIASES[part];
  useEffect(() => {
    if (!alias) return;
    // An old link names a section inside a broader tab: open that tab, then bring the section into view.
    window.setTimeout(() => document.getElementById(`planning-${part}`)?.scrollIntoView({ block: "start" }), 0);
  }, [alias, part]);
  if (!selectedEvent) return null;
  const admin = isPmcmAdmin(vm.session.role);
  const entries: BriefingSubTab[] = [
    {
      id: "briefing",
      label: "Briefing",
      attention: !briefing,
      render: () => (
        <div className="space-y-5">
          <BriefingSummary briefing={briefing} />
          {admin ? (
            <details id="planning-pre-conforme" className="group scroll-mt-24 rounded-lg border border-border bg-card px-5 py-3" open={part === "pre-conforme"}>
              <summary className="cursor-pointer list-none text-sm font-semibold text-foreground">Before the conforme <span className="font-normal text-muted-foreground">· inquiry and call notes</span></summary>
              <div className="pt-3"><PreConformeContextPanel eventId={selectedEvent.id} /></div>
            </details>
          ) : null}
        </div>
      ),
    },
    {
      id: "proposal",
      label: "Proposal",
      render: () => (
        <div className="space-y-8">
          {admin ? (
            <PlanningPart id="proposal">
              <PmcmProposalIssuerPanel eventId={selectedEvent.id} />
              <PresentationMeetingsPanel eventId={selectedEvent.id} />
              <PmcmProposalComments eventId={selectedEvent.id} />
            </PlanningPart>
          ) : null}
          <PlanningPart id="reviews">
            {admin && isEventModuleEnabled(selectedEvent, "venue_scouting") ? <VenueScoutingPanel eventId={selectedEvent.id} /> : null}
            {admin ? <ThemeSuggestionsPanel eventId={selectedEvent.id} /> : null}
            <PmcmClientReviewPanel eventId={selectedEvent.id} />
          </PlanningPart>
          {admin ? <PlanningPart id="follow-ups"><PmcmClientFollowUps eventId={selectedEvent.id} /></PlanningPart> : null}
        </div>
      ),
    },
    {
      id: "changes",
      label: "Changes",
      render: () => (
        <div className="space-y-8">
          <PlanningPart id="changes">
            <ChangeRegisterPanel eventId={selectedEvent.id} frozen={isScopeFrozen(selectedEvent.freezeStatus)} decisionClosedReason={eventDecisionClosedReason(selectedEvent)} />
          </PlanningPart>
          {admin ? <PlanningPart id="date-change"><DateImpactPanel eventId={selectedEvent.id} /></PlanningPart> : null}
        </div>
      ),
    },
    { id: "plan", label: "Plan", adminOnly: true, render: () => <EventPlanPanel eventId={selectedEvent.id} archived={selectedEvent.archived} /> },
    { id: "decisions", label: "Decision log", adminOnly: true, render: () => <DecisionLogPanel eventId={selectedEvent.id} /> },
  ];
  const tabs: WorkspaceSubTab[] = entries.filter((entry) => !entry.hidden && (admin || !entry.adminOnly)).map(({ adminOnly: _adminOnly, hidden: _hidden, ...tab }) => tab);
  const assistant = admin ? (
    <Sheet open={assistantOpen} onOpenChange={setAssistantOpen}>
      <SheetTrigger asChild>
        <Button type="button" variant="outline" size="sm"><Sparkles aria-hidden className="size-4" />Ask P.R.I.S.M</Button>
      </SheetTrigger>
      <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-xl">
        <SheetHeader>
          <SheetTitle>Ask P.R.I.S.M</SheetTitle>
          <SheetDescription>Questions about {selectedEvent.eventName}, answered from its records.</SheetDescription>
        </SheetHeader>
        <div className="px-4 pb-6"><OperationsAssistantPanel eventId={selectedEvent.id} /></div>
      </SheetContent>
    </Sheet>
  ) : null;
  return <WorkspaceSubTabs label="Planning sections" tabs={tabs} intro={assistant} selectedId={alias ?? part} onSelect={setPart} />;
}

/** Old supplier tabs, now sections of Services: links to them still land on it. */
export const SUPPLIER_PART_ALIASES: Record<string, string> = { quotes: "services", bookings: "services", emergency: "services" };

/**
 * An event's suppliers in three tabs: Services, from request and quotes to bookings and contracts (with replacing a
 * supplier folded under the bookings), Readiness (accreditation included when the event uses it), and outsourced
 * creative work.
 */
export function EventWorkspaceSuppliersTab() {
  const vm = useEventDashboardLoadedRouteViewModel();
  const [part, setPart] = useListFilter("part", "services");
  if (!vm.selectedEvent) return null;
  const event = vm.selectedEvent;
  const assigned = assignedSupplierRequests(vm.quoteRequests);
  const awaitingQuotes = vm.quoteRequests.filter((request) => !vm.quotes.some((quote) => quote.requestId === request.id)).length;
  const tabs: WorkspaceSubTab[] = [
    {
      id: "services",
      label: "Services",
      count: awaitingQuotes,
      attention: awaitingQuotes > 0,
      render: () => (
        <div className="space-y-8">
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
        <section id="supplier-bookings" aria-labelledby="supplier-bookings-title" className="scroll-mt-24 space-y-3">
          <h2 id="supplier-bookings-title" className="flex items-baseline gap-2 text-base font-semibold text-foreground">
            Bookings and contracts<span className="text-sm font-normal tabular-nums text-muted-foreground">{assigned.length}</span>
          </h2>
          <PmcmSupplierWorkflowsPanel eventId={event.id} requests={vm.quoteRequests} quotes={vm.quotes} />
          {assigned.length ? (
            <details className="rounded-lg border border-border bg-card px-5 py-3" open={part === "emergency"}>
              <summary className="cursor-pointer list-none text-sm font-semibold text-foreground">Replace a supplier <span className="font-normal text-muted-foreground">· if a booked supplier drops out</span></summary>
              <div className="pt-3">
                <PAREPanel eventId={event.id} assignedRequests={assigned} suppliers={vm.suppliers} onWithdraw={vm.withdrawSupplier} busy={Boolean(vm.busy)} />
              </div>
            </details>
          ) : null}
        </section>
        </div>
      ),
    },
    { id: "readiness", label: "Readiness", render: () => <div className="space-y-5"><UnresponsiveSuppliersPanel eventId={event.id} />{isEventModuleEnabled(event, "client_owned_suppliers") ? <ClientOwnedSuppliersPanel eventId={event.id} /> : null}<PmcmSupplierGapWarning eventId={event.id} refreshKey={supplierReadinessRefreshKey(vm.quoteRequests)} /><PmcmSupplierReadinessBoard eventId={event.id} refreshKey={supplierReadinessRefreshKey(vm.quoteRequests)} /><SupplierFileReadiness eventId={event.id} />{isPmcmAdmin(vm.session.role) && isEventModuleEnabled(event, "accreditation") ? <AccreditationPanel eventId={event.id} /> : null}</div> },
    { id: "creative", label: "Outsourced creative", render: () => <PmcmExternalCreativePanel eventId={event.id} documents={vm.documents.filter((document) => document.eventId === event.id)} /> },
  ];
  return <WorkspaceSubTabs label="Supplier sections" tabs={tabs} selectedId={SUPPLIER_PART_ALIASES[part] ?? part} onSelect={setPart} />;
}

export function EventWorkspaceCoordinatorsTab() {
  const vm = useEventDashboardLoadedRouteViewModel();
  const [part, setPart] = useListFilter("part", "assignments");
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
            assignments={vm.reference.coordinatorAssignments}
            roleRequirements={vm.coordinatorRoleRequirements}
            busy={Boolean(vm.busy)}
            onAssign={vm.assignCoordinator}
            onChangeRole={vm.changeCoordinatorRole}
            onLoadSuggestions={vm.loadCoordinatorSuggestions}
            onLoadPoolAvailability={vm.loadCoordinatorPoolAvailability}
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
    { id: "role-briefs", label: "Role briefs", render: () => <PmcmRoleBriefEditor eventId={event.id} /> },
  ];
  // Replacing a coordinator and planning for a moved date are occasional jobs: they fold under the assignments.
  const occasional = (
    <div className="mt-5 space-y-3">
      {isPmcmAdmin(vm.session.role) ? (
        <details id="team-emergency-replacements" className="rounded-lg border border-border bg-card px-5 py-3" open={part === "emergency-replacements"}>
          <summary className="cursor-pointer list-none text-sm font-semibold text-foreground">Replace a coordinator <span className="font-normal text-muted-foreground">· if someone drops out</span></summary>
          <div className="pt-3"><CoordinatorReplacementPanel eventId={event.id} /></div>
        </details>
      ) : null}
      <details id="team-postponement" className="rounded-lg border border-border bg-card px-5 py-3" open={part === "postponement"}>
        <summary className="cursor-pointer list-none text-sm font-semibold text-foreground">If the date moves <span className="font-normal text-muted-foreground">· venue confirmations and who is still free</span></summary>
        <div className="space-y-5 pt-3"><VenueConfirmationsPanel eventId={event.id} /><PostponementImpactPanel eventId={event.id} /></div>
      </details>
    </div>
  );
  const withOccasional = tabs.map((tab) => (tab.id === "assignments" ? { ...tab, render: () => <>{tab.render()}{occasional}</> } : tab));
  const selected = part === "emergency-replacements" || part === "postponement" ? "assignments" : part;
  return <WorkspaceSubTabs label="Team sections" tabs={withOccasional} selectedId={selected} onSelect={setPart} />;
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
          onBlockTask={vm.blockEventDayTask}
          onUnblockTask={vm.unblockEventDayTask}
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
    ...(isPmcmAdmin(vm.session.role) ? [{ id: "copilot", label: "Copilot", render: () => <EventDayCopilotPanel eventId={event.id} /> }] : []),
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
        <BillingSourcesTab
          eventId={event.id}
          eventName={event.eventName}
          billingSources={vm.billingSources}
          statements={vm.billingStatements}
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
      render: () => <BillingAdjustmentsPanel eventId={event.id} statements={vm.billingStatements} billingSources={vm.billingSources} payments={vm.payments} urgentIssues={vm.liveOps?.urgentIssues ?? []} />,
    },
  ];
  return <WorkspaceSubTabs label="Billing sections" tabs={tabs} />;
}

export function EventWorkspaceClosureTab() {
  const vm = useEventDashboardLoadedRouteViewModel();
  const [closurePart, setClosurePart] = useListFilter("part", "wrap-up");
  if (!vm.selectedEvent) return null;
  const event = vm.selectedEvent;
  const closureStep = (step: ClosureStep) => (
    <Phase4Workspace
      step={step}
      onOpenDestination={(destination: CloseGateDestination) => {
        if (destination.kind === "closure-tab") setClosurePart(destination.tabId);
        else vm.navigateEventTab(destination.tab);
      }}
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
  );
  // Closure in the order it happens; each step is one screen. Deliverables gate Archive, so it sits before it.
  const panels: Record<ClosureTabId, Omit<WorkspaceSubTab, "id" | "label">> = {
    "wrap-up": { render: () => closureStep("wrap-up") },
    feedback: {
      render: () => (
        <div className="space-y-5">
          {closureStep("feedback")}
          <FeedbackModerationPanel eventId={event.id} />
        </div>
      ),
    },
    compliance: { count: vm.openCheckCount, attention: vm.openCheckCount > 0, render: () => closureStep("compliance") },
    deliverables: {
      count: vm.postEventDocuments.length,
      render: () => <PostEventDeliverablesPanel eventId={event.id} documents={vm.postEventDocuments} archived={event.archived} actualEndedAt={event.actualEndedAt ?? null} />,
    },
    archive: { render: () => closureStep("archive") },
  };
  const tabs: WorkspaceSubTab[] = CLOSURE_TABS.map((tab) => ({ id: tab.id, label: tab.label, ...panels[tab.id] }));
  return <WorkspaceSubTabs label="Closure steps" tabs={tabs} selectedId={closurePart} onSelect={setClosurePart} />;
}

/** PMCM-only (FL-019). Other roles get no panel here, and the API refuses them independently. */
export function EventWorkspaceDecisionsTab() {
  const vm = useEventDashboardLoadedRouteViewModel();
  if (!vm.selectedEvent) return null;
  if (!isPmcmAdmin(vm.session.role)) {
    return <Empty><EmptyHeader><EmptyMedia variant="icon"><Gavel /></EmptyMedia><EmptyTitle>Decision log is PMCM-only</EmptyTitle><EmptyDescription>Overrides, approvals, and scope decisions are visible to PMCM administrators.</EmptyDescription></EmptyHeader></Empty>;
  }
  return <DecisionLogPanel eventId={vm.selectedEvent.id} />;
}

export function EventWorkspaceMessagesTab() {
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
          eventDate={event.eventDate}
          platform={vm.registrationPlatform}
          suppliers={vm.suppliers}
          busy={Boolean(vm.busy)}
          loadError={vm.commandDataErrors.registrationPlatform}
          onUpsert={vm.upsertRegistrationPlatform}
          onUpdate={vm.updateRegistrationPlatform}
          onUpdateSetup={vm.updateRegistrationPlatformSetup}
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
    ...(isEventModuleEnabled(event, "games") ? [{
      id: "games",
      label: "Games",
      render: () => (
        <EventGamesHostView eventId={event.id} role={vm.session.role} eventStatus={event.status} archived={event.archived} actualEndedAt={event.actualEndedAt} />
      ),
    }] : []),
  ];
  return <WorkspaceSubTabs label="Registration and games" tabs={tabs} defaultId={initial} />;
}

export function EventWorkspaceRegistrationTab() {
  return <RegistrationAndGames initial="registration" />;
}

export function EventWorkspaceGamesTab() {
  return <RegistrationAndGames initial="games" />;
}
