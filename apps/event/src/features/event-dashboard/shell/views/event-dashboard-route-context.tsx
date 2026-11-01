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

export type EventDashboardLoadedViewModel = Omit<EventDashboardShellViewModel, "session" | "state"> & {
  session: NonNullable<EventDashboardShellViewModel["session"]>;
  state: NonNullable<EventDashboardShellViewModel["state"]>;
};

export function useEventDashboardLoadedRouteViewModel(): EventDashboardLoadedViewModel {
  const viewModel = useEventDashboardRouteViewModel();
  if (!viewModel.session || !viewModel.state) {
    throw new Error("Loaded event dashboard content requires an authenticated workspace");
  }

  return {
    ...viewModel,
    session: viewModel.session,
    state: viewModel.state,
  };
}

export type EventDashboardEventViewModel = Omit<EventDashboardShellViewModel, "session" | "reference"> & {
  session: NonNullable<EventDashboardShellViewModel["session"]>;
  reference: NonNullable<EventDashboardShellViewModel["reference"]>;
};

/** For event pages: they render from the event's workspace plus the PMCM reference, never the whole dashboard. */
export function useEventDashboardEventRouteViewModel(): EventDashboardEventViewModel {
  const viewModel = useEventDashboardRouteViewModel();
  if (!viewModel.session || !viewModel.reference) {
    throw new Error("Event pages require an authenticated session and the PMCM reference");
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
