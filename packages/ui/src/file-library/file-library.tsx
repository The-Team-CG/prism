"use client";

import { useRef, useState, type DragEvent, type KeyboardEvent, type ReactNode } from "react";
import { ArrowDown, ArrowUp, ChevronDown, ChevronUp, Download, File, FileImage, FileSpreadsheet, FileText, FileVideo, LoaderCircle, Search, type LucideIcon } from "lucide-react";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "../components/ui/sheet";
import { formatPortalDate } from "../format-date";
import { cn } from "../utils";
import { fileExpiry, formatFileSize, type FileKind, type FileTone } from "./file-model";

/**
 * The file library every portal shares: one table of files (type icon, name, who added it, when, size, status), one
 * filter bar, and one side panel that previews a file with its details and the actions the reader may take.
 */

export const FILE_TONE: Record<FileTone, string> = {
  urgent: "text-danger",
  attention: "text-attention",
  done: "text-success",
  neutral: "text-muted-foreground",
};

const KIND: Record<FileKind, { icon: LucideIcon; tone: string }> = {
  pdf: { icon: FileText, tone: "bg-danger-soft text-danger" },
  image: { icon: FileImage, tone: "bg-info-soft text-info" },
  sheet: { icon: FileSpreadsheet, tone: "bg-success-soft text-success" },
  document: { icon: FileText, tone: "bg-primary-soft text-primary" },
  video: { icon: FileVideo, tone: "bg-attention-soft text-attention" },
  other: { icon: File, tone: "bg-muted text-muted-foreground" },
};

/** A file's type at a glance: PDFs, documents, sheets, images and videos each get their own icon and tint. */
export function FileKindIcon({ kind, className }: { kind: FileKind; className?: string }) {
  const { icon: Icon, tone } = KIND[kind];
  return (
    <span aria-hidden="true" className={cn("grid size-8 shrink-0 place-items-center rounded-md", tone, className)}>
      <Icon className="size-4" />
    </span>
  );
}

/** A file's status, with when a dated document expires under it once that is close or past. */
export function FileStatus({ label, tone, expiresAt, title }: { label: string; tone: FileTone; expiresAt?: string | null; title?: string }) {
  const expiry = fileExpiry(expiresAt);
  return (
    <span className="block min-w-0">
      <span className={cn("block truncate text-sm", FILE_TONE[tone])} title={title}>{label}</span>
      {expiry && expiry.tone !== "neutral" ? <span className={cn("block truncate text-xs", FILE_TONE[expiry.tone])}>{expiry.label}</span> : null}
    </span>
  );
}

export type FileFilterOption<Id extends string> = { id: Id; label: string; count: number };

/** Which files to show, as buttons with counts, and a search box; `children` adds controls beside them. */
export function FileFilterBar<Id extends string>({ label, filters, value, onChange, query, onQuery, searchLabel, searchPlaceholder = "Search files", children }: {
  label: string;
  filters: ReadonlyArray<FileFilterOption<Id>>;
  value: Id;
  onChange: (id: Id) => void;
  query: string;
  onQuery: (query: string) => void;
  searchLabel: string;
  searchPlaceholder?: string;
  children?: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-4 py-3">
      <div role="group" aria-label={label} className="flex flex-wrap gap-1.5">
        {filters.map((entry) => (
          <Button key={entry.id} type="button" size="sm" variant={value === entry.id ? "secondary" : "ghost"} aria-pressed={value === entry.id} onClick={() => onChange(entry.id)}>
            {entry.label}
            <span className="tabular-nums text-muted-foreground">{entry.count}</span>
          </Button>
        ))}
      </div>
      <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto">
        {children}
        <label className="relative block w-full sm:w-60">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
          <Input type="search" value={query} onChange={(event) => onQuery(event.target.value)} placeholder={searchPlaceholder} aria-label={searchLabel} className="pl-8" />
        </label>
      </div>
    </div>
  );
}

const ROW_GRID = "sm:grid sm:grid-cols-[minmax(0,1fr)_7rem_6.5rem_4.5rem_8.5rem_2.75rem] sm:items-center sm:gap-3";

export type FileSort = { key: "date" | "name"; direction: "asc" | "desc" };

