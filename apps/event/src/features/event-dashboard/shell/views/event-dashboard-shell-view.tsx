"use client";

import type { ReactNode } from "react";
import { isUnsupportedEventPortalRole } from "../model/event-dashboard-shell-copy";
import {
  EventDashboardSessionSkeleton,
} from "@/app/(portal)/dashboard/components/event-dashboard-skeleton";
import { sectionNeedsPmcmWorkspaceState, type EventDashboardClientProps } from "../model/event-dashboard-routing";
import type { EventDashboardShellViewModel } from "../view-models/use-event-dashboard-shell-view-model";
import { EventWrongPortalView } from "./sections/event-wrong-portal-view";
import { EventDashboardEditorScreen } from "./sections/event-dashboard-editor-screen";
import { EventCoordinatorShell } from "./sections/event-coordinator-shell";
import { EventPmcmLoadingShell, EventPmcmReadyShell } from "./sections/event-pmcm-shells";
export type { EventDashboardClientProps };

export type EventDashboardShellViewProps = {
  viewModel: EventDashboardShellViewModel;
  children?: ReactNode;
};

export function EventDashboardShellView({ viewModel, children }: EventDashboardShellViewProps) {
  const { session, screen } = viewModel;
  if (!session) {
    return <EventDashboardSessionSkeleton />;
  }
  if (isUnsupportedEventPortalRole(session.role)) {
    return <EventWrongPortalView session={session} onSignOut={() => void viewModel.signOut()} />;
  }
  if (screen.name === "editor") {
    return (
      <EventDashboardEditorScreen
        session={session}
        screen={screen}
        saveEditorPlan={viewModel.saveEditorPlan}
        submitEditorPlan={viewModel.submitEditorPlan}
        closeEditor={viewModel.closeEditor}
      />
    );
  }
  if (session.role === "coordinator") {
    return (
      <EventCoordinatorShell
        session={session}
        coordinatorState={viewModel.coordinatorState}
        error={viewModel.error}
        refresh={viewModel.refresh}
        signOut={viewModel.signOut}
      />
    );
  }
  // Gate on the section this page renders, not the in-flight sidebar selection: the sidebar updates
  // `section` before the router swaps pages, and the outgoing page's content still needs its data.
  if (!viewModel.state && sectionNeedsPmcmWorkspaceState(viewModel.routeState.section)) {
    return <EventPmcmLoadingShell viewModel={{ ...viewModel, session }} />;
  }
  return (
    <EventPmcmReadyShell viewModel={{ ...viewModel, session }}>
      {children}
    </EventPmcmReadyShell>
  );
}
