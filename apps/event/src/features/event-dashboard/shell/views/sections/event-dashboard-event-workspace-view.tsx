"use client";

import { Card, CardBody, CardHeader } from "./shell-ui";
import { humanizeToken } from "@/features/pmcm-kit/model/formatters";
import {
  AlertTriangle,
  FileCheck2,
  LayoutGrid,
  MapPinned,
  Truck,
} from "lucide-react";
import { Button } from "@/app/components/ui/button";
import { StatusBadge } from "@/app/components/ui/status-badge";
import { EmptyState } from "@/app/components/ui/empty-state";
import { PAREPanel } from "@/features/pare/panel";
import { Phase4Workspace } from "@/features/closure/phase4";
import { CoordinatorAssignmentDesk } from "@/features/coordinators/desk";
import { EventOverviewPanels } from "@/features/command-inbox/list";
import { FinancialWorkspace } from "@/features/finance/workspace";
import { LiveOperationsWorkspace } from "@/features/live-ops/workspace";
import { SupplierQuotePlanner } from "@/features/suppliers/directory";
import { EventMessagesWorkspace } from "@/app/(portal)/dashboard/components/event-messages-workspace";
import { useEventDashboardLoadedRouteViewModel } from "../event-dashboard-route-context";
export function EventDashboardEventWorkspaceView() {
  const {
    selectedEvent,
    tab,
    submitBriefing,
    navigateEventTab,
    defenseReadiness,
    drafts,
    activeDraft,
    quoteRequests,
    quotes,
    openCheckCount,
    runPlanningCompliance,
    floorPlanTemplates,
    run,
    createTemplateDraft,
    openEditor,
    submitFloorPlanDraft,
    approveFloorPlanDraft,
    briefing,
    supplierCategories,
    suppliers,
    requestSupplierQuotes,
    selectSupplierQuote,
    withdrawSupplier,
    busy,
    coordinators,
    state,
    coordinatorRoleRequirements,
    assignCoordinator,
    liveOps,
    statusFeed,
    loadLiveOps,
    createEventDayTask,
    updateEventDayTask,
    escalateEventDayTask,
    createUrgentIssue,
    updateUrgentIssue,
    escalateUrgentIssue,
    updateCoordinatorAttendance,
    replaceCoordinator,
    verifySupplierStatus,
    selectedInquiry,
    billingStatements,
    payments,
    notificationLogs,
    recordPayment,
    sendBillingStatement,
    complianceRules,
    checks,
    billingSources,
    eventInsights,
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
    session,
    audit,
  } = useEventDashboardLoadedRouteViewModel();
  return (

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
  );
}