function SortHeader({ label, sortKey, sort, onSort }: { label: string; sortKey: FileSort["key"]; sort?: FileSort; onSort?: (key: FileSort["key"]) => void }) {
  if (!sort || !onSort) return <span>{label}</span>;
  const active = sort.key === sortKey;
  const Arrow = sort.direction === "asc" ? ArrowUp : ArrowDown;
  return (
    <button type="button" onClick={() => onSort(sortKey)} className={cn("inline-flex items-center gap-1 text-left hover:text-foreground", active && "font-medium text-foreground")} aria-label={`Sort by ${label.toLowerCase()}`}>
      {label}
      {active ? <Arrow className="size-3" aria-hidden="true" /> : null}
    </button>
  );
}

/** The table's column heads and rows; `sort` makes Name and Added sortable. */
export function FileTable({ fromLabel = "From", sort, onSort, children }: { fromLabel?: string; sort?: FileSort; onSort?: (key: FileSort["key"]) => void; children: ReactNode }) {
  return (
    <>
      <div className={cn("hidden border-b border-border px-4 py-2 text-xs text-muted-foreground", ROW_GRID)}>
        <SortHeader label="Name" sortKey="name" sort={sort} onSort={onSort} />
        <span>{fromLabel}</span>
        <SortHeader label="Added" sortKey="date" sort={sort} onSort={onSort} />
        <span>Size</span>
        <span>Status</span>
        <span />
      </div>
      <ul className="divide-y divide-border">{children}</ul>
    </>
  );
}

/**
 * One file: clicking its name opens the preview. On a phone the from and status fold under the name; `action` is the
 * download (or another way to the file) at the end of the row.
 */
export function FileTableRow({ kind, name, detail, isNew = false, from, addedAt, size, status, onOpen, action }: {
  kind: FileKind;
  name: string;
  /** What the file is for, or where it belongs: "For Venue permit", "UAT Gala · Insurance certificate". */
  detail?: string | null;
  isNew?: boolean;
  from?: string | null;
  addedAt?: string | null;
  size?: number | null;
  status: { label: string; tone: FileTone; expiresAt?: string | null; title?: string };
  onOpen: () => void;
  action?: ReactNode;
}) {
  return (
    <li className={cn("flex items-center gap-3 px-4 py-2 transition-colors hover:bg-surface-raised", ROW_GRID)}>
      <button type="button" onClick={onOpen} className="flex min-w-0 flex-1 items-center gap-3 rounded-md py-0.5 text-left" aria-label={`Preview ${name}`}>
        <FileKindIcon kind={kind} />
        <span className="min-w-0">
          <span className="flex min-w-0 items-center gap-2">
            <span className={cn("truncate text-sm text-foreground", isNew ? "font-semibold" : "font-medium")} title={name}>{name}</span>
            {isNew ? <span className="shrink-0 text-xs font-medium text-primary">New</span> : null}
          </span>
          <span className="block truncate text-xs text-muted-foreground">
            {detail}
            <span className="sm:hidden">{[detail ? "" : null, from, status.label].filter((part) => part !== null && part !== undefined).join(" · ")}</span>
          </span>
        </span>
      </button>
      <span className="hidden truncate text-sm text-muted-foreground sm:block">{from ?? "—"}</span>
      <span className="hidden text-sm tabular-nums text-muted-foreground sm:block">{addedAt ? formatPortalDate(addedAt) : "—"}</span>
      <span className="hidden text-sm tabular-nums text-muted-foreground sm:block">{formatFileSize(size) ?? "—"}</span>
      <span className="hidden min-w-0 sm:block"><FileStatus {...status} /></span>
      <span className="grid w-11 shrink-0 place-items-center">{action}</span>
    </li>
  );
}

/** Download as an icon button, spinning while it runs. */
export function FileDownloadButton({ label, busy = false, disabled = false, onClick }: { label: string; busy?: boolean; disabled?: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled || busy}
      aria-label={label}
      className="grid size-11 shrink-0 place-items-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-50"
    >
      {busy ? <LoaderCircle className="size-4 animate-spin" aria-hidden="true" /> : <Download className="size-4" aria-hidden="true" />}
    </button>
  );
}

/** A preview in progress, ready to show (a PDF or an image), failed, or not possible for this file. */
export type FilePreviewState = { status: string; kind?: string; url?: string; message?: string };

