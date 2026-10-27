"use client";

import type { ReactNode } from "react";
import { EventWorkspaceSwitcher } from "./event-workspace-switcher";
import { PrismDashboardShell } from "@prism/ui";
import { Alert, AlertDescription } from "@/app/components/ui/alert";
import { ConformeUploadModal } from "@/features/conforme/upload";
import { humanizeToken } from "@/features/pmcm-kit/model/formatters";
import { supplierWorkspaceStyles } from "@/features/suppliers/directory";
import { EventDashboardSkeleton, eventDashboardSkeletonVariant } from "@/app/(portal)/dashboard/components/event-dashboard-skeleton";
import type { EventSession } from "@/app/lib/session";
import type { EventDashboardShellViewModel } from "../../view-models/use-event-dashboard-shell-view-model";

type LoadedShell = EventDashboardShellViewModel & {
  session: EventSession;
};

export function EventPmcmLoadingShell({ viewModel }: { viewModel: LoadedShell }) {
  const loadingVariant = eventDashboardSkeletonVariant(viewModel.routeState);
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
      user={{ name: viewModel.session.name, detail: humanizeToken(viewModel.session.role), initials: viewModel.session.name.slice(0, 2).toUpperCase() }}
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
  return (
    <PrismDashboardShell
      portal="event"
      className={viewModel.section === "suppliers" ? supplierWorkspaceStyles.shell : undefined}
      contentClassName={viewModel.section === "suppliers" ? "max-w-none p-0 sm:p-0" : undefined}
      productLabel="P.R.I.S.M"
      roleLabel="PMCM Event Command"
      eyebrow={viewModel.shellCopy.eyebrow}
      title={viewModel.shellCopy.title}
      description={viewModel.shellCopy.description}
      activeItemId={viewModel.sidebarActiveOverride ?? viewModel.activeSidebarItemId}
      navItems={viewModel.shellNavItems}
      sidebarMode="single"
      onNavSelect={viewModel.handleSidebarNav}
      user={{ name: viewModel.session.name, detail: humanizeToken(viewModel.session.role), initials: viewModel.session.name.slice(0, 2).toUpperCase() }}
      searchPlaceholder="Find a page"
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
