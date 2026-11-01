"use client";

import { createContext, useContext, type ReactNode } from "react";
import type { EventDashboardShellViewModel } from "../view-models/use-event-dashboard-shell-view-model";

const EventDashboardRouteContext = createContext<EventDashboardShellViewModel | null>(null);

export function EventDashboardRouteProvider({
  viewModel,
  children,
}: {
  viewModel: EventDashboardShellViewModel;
  children: ReactNode;
}) {
  return <EventDashboardRouteContext.Provider value={viewModel}>{children}</EventDashboardRouteContext.Provider>;
}

export function useEventDashboardRouteViewModel() {
  const viewModel = useContext(EventDashboardRouteContext);
  if (!viewModel) throw new Error("Event dashboard route content must be rendered inside its provider");
  return viewModel;
}

export type EventDashboardLoadedViewModel = Omit<EventDashboardShellViewModel, "session" | "reference"> & {
  session: NonNullable<EventDashboardShellViewModel["session"]>;
  reference: NonNullable<EventDashboardShellViewModel["reference"]>;
};

/** For sections that render from the PMCM reference (event switcher, inquiries, people, directories, rules, balances). */
export function useEventDashboardLoadedRouteViewModel(): EventDashboardLoadedViewModel {
  const viewModel = useEventDashboardRouteViewModel();
  if (!viewModel.session || !viewModel.reference) {
    throw new Error("Loaded event dashboard content requires an authenticated session and the PMCM reference");
  }
  return { ...viewModel, session: viewModel.session, reference: viewModel.reference };
}

export type EventDashboardScopedViewModel = Omit<EventDashboardShellViewModel, "session"> & {
  session: NonNullable<EventDashboardShellViewModel["session"]>;
};

/** For sections that render from their own scoped reads and must not require the broad workspace state. */
export function useEventDashboardScopedRouteViewModel(): EventDashboardScopedViewModel {
  const viewModel = useEventDashboardRouteViewModel();
  if (!viewModel.session) throw new Error("Event dashboard content requires an authenticated session");
  return { ...viewModel, session: viewModel.session };
}
