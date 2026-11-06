"use client";

import { useMemo, type ReactNode } from "react";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { EventWorkspaceSwitcher } from "./event-workspace-switcher";
import { PrismDashboardShell } from "@prism/ui";
import { buildPmcmCommandGroups, inquiryLogHref } from "../../model/event-command-index";
import { Alert, AlertDescription } from "@/app/components/ui/alert";
import { roleLabel } from "@/features/pmcm-kit/model/display-labels";
import { supplierWorkspaceStyles } from "@/features/suppliers/directory";
import { EventDashboardSkeleton, eventDashboardSkeletonVariant } from "@/app/(portal)/dashboard/components/event-dashboard-skeleton";
import { useDocumentTitle } from "@/app/components/document-title";
import type { EventSession } from "@/app/lib/session";
import type { EventDashboardShellViewModel } from "../../view-models/use-event-dashboard-shell-view-model";
import { pageDocumentTitle } from "../../model/event-dashboard-routing";

// Opened only when PMCM attaches a conforme, so it loads on demand rather than with every page.
const ConformeUploadModal = dynamic(() =>
  import("@/features/conforme/upload/views/conforme-upload-modal").then((mod) => mod.ConformeUploadModal),
);

type LoadedShell = EventDashboardShellViewModel & {
  session: EventSession;
};

export function EventPmcmLoadingShell({ viewModel }: { viewModel: LoadedShell }) {
  const loadingVariant = eventDashboardSkeletonVariant(viewModel.routeState);
  useDocumentTitle(pageDocumentTitle([viewModel.loadingShellCopy.title]));
  return (
    <PrismDashboardShell
      portal="event"
      productLabel="P.R.I.S.M"
      roleLabel="PMCM Event Command"
      eyebrow={viewModel.loadingShellCopy.eyebrow}
      title={viewModel.loadingShellCopy.title}
      description="Loading the PMCM event command data, route context, and workspace queue."
      activeItemId={viewModel.activeSidebarItemId}
      navItems={viewModel.loadingShellNavItems}
      sidebarMode="single"
      onNavSelect={viewModel.handleSidebarNav}
      user={{ name: viewModel.session.name, detail: roleLabel(viewModel.session.role), initials: viewModel.session.name.slice(0, 2).toUpperCase() }}
      searchPlaceholder="Search events, suppliers, inquiries..."
      showTopBarSearch={false}
      onSignOut={() => void viewModel.signOut()}
    >
      {viewModel.error ? (
        <Alert variant="destructive" className="max-w-md rounded-xl"><AlertDescription>{viewModel.error}</AlertDescription></Alert>
      ) : (
        <EventDashboardSkeleton variant={loadingVariant} />
      )}
    </PrismDashboardShell>
  );
}

export function EventPmcmReadyShell({ viewModel, children }: { viewModel: LoadedShell; children?: ReactNode }) {
  const router = useRouter();
  const { events, clientRecords, inquiries, navigateEvent, navigateClient } = viewModel;
  const commandGroups = useMemo(
    () => buildPmcmCommandGroups(
      { events, clients: clientRecords, inquiries },
      { openEvent: navigateEvent, openClient: navigateClient, openInquiry: (inquiry) => router.push(inquiryLogHref(inquiry)) },
    ),
    [clientRecords, events, inquiries, navigateClient, navigateEvent, router],
  );
  useDocumentTitle(viewModel.shellCopy.documentTitle);
  return (
    <PrismDashboardShell
      portal="event"
      className={viewModel.section === "suppliers" ? supplierWorkspaceStyles.shell : undefined}
      contentClassName={viewModel.section === "suppliers" ? "max-w-none p-0 sm:p-0" : undefined}
      titleClassName={viewModel.section === "suppliers" ? "px-4 pt-6 sm:px-6 lg:px-8" : undefined}
      productLabel="P.R.I.S.M"
      roleLabel="PMCM Event Command"
      eyebrow={viewModel.shellCopy.eyebrow}
      title={viewModel.shellCopy.title}
      description={viewModel.shellCopy.description}
      breadcrumb={viewModel.shellCopy.breadcrumb}
      activeItemId={viewModel.sidebarActiveOverride ?? viewModel.activeSidebarItemId}
      navItems={viewModel.shellNavItems}
      sidebarMode="single"
      onNavSelect={viewModel.handleSidebarNav}
      user={{ name: viewModel.session.name, detail: roleLabel(viewModel.session.role), initials: viewModel.session.name.slice(0, 2).toUpperCase() }}
      searchPlaceholder="Find events, clients or pages"
      commandGroups={commandGroups}
      commandGroupsLoading={viewModel.commandReferenceLoading}
      onCommandPaletteOpen={viewModel.loadCommandReference}
      commandEmptyLabel="Nothing matches. Try an event or client name."
      sidebarContext={
        viewModel.routeState.eventId && viewModel.selectedEvent ? (
          <EventWorkspaceSwitcher events={viewModel.events} selected={viewModel.selectedEvent} view={viewModel.routeState.view} />
        ) : null
      }
      onSignOut={() => void viewModel.signOut()}
    >
      {children}
      {viewModel.conformeUploadTarget ? (
        <ConformeUploadModal
          inquiry={viewModel.conformeUploadTarget}
          onUpload={viewModel.uploadConforme}
          onPrepareDigital={viewModel.prepareConformeSigning}
          onRefreshDigital={viewModel.refreshConformeSigning}
          onSignDigital={viewModel.countersignConforme}
          onClose={viewModel.closeConformeUpload}
        />
      ) : null}
    </PrismDashboardShell>
  );
}