/** The file itself when the browser can show it; otherwise its type icon and why it cannot be shown. */
export function FilePreviewFrame({ state, name, kind, fallback }: { state: FilePreviewState; name: string; kind: FileKind; fallback: string }) {
  if (state.status === "loading") {
    return <div className="grid h-full place-items-center text-sm text-muted-foreground"><LoaderCircle className="size-5 animate-spin" aria-label="Loading preview" /></div>;
  }
  if (state.status === "ready" && state.url) {
    return state.kind === "pdf" ? (
      <iframe src={`${state.url}#navpanes=0&view=FitH`} title={`Preview of ${name}`} className="h-full w-full rounded-md border border-border bg-background" />
    ) : (
      // A local object URL, which an image optimiser cannot load.
      <img src={state.url} alt={`Preview of ${name}`} className="mx-auto max-h-full max-w-full rounded-md object-contain" />
    );
  }
  return (
    <div className="grid h-full place-items-center rounded-md border border-dashed border-border px-6 text-center">
      <div className="space-y-2">
        <FileKindIcon kind={kind} className="mx-auto size-10" />
        <p className="text-sm text-muted-foreground">{state.status === "error" && state.message ? state.message : fallback}</p>
      </div>
    </div>
  );
}

/** One line of a file's details: a label and its value. */
export function FileDetail({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex justify-between gap-4 py-1.5 text-sm">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="min-w-0 text-right text-foreground">{children}</dd>
    </div>
  );
}

/** Why PMCM did not accept a file, above its details. */
export function FileReviewNote({ lead = "PMCM didn't accept this file:", reason }: { lead?: string; reason?: string | null }) {
  if (!reason) return null;
  return (
    <p role="note" className="rounded-md bg-danger-soft px-3 py-2 text-sm text-danger">
      <span className="font-semibold">{lead}</span> {reason}
    </p>
  );
}

/** When a dated document stops being valid; editable by whoever may change it, read-only for everyone else. */
export function FileValidUntil({ fileName, expiresAt, editable, busy, onSave }: {
  fileName: string;
  expiresAt?: string | null;
  editable: boolean;
  busy: boolean;
  onSave: (value: string | null) => void;
}) {
  const saved = expiresAt?.slice(0, 10) ?? "";
  const [value, setValue] = useState(saved);
  const expiry = fileExpiry(expiresAt);
  if (!editable) return expiry ? <FileDetail label="Valid until"><span className={FILE_TONE[expiry.tone]}>{expiry.label}</span></FileDetail> : null;
  return (
    <FileDetail label="Valid until">
      <form className="flex flex-wrap items-center justify-end gap-2" onSubmit={(event) => { event.preventDefault(); onSave(value || null); }}>
        <input type="date" aria-label={`Valid until for ${fileName}`} value={value} onChange={(event) => setValue(event.currentTarget.value)} className="h-8 rounded-md border border-border bg-background px-2 text-sm" />
        <Button type="submit" size="sm" variant="outline" disabled={busy || value === saved}>Save</Button>
        {expiresAt ? <Button type="button" size="sm" variant="ghost" disabled={busy} onClick={() => { setValue(""); onSave(null); }}>Clear</Button> : null}
        {expiry && expiry.tone !== "neutral" ? <span className={cn("text-xs", FILE_TONE[expiry.tone])}>{expiry.label}</span> : null}
      </form>
    </FileDetail>
  );
}

/**
 * A file opened from the library, the same panel on every portal: its name and facts, the file itself when the
 * browser can show it, then `children` (details, versions) and `footer` (the actions). With `onStep`, the arrows and
 * the up and down keys move through the list.
 */
export function FilePreviewSheet({ open, onClose, kind, name, meta, onStep, canStep = { previous: false, next: false }, tall, frame, footer, children }: {
  open: boolean;
  onClose: () => void;
  kind: FileKind;
  name: string;
  meta?: string;
  onStep?: (offset: -1 | 1) => void;
  canStep?: { previous: boolean; next: boolean };
  /** Give the preview most of the panel (a PDF or image the browser can show). */
  tall: boolean;
  frame: ReactNode;
  footer?: ReactNode;
  children?: ReactNode;
}) {
  const step = (event: KeyboardEvent) => {
    // Arrow keys inside a field (the date picker) belong to that field.
    if (!onStep || event.target instanceof HTMLInputElement) return;
    const offset = event.key === "ArrowDown" ? 1 : event.key === "ArrowUp" ? -1 : 0;
    if (!offset) return;
    event.preventDefault();
    onStep(offset);
  };
  return (
    <Sheet open={open} onOpenChange={(next) => { if (!next) onClose(); }}>
      <SheetContent side="right" className="w-full gap-0 sm:max-w-xl" onKeyDown={step}>
        <SheetHeader className="border-b border-border pr-12">
          <div className="flex items-start gap-3">
            <FileKindIcon kind={kind} />
            <div className="min-w-0 flex-1">
              <SheetTitle className="break-words text-base">{name}</SheetTitle>
              {meta ? <SheetDescription>{meta}</SheetDescription> : null}
            </div>
            {onStep ? (
              <div className="flex shrink-0 gap-1">
                <Button type="button" variant="ghost" size="icon" aria-label="Previous file" disabled={!canStep.previous} onClick={() => onStep(-1)}><ChevronUp className="size-4" /></Button>
                <Button type="button" variant="ghost" size="icon" aria-label="Next file" disabled={!canStep.next} onClick={() => onStep(1)}><ChevronDown className="size-4" /></Button>
              </div>
            ) : null}
          </div>
        </SheetHeader>
        <div className="min-h-0 flex-1 overflow-y-auto">
          <div className={cn("bg-muted/40 p-3", tall ? "h-[55vh]" : "h-40")}>{frame}</div>
          {children ? <div className="space-y-4 p-4">{children}</div> : null}
        </div>
        {footer ? <footer className="flex flex-wrap gap-2 border-t border-border p-4">{footer}</footer> : null}
      </SheetContent>
    </Sheet>
  );
}

