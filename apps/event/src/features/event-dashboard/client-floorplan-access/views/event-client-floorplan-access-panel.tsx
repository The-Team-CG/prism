"use client";

import { useState } from "react";
import { useClientFloorplanAccessViewModel } from "../view-models/use-client-floorplan-access-view-model";

export function EventClientFloorplanAccessPanel({
  eventId,
}: {
  eventId: string;
}) {
  const vm = useClientFloorplanAccessViewModel(eventId);
  const [query, setQuery] = useState("");

  return (
    <section aria-labelledby="client-floorplan-access-title" className="rounded-xl border border-border bg-card p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 id="client-floorplan-access-title" className="text-lg font-bold text-foreground">
            Shared floorplan access
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Manage approved Client accounts that can view this event’s submitted and approved floorplan snapshots.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void vm.reload()}
          disabled={vm.loading}
          className="rounded-md border border-border px-3 py-2 text-sm font-semibold text-foreground disabled:opacity-50"
        >
          {vm.loading ? "Refreshing…" : "Refresh"}
        </button>
      </div>

      {vm.error ? <p role="alert" className="mt-3 text-sm text-destructive">{vm.error}</p> : null}

      {vm.loading && !vm.access ? (
        <p role="status" className="mt-4 text-sm text-muted-foreground">Loading floorplan access…</p>
      ) : vm.access ? (
        <>
          <div className="mt-4 rounded-lg border border-border bg-background p-3">
            <p className="text-sm font-semibold text-foreground">
              {vm.access.primaryContact.name || vm.access.primaryContact.email}
              <span className="ml-2 font-normal text-muted-foreground">Primary inquiry contact · always has access</span>
            </p>
            <p className="mt-1 text-xs text-muted-foreground">{vm.access.primaryContact.email}</p>
          </div>

          <div className="mt-4">
            <h3 className="text-sm font-bold text-foreground">Secondary contacts</h3>
            {vm.access.secondaryContacts.length ? (
              <ul className="mt-2 divide-y divide-border rounded-lg border border-border">
                {vm.access.secondaryContacts.map((contact) => (
                  <li key={contact.id} className="flex flex-wrap items-center justify-between gap-3 p-3">
                    <div>
                      <p className="text-sm font-semibold text-foreground">{contact.name}</p>
                      <p className="text-xs text-muted-foreground">{contact.email}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => void vm.revoke(contact.id)}
                      disabled={Boolean(vm.busyUserId)}
                      className="rounded-md border border-border px-3 py-2 text-sm font-semibold text-foreground disabled:opacity-50"
                    >
                      {vm.busyUserId === contact.id ? "Removing…" : "Remove access"}
                    </button>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-2 text-sm text-muted-foreground">No secondary contacts have access.</p>
            )}
          </div>

          <form
            className="mt-5 flex flex-col gap-2 sm:flex-row"
            onSubmit={(event) => {
              event.preventDefault();
              void vm.search(query);
            }}
          >
            <label htmlFor={`client-floorplan-access-search-${eventId}`} className="sr-only">
              Search approved Client accounts
            </label>
            <input
              id={`client-floorplan-access-search-${eventId}`}
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search approved Client accounts"
              className="h-10 min-w-0 flex-1 rounded-md border border-border bg-background px-3 text-sm text-foreground"
            />
            <button
              type="submit"
              disabled={vm.searching || !query.trim()}
              className="rounded-md bg-foreground px-4 py-2 text-sm font-bold text-background disabled:opacity-50"
            >
              {vm.searching ? "Searching…" : "Search"}
            </button>
          </form>

          {vm.candidates.length ? (
            <ul aria-label="Eligible Client accounts" className="mt-3 divide-y divide-border rounded-lg border border-border">
              {vm.candidates.map((candidate) => (
                <li key={candidate.id} className="flex flex-wrap items-center justify-between gap-3 p-3">
                  <div>
                    <p className="text-sm font-semibold text-foreground">{candidate.name}</p>
                    <p className="text-xs text-muted-foreground">{candidate.email}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => void vm.grant(candidate.id)}
                    disabled={Boolean(vm.busyUserId)}
                    className="rounded-md border border-border px-3 py-2 text-sm font-semibold text-foreground disabled:opacity-50"
                  >
                    {vm.busyUserId === candidate.id ? "Adding…" : "Grant access"}
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
        </>
      ) : (
        <p className="mt-4 text-sm text-muted-foreground">Floorplan access is unavailable.</p>
      )}
    </section>
  );
}
