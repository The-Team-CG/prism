"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useClientSharedFloorplanSnapshotViewModel } from "../view-models/use-client-shared-floorplans-view-model";

const EditorShell = dynamic(
  () => import("@/features/floorplan/editor").then((module) => module.EditorShell),
  {
    ssr: false,
    loading: () => (
      <div className="grid size-full place-items-center bg-background text-sm text-muted-foreground">
        Loading floorplan view…
      </div>
    ),
  },
);

export function ClientSharedFloorplanSnapshotView({
  eventId,
  draftId,
  snapshotType,
}: {
  eventId: string;
  draftId: string;
  snapshotType: string;
}) {
  const router = useRouter();
  const vm = useClientSharedFloorplanSnapshotViewModel(eventId, draftId, snapshotType);

  if (vm.project && vm.entry) {
    return (
      <main className="h-screen w-full overflow-hidden bg-background">
        <EditorShell
          project={vm.project}
          eventName={vm.entry.eventName}
          draftName={vm.entry.draftName}
          draftStatus={vm.entry.draftStatus}
          readOnly
          onBack={() => router.push("/dashboard/shared-floorplans")}
        />
      </main>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <main className="px-5 py-8 md:px-10">
        <div className="mx-auto max-w-4xl">
          <Link
            href="/dashboard/shared-floorplans"
            className="text-sm font-medium text-primary hover:text-primary/80"
          >
            Back to shared floorplans
          </Link>
          <h1 className="mt-4 text-2xl font-bold">Shared floorplan snapshot</h1>
          {vm.loading ? (
            <p role="status" className="mt-4 text-sm text-muted-foreground">Loading floorplan snapshot…</p>
          ) : vm.error ? (
            <p role="alert" className="mt-4 rounded-lg border border-border bg-card p-4 text-sm text-destructive">
              {vm.error}
            </p>
          ) : null}
        </div>
      </main>
    </div>
  );
}
