"use client";

import Link from "next/link";
import { FileText } from "lucide-react";
import { formatPortalDate, formatPortalDateTime } from "@prism/ui/format-date";
import { cn } from "@/app/components/ui/utils";
import { CLIENT_PORTAL_VIEW_META, dashboardHref, formatStatusLabel, useClientWorkspace } from "../../workspace/shared";
import { CLIENT_PORTAL_VIEW_HREFS } from "../../workspace/model/client-dashboard-navigation";
import type { ClientPortalView } from "../../workspace/model/client-dashboard-types";
import { ClientAccountEventPicker } from "../../workspace/views/sections/client-account-event-picker";
import { ClientListEmpty, ClientListRow, ClientListSection, type ClientRowTone } from "../../shared/client-list-ui";
import { filterClientFiles } from "../model/client-file-category";

const FILTERS: ClientPortalView[] = ["files-all", "files-contracts", "files-quotations", "files-invoices-receipts", "files-event-layouts"];

function fileTone(status: string): ClientRowTone {
  if (/reject|needs_update/i.test(status)) return "attention";
  if (/approved|confirmed|verified/i.test(status)) return "done";
  return "neutral";
}

export function ClientFilesView() {
  const { state, events, portalView } = useClientWorkspace();
  if (!state) return null;
  if (events.length === 0) {
    return <ClientListEmpty icon={FileText} title="No active event" description="Event files appear once your event workspace is open." />;
  }

  const eventNames = new Map(events.map((event) => [event.id, event.eventName]));
  const eventFiles = state.documents.filter((document) => eventNames.has(document.eventId));
  const active = FILTERS.includes(portalView as ClientPortalView) ? (portalView as ClientPortalView) : "files-all";
  const files = [...filterClientFiles(eventFiles, active).documents].sort((a, b) => String(b.uploadedAt ?? "").localeCompare(String(a.uploadedAt ?? "")));
  const title = CLIENT_PORTAL_VIEW_META[active]?.title ?? "Files";

  return (
    <div className="space-y-4">
      <nav className="-mx-1 flex gap-1 overflow-x-auto px-1" aria-label="File filters">
        {FILTERS.map((view) => (
          <Link
            key={view}
            href={CLIENT_PORTAL_VIEW_HREFS[view]}
            aria-current={view === active ? "page" : undefined}
            className={cn("inline-flex h-9 shrink-0 items-center gap-2 rounded-md px-3 text-sm transition-colors", view === active ? "bg-muted font-semibold text-foreground" : "text-muted-foreground hover:text-foreground")}
          >
            {view === "files-all" ? "All" : CLIENT_PORTAL_VIEW_META[view].title}
            <span className="tabular-nums text-muted-foreground">{filterClientFiles(eventFiles, view).documents.length}</span>
          </Link>
        ))}
      </nav>

      {files.length ? (
        <ClientListSection id="client-files-list" title={active === "files-all" ? "All files" : title} count={files.length} description="Open a file's event to download it or upload a replacement.">
          {files.map((file) => (
            <ClientListRow
              key={file.id}
              icon={FileText}
              tone={fileTone(file.status)}
              title={file.fileName}
              meta={[eventNames.get(file.eventId), formatStatusLabel(file.type)].filter(Boolean).join(" · ")}
              status={file.uploadedAt ? formatPortalDate(file.uploadedAt) : formatStatusLabel(file.status)}
              statusTitle={file.uploadedAt ? `${formatStatusLabel(file.status)} · ${formatPortalDateTime(file.uploadedAt)}` : undefined}
              action="Open event files"
              href={dashboardHref("documents", file.eventId)}
            />
          ))}
        </ClientListSection>
      ) : (
        <ClientListEmpty icon={FileText} title={active === "files-all" ? "No files yet" : `No ${title.toLowerCase()} yet`} description="Files you or PMCM share for your events appear here." />
      )}

      <ClientAccountEventPicker purpose="files and requirements" destination="documents" />
    </div>
  );
}
