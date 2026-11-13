"use client";

import { Search } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@prism/ui/components/dialog";
import { LoadingState } from "@prism/ui/components/loading-state";
import { formatPortalDate } from "@prism/ui/format-date";
import { clientFileExpiry, formatFileSize, type ClientLibraryFile } from "../model/client-file-library";
import type { ClientFileLibraryViewModel } from "../view-models/use-client-file-library-view-model";
import { ClientFileKindIcon } from "./client-file-kind-icon";

/** One file the client could send again; an expired document can't be, so it says so instead. */
function ReuseCandidate({ file, vm }: { file: ClientLibraryFile; vm: ClientFileLibraryViewModel }) {
  const expiry = clientFileExpiry(file.expiresAt);
  const details = [file.eventName, file.addedAt ? formatPortalDate(file.addedAt) : null, formatFileSize(file.size)].filter(Boolean).join(" · ");
  return (
    <li>
      <button
        type="button"
        onClick={() => void vm.reuseFile(file)}
        disabled={vm.busy || Boolean(expiry?.expired)}
        className="flex w-full items-center gap-3 rounded-md px-2 py-2 text-left hover:bg-muted disabled:cursor-not-allowed disabled:opacity-60"
      >
        <ClientFileKindIcon kind={file.kind} />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-medium text-foreground">{file.name}</span>
          <span className="block truncate text-xs text-muted-foreground">{details}</span>
          {expiry && expiry.tone !== "neutral" ? (
            <span className={expiry.expired ? "block text-xs text-danger" : "block text-xs text-attention"}>
              {expiry.expired ? `${expiry.label}. Upload a current one instead.` : expiry.label}
            </span>
          ) : null}
        </span>
      </button>
    </li>
  );
}

/**
 * Picks a file the client already has on another event and sends a copy for one of this event's requirements,
 * so recurring documents (permits, company papers, brand kits) don't have to be found and uploaded again.
 */
export function ClientFileReuseDialog({ vm }: { vm: ClientFileLibraryViewModel }) {
  const target = vm.reuseTarget;
  const query = vm.reuseQuery;
  const candidates = vm.reuseCandidates;
  return (
    <Dialog open={Boolean(target)} onOpenChange={(open) => { if (!open) vm.closeReuse(); }}>
      <DialogContent className="max-h-[85vh] gap-3 overflow-hidden sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Use a file from another event</DialogTitle>
          <DialogDescription>
            A copy is sent for {target?.label ?? "this requirement"}. The original stays with its event.
          </DialogDescription>
        </DialogHeader>
        <label className="relative block">
          <span className="sr-only">Search your files</span>
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
          <input
            type="search"
            value={query}
            onChange={(event) => vm.setReuseQuery(event.currentTarget.value)}
            placeholder="Search your files"
            className="h-9 w-full rounded-md border border-border bg-background pl-9 pr-3 text-sm text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
        </label>
        <div className="-mx-2 min-h-24 overflow-y-auto">
          {vm.reuseLoading ? (
            <LoadingState label="Loading your files…" className="px-2 py-4" />
          ) : candidates.length === 0 ? (
            <p className="px-2 py-4 text-sm text-muted-foreground">{query ? "No files match your search." : "Your other events don't have files yet."}</p>
          ) : (
            <ul className="space-y-0.5">
              {candidates.map((file) => <ReuseCandidate key={`${file.eventId}:${file.id}`} file={file} vm={vm} />)}
            </ul>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
