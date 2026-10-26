"use client";

import { Alert, AlertDescription } from "@/app/components/ui/alert";
import {
  EventDashboardSkeleton,
  SkeletonCard,
  SkeletonLine,
} from "@/app/(portal)/dashboard/components/event-dashboard-skeleton";
import { CoordinatorView } from "@/features/coordinators/desk";
import type { EventSession } from "@/app/lib/session";
import type { EventDashboardShellViewModel } from "../../view-models/use-event-dashboard-shell-view-model";

export function EventCoordinatorShell({
  session,
  coordinatorState,
  error,
  refresh,
  signOut,
}: {
  session: EventSession;
  coordinatorState: EventDashboardShellViewModel["coordinatorState"];
  error: string | null;
  refresh: EventDashboardShellViewModel["refresh"];
  signOut: EventDashboardShellViewModel["signOut"];
}) {
  if (!coordinatorState) {
    return (
      <main className="grid min-h-screen place-items-center bg-background px-6">
        {error ? (
          <Alert variant="destructive" className="max-w-md rounded-xl"><AlertDescription>{error}</AlertDescription></Alert>
        ) : (
          <div className="w-full max-w-5xl">
            <SkeletonCard>
              <div className="flex items-center gap-3">
                <SkeletonLine className="size-10 rounded-md" />
                <div>
                  <SkeletonLine className="h-4 w-44 rounded-md" />
                  <SkeletonLine className="mt-2 h-3 w-64 rounded-md" />
                </div>
              </div>
            </SkeletonCard>
            <div className="mt-5">
              <EventDashboardSkeleton variant="coordinator" />
            </div>
          </div>
        )}
      </main>
    );
  }
  return (
    <CoordinatorView session={session} state={coordinatorState} onRefresh={() => refresh(session)} onSignOut={() => void signOut()} />
  );
}
