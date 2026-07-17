"use client";

import { FileText, MoreVertical } from "lucide-react";
import type { PrismDocument } from "@prism/types";
import { StatusBadge } from "@/app/components/ui/status-badge";
import { EmptyState } from "@/app/components/ui/empty-state";
import { cn } from "@/app/components/ui/utils";
import { formatStatusLabel } from "../../workspace/shared";
import { useClientWorkspace } from "../../workspace/shared";

export function ClientFilesView() {
  const {
    router,
    portalView,
    state,
    events,
  } = useClientWorkspace();
  if (!state) return null;

    type FileFilterId =
      | "files-all"
      | "files-contracts"
      | "files-quotations"
      | "files-invoices-receipts"
      | "files-event-layouts"
      | "files-uploaded"
      | "files-shared";
  
    const eventIds = new Set(events.map((ev) => ev.id));
    const allFiles = state.documents.filter((document) => eventIds.has(document.eventId));
    const textForFile = (document: PrismDocument) => `${document.type} ${document.fileName}`.toLowerCase();
    const fileFilterOptions: Array<{
      id: FileFilterId;
      label: string;
      href: string;
      matches: (document: PrismDocument) => boolean;
    }> = [
      { id: "files-all", label: "All files", href: "/dashboard/files", matches: () => true },
      {
        id: "files-contracts",
        label: "Contracts",
        href: "/dashboard/files/contracts",
        matches: (document) => /contract|conforme|moa|nda/.test(textForFile(document)),
      },
      {
        id: "files-quotations",
        label: "Quotations",
        href: "/dashboard/files/quotations",
        matches: (document) => /quotation|quote/.test(textForFile(document)),
      },
      {
        id: "files-invoices-receipts",
        label: "Invoices",
        href: "/dashboard/files/invoices-receipts",
        matches: (document) => /invoice|receipt|billing|payment/.test(textForFile(document)),
      },
      {
        id: "files-event-layouts",
        label: "Event layouts",
        href: "/dashboard/files/event-layouts",
        matches: (document) => /layout|floor|plan/.test(textForFile(document)),
      },
      {
        id: "files-uploaded",
        label: "Uploaded files",
        href: "/dashboard/files/uploaded",
        matches: (document) => /upload|client|asset|speaker|logo|visual|permit/.test(textForFile(document)),
      },
      {
        id: "files-shared",
        label: "Shared files",
        href: "/dashboard/files/shared",
        matches: (document) => document.status === "approved" || document.status === "issued",
      },
    ];
    const activeFileFilterId = fileFilterOptions.some((option) => option.id === portalView)
      ? portalView as FileFilterId
      : "files-all";
    const activeFolder = fileFilterOptions.find((option) => option.id === activeFileFilterId) ?? fileFilterOptions[0];
    const files = allFiles.filter(activeFolder.matches);
    const folderRows = fileFilterOptions.map((folder) => ({
      ...folder,
      count: allFiles.filter(folder.matches).length,
    }));
    const latestFile = files[0] ?? allFiles[0];
    const latestFileEvent = latestFile ? events.find((candidate) => candidate.id === latestFile.eventId) : undefined;
    const activeFileSize = files.length ? `${Math.max(files.length * 2.4, 1.2).toFixed(1)} Mb` : "0 Mb";
  
    return (
      <div className="space-y-5">
        <section className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-border bg-card px-6 py-5 shadow-sm">
          <div>
            <h1 className="text-2xl font-black text-foreground">{activeFolder.label}</h1>
            <p className="mt-1 text-sm text-muted-foreground">{files.length} file{files.length === 1 ? "" : "s"} across all your PMCM events</p>
          </div>
          <div className="flex items-center gap-2">
            {folderRows.filter((f) => f.count > 0).length > 0 && (
              <span className="text-xs text-muted-foreground font-semibold">
                {allFiles.length} total · {activeFileSize}
              </span>
            )}
          </div>
        </section>
  
        <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_260px]">
          <section className="rounded-2xl border border-border bg-card p-5 shadow-sm">
            <h2 className="text-base font-black text-foreground">Folders</h2>
            <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {folderRows.map((folder) => {
                const isActive = folder.id === activeFileFilterId;
                return (
                  <button
                    key={folder.id}
                    type="button"
                    onClick={() => router.push(folder.href)}
                    className={cn(
                      "group min-w-0 rounded-xl border p-3 text-left transition hover:-translate-y-0.5 hover:shadow-sm",
                      isActive
                        ? "border-(--prism-success)/40 bg-(--prism-success)/10"
                        : "border-border bg-background hover:border-(--prism-success)/30",
                    )}
                  >
                    <div
                      className={cn(
                        "relative h-20 rounded-lg",
                        isActive ? "bg-(--prism-success)/30" : "bg-muted",
                      )}
                    >
                      <span
                        className={cn(
                          "absolute -top-1 left-0 h-4 w-16 rounded-t-lg",
                          isActive ? "bg-(--prism-success)/30" : "bg-muted",
                        )}
                      />
                      <span className="absolute right-2 top-2 opacity-0 transition group-hover:opacity-100">
                        <MoreVertical className="size-4 text-muted-foreground" />
                      </span>
                    </div>
                    <div className="mt-3 flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-bold text-foreground">{folder.label}</p>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {folder.count} file{folder.count === 1 ? "" : "s"}
                        </p>
                      </div>
                      <MoreVertical className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                    </div>
                  </button>
                );
              })}
            </div>
          </section>
  
          <aside className="rounded-2xl border border-border bg-card p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-black text-foreground">Details</h2>
              <MoreVertical className="size-4 text-muted-foreground" />
            </div>
            <div className="mt-5">
              <div className="relative h-24 rounded-xl bg-(--prism-success)/25">
                <span className="absolute -top-1 left-0 h-5 w-20 rounded-t-xl bg-(--prism-success)/25" />
              </div>
              <div className="mt-5 space-y-3 text-xs">
                <div className="flex justify-between gap-3">
                  <span className="text-muted-foreground">Name</span>
                  <span className="truncate font-semibold text-foreground">{activeFolder.label}</span>
                </div>
                <div className="flex justify-between gap-3">
                  <span className="text-muted-foreground">Type</span>
                  <span className="font-semibold text-foreground">File folder</span>
                </div>
                <div className="flex justify-between gap-3">
                  <span className="text-muted-foreground">Files</span>
                  <span className="font-semibold text-foreground">{files.length}</span>
                </div>
                <div className="flex justify-between gap-3">
                  <span className="text-muted-foreground">Size</span>
                  <span className="font-semibold text-foreground">{activeFileSize}</span>
                </div>
                <div className="flex justify-between gap-3">
                  <span className="text-muted-foreground">Last edited</span>
                  <span className="truncate font-semibold text-foreground">{latestFile?.uploadedAt ?? "No files"}</span>
                </div>
              </div>
            </div>
          </aside>
        </div>
  
        <section className="rounded-2xl border border-border bg-card p-5 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-black text-foreground">Recently opened</h2>
              <p className="mt-1 text-xs text-muted-foreground">
                {latestFileEvent ? `${latestFileEvent.eventName} file activity` : "Client-visible file activity"}
              </p>
            </div>
          </div>
  
          {files.length ? (
            <div className="mt-4 overflow-x-auto">
              <div className="min-w-[620px]">
                <div className="grid grid-cols-[minmax(220px,1.4fr)_140px_minmax(180px,1fr)_150px_120px] gap-3 border-b border-border px-2 pb-2 text-[11px] font-bold text-muted-foreground">
                  <span>File name</span>
                  <span>Folder</span>
                  <span>Event</span>
                  <span>Last modified</span>
                  <span>Status</span>
                </div>
                <div className="divide-y divide-border">
                  {files.map((file) => {
                    const ev = events.find((candidate) => candidate.id === file.eventId);
                    return (
                      <div
                        key={file.id}
                        className="grid grid-cols-[minmax(220px,1.4fr)_140px_minmax(180px,1fr)_150px_120px] items-center gap-3 px-2 py-3 text-sm"
                      >
                        <div className="flex min-w-0 items-center gap-3">
                          <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-(--prism-warning)/12 text-(--prism-warning)">
                            <FileText className="size-4" />
                          </span>
                          <span className="truncate font-bold text-foreground">{file.fileName}</span>
                        </div>
                        <span className="truncate text-xs text-muted-foreground">{formatStatusLabel(file.type)}</span>
                        <span className="truncate text-xs text-muted-foreground">{ev?.eventName ?? "Event file"}</span>
                        <span className="truncate text-xs text-muted-foreground">{file.uploadedAt}</span>
                        <StatusBadge status={file.status} label={formatStatusLabel(file.status)} />
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          ) : (
            <div className="mt-4 rounded-xl border border-dashed border-border px-6 py-8">
              <EmptyState icon={FileText} title="No files yet" description="Contracts, quotations, invoices, receipts, and layout files will appear here." />
            </div>
          )}
        </section>
      </div>
    );
}
