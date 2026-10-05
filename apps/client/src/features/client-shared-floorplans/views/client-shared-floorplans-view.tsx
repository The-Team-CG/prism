"use client";

import Link from "next/link";
import { clientSharedFloorplanSnapshotHref } from "../model/client-shared-floorplans";
import { useClientSharedFloorplansViewModel } from "../view-models/use-client-shared-floorplans-view-model";
import { ClientSharedFloorplansNavigation } from "./client-shared-floorplans-navigation";

const SNAPSHOT_LABELS = {
  submitted: "Submitted snapshot",
  approved: "Approved snapshot",
} as const;

export function ClientSharedFloorplansView() {
  const vm = useClientSharedFloorplansViewModel();

  return (
    <div className="flex min-h-screen bg-background text-foreground">
      <ClientSharedFloorplansNavigation />
      <main className="min-w-0 flex-1 px-5 py-8 md:px-10">
        <header className="mx-auto flex max-w-4xl flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-sm font-semibold text-muted-foreground">Client Portal</p>
            <h1 className="mt-1 text-2xl font-bold">Shared floorplans</h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
              Official floorplan snapshots shared with your account.
            </p>
          </div>
          <button
            type="button"
            onClick={vm.reload}
            disabled={vm.loading}
            className="rounded-md border border-border px-3 py-2 text-sm font-semibold disabled:opacity-50"
          >
            {vm.loading ? "Refreshing…" : "Refresh"}
          </button>
        </header>

        <section aria-label="Shared floorplan events" className="mx-auto mt-6 max-w-4xl">
          {vm.error ? <p role="alert" className="mb-4 text-sm text-destructive">{vm.error}</p> : null}
          {vm.loading && vm.entries.length === 0 ? (
            <p role="status" className="rounded-xl border border-border bg-card p-5 text-sm text-muted-foreground">
              Loading shared floorplans…
            </p>
          ) : vm.entries.length === 0 ? (
            <p className="rounded-xl border border-border bg-card p-5 text-sm text-muted-foreground">
              No floorplans are currently shared with your account.
            </p>
          ) : (
            <ul className="space-y-4">
              {vm.entries.map((entry) => (
                <li key={`${entry.eventId}:${entry.draftId}`} className="rounded-xl border border-border bg-card p-5">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <h2 className="text-lg font-bold">{entry.eventName}</h2>
                      <p className="mt-1 text-sm text-muted-foreground">
                        {entry.eventDate.slice(0, 10)} · {entry.draftName} · {entry.draftStatus}
                      </p>
                    </div>
                  </div>
                  <div className="mt-4 flex flex-wrap gap-2">
                    {entry.availableSnapshots.map((snapshotType) => (
                      <Link
                        key={snapshotType}
                        href={clientSharedFloorplanSnapshotHref(entry.eventId, entry.draftId, snapshotType)}
                        className="rounded-md border border-border px-3 py-2 text-sm font-semibold hover:bg-secondary"
                      >
                        Open {SNAPSHOT_LABELS[snapshotType]}
                      </Link>
                    ))}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      </main>
    </div>
  );
}
