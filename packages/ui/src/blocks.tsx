"use client";

import type { LucideIcon } from "lucide-react";
import { CheckCircle2, Clock3, FileText, ReceiptText } from "lucide-react";
import type * as React from "react";
import { PrismBadge } from "./primitives";
import { PrismStatusBadge } from "./status-badge";
import { cn } from "./utils";

export interface PrismMetricTileProps {
  label: string;
  value: string | number;
  icon: LucideIcon;
  detail?: string;
  trend?: string;
  className?: string;
}

export function PrismMetricTile({ label, value, icon: Icon, detail, trend, className }: PrismMetricTileProps) {
  return (
    <div className={cn("flex items-center gap-3 rounded-lg border border-border bg-card p-4 shadow-sm", className)}>
      <span className="grid size-10 shrink-0 place-items-center rounded-md bg-secondary text-primary">
        <Icon aria-hidden="true" />
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <p className="truncate text-xl font-black leading-none text-foreground">{value}</p>
          {trend ? <PrismBadge variant="success">{trend}</PrismBadge> : null}
        </div>
        <p className="mt-1 truncate text-[11px] font-bold uppercase tracking-wide text-muted-foreground">{label}</p>
        {detail ? <p className="mt-1 line-clamp-1 text-xs text-muted-foreground">{detail}</p> : null}
      </div>
    </div>
  );
}

export interface PrismSectionPanelProps {
  title: string;
  icon?: LucideIcon;
  description?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  contentClassName?: string;
}

export function PrismSectionPanel({
  title,
  icon: Icon,
  description,
  action,
  children,
  className,
  contentClassName,
}: PrismSectionPanelProps) {
  return (
    <section className={cn("rounded-lg border border-border bg-card shadow-sm", className)}>
      <header className="flex flex-wrap items-start justify-between gap-3 border-b border-border px-4 py-3.5 sm:px-5">
        <div className="flex min-w-0 items-start gap-2.5">
          {Icon ? (
            <span className="grid size-8 shrink-0 place-items-center rounded-md bg-secondary text-primary">
              <Icon aria-hidden="true" />
            </span>
          ) : null}
          <div className="min-w-0">
            <h3 className="text-sm font-black text-foreground">{title}</h3>
            {description ? <p className="mt-1 text-xs leading-5 text-muted-foreground">{description}</p> : null}
          </div>
        </div>
        {action ? <div className="shrink-0">{action}</div> : null}
      </header>
      <div className={cn("p-4 sm:p-5", contentClassName)}>{children}</div>
    </section>
  );
}

export interface PrismNoticeBannerProps {
  tone?: "info" | "success" | "warning" | "danger";
  title?: string;
  children: React.ReactNode;
  className?: string;
}

const noticeToneClasses: Record<NonNullable<PrismNoticeBannerProps["tone"]>, string> = {
  info: "border-primary/15 bg-primary/8 text-foreground",
  success: "border-(--prism-success)/20 bg-(--prism-success)/8 text-(--prism-success)",
  warning: "border-(--prism-amber)/25 bg-(--prism-amber)/10 text-(--prism-amber)",
  danger: "border-(--prism-danger)/20 bg-(--prism-danger)/8 text-(--prism-danger)",
};

export function PrismNoticeBanner({ tone = "info", title, children, className }: PrismNoticeBannerProps) {
  return (
    <div className={cn("rounded-lg border px-4 py-3 text-sm leading-6", noticeToneClasses[tone], className)}>
      {title ? <p className="font-black text-foreground">{title}</p> : null}
      <div className={cn(title ? "mt-0.5" : "", tone === "info" ? "text-muted-foreground" : "")}>{children}</div>
    </div>
  );
}

export interface PrismStatusSummaryItem {
  id: string;
  label: string;
  value: React.ReactNode;
  icon?: LucideIcon;
  status?: string;
  detail?: string;
}