/** What a portal still owes PMCM: a titled card of requested files, each taking a dropped file. */
export function FileNeededList({ id, title = "Needed from you", hint = "Drop a file on an item to send it", children }: { id: string; title?: string; hint?: string; children: ReactNode }) {
  return (
    <section aria-labelledby={id} className="overflow-hidden rounded-xl border border-border bg-card shadow-xs">
      <header className="flex items-baseline justify-between gap-2 border-b border-border px-4 py-3">
        <h3 id={id} className="text-sm font-semibold text-foreground">{title}</h3>
        <span className="hidden text-xs text-muted-foreground sm:inline">{hint}</span>
      </header>
      <ul className="divide-y divide-border">{children}</ul>
    </section>
  );
}

function hasFiles(event: DragEvent) {
  return Array.from(event.dataTransfer.types).includes("Files");
}

/**
 * Drag-and-drop for an area that takes files: `over` while files hover over it (counting nested children, so it
 * does not flicker) and the dropped files handed to `onFiles`. Spread `props` on the area.
 */
export function useFileDrop(onFiles: (files: File[]) => void, enabled: boolean) {
  const depth = useRef(0);
  const [over, setOver] = useState(false);
  if (!enabled) return { over: false, props: {} };
  return {
    over,
    props: {
      onDragEnter: (event: DragEvent) => {
        if (!hasFiles(event)) return;
        event.preventDefault();
        depth.current += 1;
        setOver(true);
      },
      onDragOver: (event: DragEvent) => {
        if (hasFiles(event)) event.preventDefault();
      },
      onDragLeave: () => {
        depth.current = Math.max(0, depth.current - 1);
        if (depth.current === 0) setOver(false);
      },
      onDrop: (event: DragEvent) => {
        if (!hasFiles(event)) return;
        event.preventDefault();
        event.stopPropagation();
        depth.current = 0;
        setOver(false);
        onFiles(Array.from(event.dataTransfer.files));
      },
    },
  };
}

export type FileDropTarget = ReturnType<typeof useFileDrop>;

/**
 * One requested file: what it is, when it is due or why PMCM sent it back, and the way to send it. Red when it is
 * overdue or was rejected, orange otherwise; a file dragged over it shows where it will go.
 */
export function FileNeededRow({ label, detail, urgent, note, drop, actions }: {
  label: string;
  detail: string;
  urgent: boolean;
  /** PMCM's reason for sending the last file back. */
  note?: string | null;
  drop?: FileDropTarget;
  actions?: ReactNode;
}) {
  return (
    <li
      {...drop?.props}
      className={cn(
        "flex flex-wrap items-center gap-x-3 gap-y-2 border-l-[3px] py-3 pl-3 pr-4 transition-colors",
        urgent ? "border-l-danger" : "border-l-attention",
        drop?.over && "bg-primary/5 outline outline-2 -outline-offset-2 outline-primary/40",
      )}
    >
      <div className="w-full min-w-0 sm:w-auto sm:flex-1">
        <p className="text-sm font-semibold text-foreground">{label}</p>
        <p className={cn("mt-0.5 text-sm", urgent ? "text-danger" : "text-muted-foreground")}>{detail}</p>
        {note ? <p className="mt-1 text-sm text-foreground"><span className="text-muted-foreground">PMCM:</span> {note}</p> : null}
        {drop?.over ? <p className="mt-1 text-xs font-medium text-primary">Drop to send for {label}</p> : null}
      </div>
      {actions ? <div className="flex shrink-0 gap-2">{actions}</div> : null}
    </li>
  );
}
