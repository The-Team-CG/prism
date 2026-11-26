"use client";

import dynamic from "next/dynamic";
import { Alert, AlertDescription } from "@prism/ui/components/alert";
import { Button } from "@prism/ui/components/button";
import { EventDashboardSkeleton, SkeletonCard, SkeletonLine } from "@/app/(portal)/dashboard/components/event-dashboard-skeleton";
import { useCoordinatorHomePrefetch } from "../../desk/view-models/use-coordinator-home-prefetch";
import { useCoordinatorPortalViewModel } from "../view-models/use-coordinator-portal-view-model";

// The desk is the whole portal; loading it on its own keeps the PMCM dashboard out of the coordinator's download.
const CoordinatorView = dynamic(() => import("../../desk/views/coordinator-view").then((mod) => mod.CoordinatorView));

/** The coordinator portal at /coordinator: a skeleton while the assigned events load, then the desk. */
export function CoordinatorPortalView() {
  const vm = useCoordinatorPortalViewModel();
  useCoordinatorHomePrefetch();
  if (vm.workspace && vm.session) {
    return <CoordinatorView session={vm.session} state={vm.workspace} onRefresh={vm.refresh} onSignOut={() => void vm.signOut()} />;
  }
  return (
    <main className="grid min-h-screen place-items-center bg-background px-6">
      {vm.status === "error" ? (
        <Alert variant="destructive" className="max-w-md rounded-lg">
          <AlertDescription className="grid gap-3">
            <span>{vm.error}</span>
            <Button type="button" size="sm" variant="outline" className="w-fit" onClick={() => void vm.refresh()}>Try again</Button>
          </AlertDescription>
        </Alert>
      ) : (
        <div className="w-full max-w-5xl" aria-busy="true" aria-label="Loading your coordinator desk">
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