export function PrismStatusSummary({
  items,
  columns = "auto",
  className,
}: {
  items: PrismStatusSummaryItem[];
  columns?: "auto" | "two" | "four";
  className?: string;
}) {
  const columnClass =
    columns === "two"
      ? "sm:grid-cols-2"
      : columns === "four"
        ? "sm:grid-cols-2 xl:grid-cols-4"
        : "sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4";

  return (
    <div className={cn("grid gap-3", columnClass, className)}>
      {items.map((item) => (
        <div key={item.id} className="rounded-lg border border-border bg-card p-3.5 shadow-sm">
          <div className="flex items-start gap-3">
            {item.icon ? (
              <span className="grid size-9 shrink-0 place-items-center rounded-md bg-secondary text-primary">
                <item.icon aria-hidden="true" />
              </span>
            ) : null}
            <div className="min-w-0 flex-1">
              <p className="truncate text-[11px] font-black uppercase tracking-wide text-muted-foreground">{item.label}</p>
              <div className="mt-1 flex flex-wrap items-center gap-2 text-sm font-black text-foreground">
                <span className="min-w-0 truncate">{item.value}</span>
                {item.status ? <PrismStatusBadge status={item.status} /> : null}
              </div>
              {item.detail ? <p className="mt-1 line-clamp-2 text-xs leading-5 text-muted-foreground">{item.detail}</p> : null}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

export interface PrismWorkflowTabItem {
  id: string;
  label: string;
  icon?: LucideIcon;
  badge?: string | number;
  disabled?: boolean;
}

export function PrismWorkflowTabs({
  items,
  activeId,
  onSelect,
  className,
}: {
  items: PrismWorkflowTabItem[];
  activeId: string;
  onSelect: (id: string) => void;
  className?: string;
}) {
  return (
    <div className={cn("overflow-x-auto rounded-lg border border-border bg-card p-1.5 shadow-sm", className)}>
      <div className="flex min-w-max gap-1">
        {items.map((item) => (
          <button
            key={item.id}
            type="button"
            disabled={item.disabled}
            data-active={item.id === activeId}
            onClick={() => onSelect(item.id)}
            className="flex h-9 shrink-0 items-center gap-2 rounded-md px-3.5 text-sm font-bold text-muted-foreground transition hover:bg-secondary hover:text-foreground disabled:cursor-not-allowed disabled:opacity-45 data-[active=true]:bg-primary data-[active=true]:text-primary-foreground"
          >
            {item.icon ? <item.icon aria-hidden="true" /> : null}
            <span>{item.label}</span>
            {item.badge ? (
              <span className="rounded-full bg-background/70 px-1.5 text-[11px] font-black text-current">
                {item.badge}
              </span>
            ) : null}
          </button>
        ))}
      </div>
    </div>
  );
}

export interface PrismFieldActionPanelProps {
  title: string;
  description?: string;
  icon?: LucideIcon;
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}

export function PrismFieldActionPanel({
  title,
  description,
  icon,
  action,
  children,
  className,
}: PrismFieldActionPanelProps) {
  return (
    <PrismSectionPanel title={title} description={description} icon={icon} action={action} className={className}>
      <div className="space-y-4">{children}</div>
    </PrismSectionPanel>
  );
}

export interface PrismCompactRecordItem {
  id: string;
  title: string;
  description?: string;
  meta?: string;
  status?: string;
  icon?: LucideIcon;
  active?: boolean;
  action?: React.ReactNode;
  onSelect?: () => void;
}

export function PrismCompactRecordList({
  items,
  emptyText = "No records available.",
  className,
}: {
  items: PrismCompactRecordItem[];
  emptyText?: string;
  className?: string;
}) {
  if (!items.length) {
    return <p className="rounded-md border border-dashed border-border bg-secondary/40 px-4 py-5 text-center text-sm text-muted-foreground">{emptyText}</p>;
  }

  return (
    <div className={cn("flex flex-col gap-2", className)}>
      {items.map((item) => {
        const content = (
          <span className="flex w-full items-start gap-3 text-left">
            {item.icon ? (
              <span className="grid size-9 shrink-0 place-items-center rounded-md bg-secondary text-primary">
                <item.icon aria-hidden="true" />
              </span>
            ) : null}
            <span className="min-w-0 flex-1">
              <span className="flex flex-wrap items-center gap-2">
                <span className="truncate text-sm font-black text-foreground">{item.title}</span>
                {item.status ? <PrismStatusBadge status={item.status} /> : null}
              </span>
              {item.description ? <span className="mt-1 block line-clamp-2 text-xs leading-5 text-muted-foreground">{item.description}</span> : null}
              {item.meta ? <span className="mt-1 block text-[11px] font-bold uppercase tracking-wide text-muted-foreground">{item.meta}</span> : null}
            </span>
            {item.action ? <span className="shrink-0">{item.action}</span> : null}
          </span>
        );

        const baseClass = cn(
          "rounded-lg border p-3 transition",
          item.active ? "border-primary/40 bg-secondary" : "border-border bg-card hover:border-primary/25 hover:bg-secondary/35",
        );

        return item.onSelect ? (
          <button key={item.id} type="button" onClick={item.onSelect} className={baseClass}>
            {content}
          </button>
        ) : (
          <div key={item.id} className={baseClass}>
            {content}
          </div>
        );
      })}
    </div>
  );
}

export interface PrismEventDayAction {
  id: string;
  label: string;
  icon: LucideIcon;
  description?: string;
  status?: string;
  active?: boolean;
  disabled?: boolean;
  onSelect?: () => void;
}

export function PrismEventDayActionGroup({
  actions,
  className,
}: {
  actions: PrismEventDayAction[];
  className?: string;
}) {
  if (!actions.length) return null;

  return (
    <div className={cn("grid gap-2 sm:grid-cols-2 xl:grid-cols-3", className)}>
      {actions.map((action) => (
        <button
          key={action.id}
          type="button"
          disabled={action.disabled}
          data-active={action.active}
          onClick={action.onSelect}
          className="min-h-24 rounded-lg border border-border bg-card p-4 text-left shadow-sm transition hover:border-primary/30 hover:bg-secondary/35 disabled:cursor-not-allowed disabled:opacity-55 data-[active=true]:border-primary/45 data-[active=true]:bg-secondary"
        >
          <span className="flex items-start gap-3">
            <span className="grid size-10 shrink-0 place-items-center rounded-md bg-secondary text-primary">
              <action.icon aria-hidden="true" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="flex flex-wrap items-center gap-2">
                <span className="text-sm font-black text-foreground">{action.label}</span>
                {action.status ? <PrismStatusBadge status={action.status} /> : null}
              </span>
              {action.description ? <span className="mt-1 block text-xs leading-5 text-muted-foreground">{action.description}</span> : null}
            </span>
          </span>
        </button>
      ))}
    </div>
  );
}

export interface PrismActionQueueItem {
  id: string;
  title: string;
  description: string;
  icon?: LucideIcon;
  status?: string;
  action?: React.ReactNode;
  onSelect?: () => void;
}

export function PrismActionQueue({ items, emptyText = "No actions are waiting." }: { items: PrismActionQueueItem[]; emptyText?: string }) {
  if (!items.length) {
    return <p className="rounded-md border border-dashed border-border bg-secondary/40 px-4 py-5 text-center text-sm text-muted-foreground">{emptyText}</p>;
  }

  return (
    <div className="flex flex-col gap-3">
      {items.map((item) => (
        <button
          key={item.id}
          type="button"
          onClick={item.onSelect}
          className="rounded-lg border border-border bg-card p-3 text-left transition hover:border-primary/30 hover:bg-secondary/35"
        >
          <span className="flex items-start gap-3">
            {item.icon ? (
              <span className="grid size-9 shrink-0 place-items-center rounded-md bg-secondary text-primary">
                <item.icon aria-hidden="true" />
              </span>
            ) : null}
            <span className="min-w-0 flex-1">
              <span className="flex flex-wrap items-center gap-2">
                <span className="font-black text-foreground">{item.title}</span>
                {item.status ? <PrismStatusBadge status={item.status} /> : null}
              </span>
              <span className="mt-1 block text-xs leading-5 text-muted-foreground">{item.description}</span>
              {item.action ? <span className="mt-3 block">{item.action}</span> : null}
            </span>
          </span>
        </button>
      ))}
    </div>
  );
}

export interface PrismTimelineItem {
  id: string;
  title: string;
  description?: string;
  status: string;
  meta?: string;
}

export function PrismStatusTimeline({ items }: { items: PrismTimelineItem[] }) {
  return (
    <ol className="flex flex-col gap-0">
      {items.map((item, index) => (
        <li key={item.id} className="relative grid grid-cols-[1.5rem_minmax(0,1fr)] gap-3 pb-4 last:pb-0">
          {index < items.length - 1 ? <span className="absolute bottom-0 left-3 top-6 w-px bg-border" aria-hidden="true" /> : null}
          <span className="relative z-10 mt-1 grid size-6 place-items-center rounded-full bg-card ring-1 ring-border">
            {item.status === "completed" || item.status === "confirmed" || item.status === "approved" ? (
              <CheckCircle2 className="size-3.5 text-(--prism-success)" />
            ) : (
              <Clock3 className="size-3.5 text-(--prism-amber)" />
            )}
          </span>
          <span className="min-w-0">
            <span className="flex flex-wrap items-center gap-2">
              <span className="text-sm font-black text-foreground">{item.title}</span>
              <PrismStatusBadge status={item.status} />
            </span>
            {item.description ? <span className="mt-1 block text-xs leading-5 text-muted-foreground">{item.description}</span> : null}
            {item.meta ? <span className="mt-1 block text-[11px] font-bold uppercase tracking-wide text-muted-foreground">{item.meta}</span> : null}
          </span>
        </li>
      ))}
    </ol>
  );
}

export interface PrismDataTableColumn<RowT> {
  id: string;
  header: React.ReactNode;
  className?: string;
  render: (row: RowT) => React.ReactNode;
}

export function PrismDataTable<RowT>({
  rows,
  columns,
  rowKey,
  emptyText = "No records available.",
}: {
  rows: RowT[];
  columns: PrismDataTableColumn<RowT>[];
  rowKey: (row: RowT) => string;
  emptyText?: string;
}) {
  return (
    <div className="overflow-hidden rounded-lg border border-border bg-card">
      <div className="overflow-x-auto">
        <table className="min-w-[760px] w-full text-sm">
          <thead className="bg-secondary/55 text-xs text-muted-foreground">
            <tr>
              {columns.map((column) => (
                <th key={column.id} className="px-4 py-3 text-left font-black uppercase tracking-wide">
                  {column.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.length ? (
              rows.map((row) => (
                <tr key={rowKey(row)} className="border-t border-border hover:bg-secondary/30">
                  {columns.map((column) => (
                    <td key={column.id} className={cn("px-4 py-3 align-middle", column.className)}>
                      {column.render(row)}
                    </td>
                  ))}
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={columns.length} className="px-4 py-10 text-center text-muted-foreground">
                  {emptyText}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export interface PrismDocumentItem {
  id: string;
  title: string;
  description?: string;
  status?: string;
  meta?: string;
}

export function PrismDocumentList({ documents }: { documents: PrismDocumentItem[] }) {
  if (!documents.length) {
    return <p className="rounded-md border border-dashed border-border bg-secondary/40 px-4 py-5 text-center text-sm text-muted-foreground">No documents are available yet.</p>;
  }

  return (
    <div className="flex flex-col gap-2">
      {documents.map((document) => (
        <div key={document.id} className="flex items-start gap-3 rounded-lg border border-border bg-card p-3">
          <span className="grid size-9 shrink-0 place-items-center rounded-md bg-secondary text-primary">
            <FileText aria-hidden="true" />
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <p className="font-black text-foreground">{document.title}</p>
              {document.status ? <PrismStatusBadge status={document.status} /> : null}
            </div>
            {document.description ? <p className="mt-1 text-xs leading-5 text-muted-foreground">{document.description}</p> : null}
            {document.meta ? <p className="mt-1 text-[11px] font-bold uppercase tracking-wide text-muted-foreground">{document.meta}</p> : null}
          </div>
        </div>
      ))}
    </div>
  );
}

export interface PrismBillingMilestone {
  id: string;
  label: string;
  amount: string;
  status: string;
  due?: string;
}

export function PrismBillingMilestoneList({ milestones }: { milestones: PrismBillingMilestone[] }) {
  if (!milestones.length) {
    return <p className="rounded-md border border-dashed border-border bg-secondary/40 px-4 py-5 text-center text-sm text-muted-foreground">No billing milestones are visible yet.</p>;
  }

  return (
    <div className="flex flex-col gap-2">
      {milestones.map((milestone) => (
        <div key={milestone.id} className="flex items-center gap-3 rounded-lg border border-border bg-card p-3">
          <span className="grid size-9 shrink-0 place-items-center rounded-md bg-secondary text-primary">
            <ReceiptText aria-hidden="true" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-black text-foreground">{milestone.label}</p>
            {milestone.due ? <p className="mt-1 text-xs text-muted-foreground">Due {milestone.due}</p> : null}
          </div>
          <div className="text-right">
            <p className="text-sm font-black text-foreground">{milestone.amount}</p>
            <PrismStatusBadge status={milestone.status} />
          </div>
        </div>
      ))}
    </div>
  );
}
