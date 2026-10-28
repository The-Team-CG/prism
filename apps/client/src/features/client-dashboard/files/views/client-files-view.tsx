"use client";
import { formatPortalDateTime } from "@prism/ui/format-date";

import { FileText } from "lucide-react";
import { EmptyState } from "@/app/components/ui/empty-state";
import { StatusBadge } from "@/app/components/ui/status-badge";
import { formatStatusLabel, useClientWorkspace } from "../../workspace/shared";
import { ClientAccountEventPicker } from "../../workspace/views/sections/client-account-event-picker";
import { CLIENT_PORTAL_VIEW_META } from "../../workspace/shared";
import { filterClientFiles } from "../model/client-file-category";

export function ClientFilesView() {
  const { state, events, portalView } = useClientWorkspace();
  if (!state) return null;

  const eventNames = new Map(events.map((event) => [event.id, event.eventName]));
  const scoped = filterClientFiles(state.documents.filter((document) => eventNames.has(document.eventId)), portalView);
  const files = scoped.documents;
  const viewTitle = portalView && portalView !== "files-all" ? CLIENT_PORTAL_VIEW_META[portalView]?.title : undefined;

  return (
    <div className="space-y-5">
      <ClientAccountEventPicker purpose="event files and requirements" destination="documents" />
      {events.length === 0 ? (
        <EmptyState icon={FileText} title="No active event" description="Event files will appear when your event workspace is available." />
      ) : null}

      <section className="rounded-lg border border-border bg-card p-5">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="text-base font-semibold text-foreground">{viewTitle ?? "Document records"}</h2>
          <p className="text-sm tabular-nums text-muted-foreground">{files.length} {files.length === 1 ? "record" : "records"}</p>
        </div>
        <p className="mt-1 text-sm text-muted-foreground">
          {scoped.filtered
            ? "Open an event to upload or download files."
            : "These records don't yet say who shared them, so every file is listed. Open an event to upload or download files."}
        </p>
        {files.length ? (
          <div className="mt-4 divide-y divide-border">
            {files.map((file) => (
              <div key={file.id} className="flex flex-wrap items-center gap-3 py-3">
                <FileText aria-hidden="true" className="size-4 shrink-0 text-muted-foreground" />
                <div className="min-w-0 flex-1 basis-48">
                  <p className="break-words text-sm font-semibold text-foreground">{file.fileName}</p>
                  <p className="mt-1 text-xs text-muted-foreground">{eventNames.get(file.eventId)} · {formatStatusLabel(file.type)} · {formatPortalDateTime(file.uploadedAt)}</p>
                </div>
                <StatusBadge status={file.status} label={formatStatusLabel(file.status)} />
              </div>
            ))}
          </div>
        ) : (
          <p className="mt-4 rounded-md border border-dashed border-border px-4 py-3 text-sm text-muted-foreground">
            {viewTitle ? `No ${viewTitle.toLowerCase()} on record yet.` : "No document records yet. Records shared with you will appear here."}
          </p>
        )}
      </section>
    </div>
  );
}
