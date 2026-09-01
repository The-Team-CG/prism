"use client";

import type { ReactNode } from "react";
import { Alert, AlertDescription } from "@/app/components/ui/alert";
import type { EventDashboardShellViewModel } from "../view-models/use-event-dashboard-shell-view-model";
import { EventDashboardRouteProvider } from "./event-dashboard-route-context";

export function EventDashboardRouteContentView({
  viewModel,
  children,
}: {
  viewModel: EventDashboardShellViewModel;
  children: ReactNode;
}) {
  return (
    <EventDashboardRouteProvider viewModel={viewModel}>
      <div className="space-y-5">
        {viewModel.error && (
          <Alert variant="destructive" className="rounded-xl">
            <AlertDescription>{viewModel.error}</AlertDescription>
          </Alert>
        )}
        {children}
      </div>
    </EventDashboardRouteProvider>
  );
}
