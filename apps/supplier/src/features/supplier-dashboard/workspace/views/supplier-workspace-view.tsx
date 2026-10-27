"use client";

import { RefreshCcw } from "lucide-react";
import { Badge } from "@/app/components/ui/badge";
import { Button } from "@/app/components/ui/button";
import { PrismDashboardShell } from "@prism/ui";
import { useSupplierWorkspaceViewModel } from "../view-models/use-supplier-workspace-view-model";
import { supplierCommandActions, supplierMobileActions, supplierNavItems } from "../model/supplier-workspace-nav";
import { SupplierWorkspaceBanners, SupplierWorkspaceLoading, SupplierWorkspaceSkeleton, SupplierWrongPortalView } from "./sections/supplier-workspace-states";
import { SupplierWorkspaceSection } from "./sections/supplier-workspace-section";

export function SupplierWorkspaceView() {
  const vm = useSupplierWorkspaceViewModel();
  const { session, workspace, readinessBoard, section, setSection, error, notice, busy, derived, meta } = vm;

  if (!session) return <SupplierWorkspaceLoading />;
  if (session.role !== "supplier") return <SupplierWrongPortalView onSignIn={vm.goToSignIn} />;
  if (!meta) return <SupplierWorkspaceLoading />;
  const loading = !workspace && !error;

  const {
    quoteByRequest,
    openRequests,
    selectedRequests,
    selectedQuotes,
    quoteNeedingSubmission,
    handoffPending,
    readinessNeedsActionCount,
    needsActionCount,
    eventsThisMonth,
  } = derived;

  return (
    <PrismDashboardShell
      portal="supplier"
      roleLabel="Supplier portal"
      eyebrow={meta.eyebrow}
      title={meta.title}
      description={meta.description}
      activeItemId={section}
      navItems={supplierNavItems({
        needsActionCount,
        openRequestCount: openRequests.length,
        handoffPending,
      })}
      sidebarMode="single"
      onNavSelect={(id) => setSection(id as typeof section)}
      user={{ name: session.name, detail: session.organization, initials: session.name.slice(0, 2).toUpperCase() }}
      searchPlaceholder="Search quotes, requests…"
      commandActions={supplierCommandActions({
        quoteNeedingSubmission,
        openRequestCount: openRequests.length,
        handoffPending,
        readinessInfoCount: readinessBoard ? readinessBoard.counts.info : null,
        readinessNeedsActionCount,
        onNavigate: setSection,
      })}
      onSignOut={() => void vm.signOut()}
      headerActions={
        <>
          <Button variant="outline" size="icon" disabled={busy === "refresh"} onClick={() => void vm.refresh()} className="size-9 rounded-xl" aria-label="Refresh">
            <RefreshCcw className="size-3.5" />
          </Button>
          <Badge variant="outline" className="hidden h-9 rounded-xl border-success/25 bg-success/8 px-3 text-success sm:inline-flex">
            Approved
          </Badge>
        </>
      }
      mobileActions={supplierMobileActions(section, setSection, () => void vm.signOut())}
      >
      {loading ? (
        <SupplierWorkspaceSkeleton />
      ) : (
      <div className="space-y-5">
        <SupplierWorkspaceBanners error={error} notice={notice} />
        <SupplierWorkspaceSection
          section={section}
          session={session}
          workspace={workspace}
          workflowWorkspace={vm.workflowWorkspace}
          error={error}
          quoteByRequest={quoteByRequest}
          openRequests={openRequests}
          selectedRequests={selectedRequests}
          selectedQuotes={selectedQuotes}
          quoteNeedingSubmission={quoteNeedingSubmission}
          handoffPending={handoffPending}
          needsActionCount={needsActionCount}
          eventsThisMonth={eventsThisMonth}
          readinessBoard={readinessBoard}
          forms={vm.forms}
          busy={busy}
          readinessNotes={vm.readinessNotes}
          statusNotes={vm.statusNotes}
          onNavigate={setSection}
          onUpdateForm={vm.updateForm}
          onSubmitQuote={vm.submitQuote}
          onReadinessNoteChange={vm.setReadinessNote}
          onStatusNoteChange={vm.setStatusNote}
          onConfirmAssignment={(req) => void vm.confirmAssignment(req)}
          onConfirmReadiness={(req) => void vm.confirmReadiness(req)}
          onSaveContract={(req, file) => void vm.saveContract(req, file)}
          onUpdateStatus={(req, status) => void vm.updateStatus(req, status)}
          onAcknowledgeSchedule={(requestId, revision) => void vm.acknowledgeSchedule(requestId, revision)}
          onRequestScheduleChange={(requestId, revision, reason) => void vm.requestScheduleChange(requestId, revision, reason)}
          onUpdateProgress={(taskId, note) => void vm.updateCreativeProgress(taskId, note)}
          onSubmitCreativeTask={(requestId, taskId, note, file) => void vm.submitCreativeTask(requestId, taskId, note, file)}
          onDownloadObject={(objectId) => void vm.downloadObject(objectId)}
        />
      </div>
      )}
    </PrismDashboardShell>
  );
}
