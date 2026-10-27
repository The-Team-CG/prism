"use client";

import { FileText } from "lucide-react";
import { EmptyState } from "@/app/components/ui/empty-state";
import { StatusBadge } from "@/app/components/ui/status-badge";
import { formatStatusLabel, useClientWorkspace } from "../../workspace/shared";
import { ClientAccountEventPicker } from "../../workspace/views/sections/client-account-event-picker";

export function ClientFilesView() {
  const { state, events } = useClientWorkspace();
  if (!state) return null;

  const eventNames = new Map(events.map((event) => [event.id, event.eventName]));
  const files = state.documents.filter((document) => eventNames.has(document.eventId));

  return (
    <div className="space-y-5">
      <ClientAccountEventPicker purpose="event files and requirements" destination="documents" />
      {events.length === 0 ? (
        <EmptyState icon={FileText} title="No active event" description="Event files will appear when your event workspace is available." />
      ) : null}

      <section className="rounded-2xl border border-border bg-card p-5 shadow-sm">
        <div>
          <h2 className="text-base font-bold text-foreground">Document records</h2>
          <p className="mt-1 text-sm text-muted-foreground">Client-visible document records across your active events. Open an event to upload or download files.</p>
        </div>
        {files.length ? (
          <div className="mt-4 divide-y divide-border">
            {files.map((file) => (
              <div key={file.id} className="flex flex-wrap items-center gap-3 py-3">
                <FileText aria-hidden="true" className="size-5 shrink-0 text-primary" />
                <div className="min-w-0 flex-1 basis-48">
                  <p className="break-words text-sm font-semibold text-foreground">{file.fileName}</p>
                  <p className="mt-1 text-xs text-muted-foreground">{eventNames.get(file.eventId)} · {formatStatusLabel(file.type)} · {file.uploadedAt}</p>
                </div>
                <StatusBadge status={file.status} label={formatStatusLabel(file.status)} />
              </div>
            ))}
          </div>
        ) : (
          <div className="mt-4"><EmptyState icon={FileText} title="No document records yet" description="Records shared with you will appear here." /></div>
        )}
      </section>
    </div>
  );
}
