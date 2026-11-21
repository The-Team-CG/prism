"use client";

import { useMemo } from "react";
import { formatPortalDateTime, formatPortalTime } from "@prism/ui/format-date";

import {
  AlertTriangle,
  ClipboardList,
  Download,
  FileCheck2,
  Filter,
  ReceiptText,
  Search,
  ShieldCheck,
  Truck,
  UserRound,
} from "lucide-react";

import type { PrismAuditLog, PrismEvent, PrismUser, PrismSecurityAlert } from "@prism/types";
import { Alert, AlertDescription } from "@prism/ui/components/alert";
import { Button } from "@prism/ui/components/button";
import { Input } from "@prism/ui/components/input";
import { compactTimestamp, cx, label, roleLabel, SegmentedControl, severityTone } from "@/features/pmcm-kit";
import { Field, FieldLabel } from "@prism/ui/components/field";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@prism/ui/components/select";
import { Panel } from "@/features/pmcm-kit";
import { auditIconKind, auditIntegrityCopy, groupRepeatedAuditLogs, type AuditLogGroup } from "../model/audit-trail-rules";
import { usePagedItems } from "../view-models/use-paged-items";
import { ListPager } from "./list-pager";
import type { useAuditTrailViewModel } from "../view-models/use-audit-trail-view-model";
import { LoadingState } from "@prism/ui/components/loading-state";

type AuditVm = ReturnType<typeof useAuditTrailViewModel>;

const AUDIT_ICONS = {
  alert: AlertTriangle,
  access: UserRound,
  documents: FileCheck2,
  finance: ReceiptText,
  suppliers: Truck,
  default: ClipboardList,
} as const;

export function AuditTrailOverview({
  vm,
  events,
  users,
}: {
  vm: AuditVm;
  events: PrismEvent[];
  users: PrismUser[];
}) {
  return (
    <section className="rounded-lg border border-border bg-card p-5">
      <AuditTrailHeader vm={vm} onExport={vm.exportLog} onToggleFilters={() => vm.setAdvancedOpen((value) => !value)} />
      <AuditLogFilters vm={vm} events={events} users={users} />
      {vm.error ? (
        <Alert variant="destructive" className="mt-4 rounded-md">
          <AlertDescription>{vm.error}</AlertDescription>
        </Alert>
      ) : null}
      <AuditLogList logs={vm.logs} busy={vm.busy} />
    </section>
  );
}

/**
 * The trail's one line of status: whether the chain of entries checks out, then alerts and failed sign-ins, coloured
 * only when they are not zero. It replaces ten figure tiles, most of which counted the page on screen.
 */
function AuditTrailHeader({
  vm,
  onExport,
  onToggleFilters,
}: {
  vm: AuditVm;
  onExport: () => void;
  onToggleFilters: () => void;
}) {
  const integrity = auditIntegrityCopy(vm.auditIntegrity);
  return (
    <div className="flex flex-wrap items-start justify-between gap-4">
      <div className="min-w-0">
        <h2 className="text-base font-semibold text-foreground">Audit trail</h2>
        <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
          <span className={cx("inline-flex items-center gap-1.5 font-medium", integrity.valid ? "text-success" : "text-danger")}>
            <ShieldCheck aria-hidden className="size-4" />
            {integrity.valid ? "Trail intact" : integrity.headline}
          </span>
          <span className="text-muted-foreground">{integrity.detail}</span>
          <span className={vm.openAlertCount ? "font-medium text-danger" : "text-muted-foreground"}>{vm.openAlertCount === 1 ? "1 alert" : `${vm.openAlertCount} alerts`}</span>
          <span className={vm.failedLoginCount ? "font-medium text-attention" : "text-muted-foreground"}>{vm.failedLoginCount === 1 ? "1 failed sign-in" : `${vm.failedLoginCount} failed sign-ins`}</span>
        </p>
      </div>
      <div className="flex flex-wrap gap-2">
        <Button type="button" variant="outline" disabled={vm.busy} onClick={onExport} className="h-10 rounded-md font-semibold">
          <Download className="size-4" /> Export log
        </Button>
        <Button type="button" variant="outline" onClick={onToggleFilters} className="h-10 rounded-md font-semibold">
          <Filter className="size-4" /> More filters
        </Button>
      </div>
    </div>
  );
}

function AuditLogFilters({
  vm,
  events,
  users,
}: {
  vm: AuditVm;
  events: PrismEvent[];
  users: PrismUser[];
}) {
  return (
    <>
      <div className="mt-5 flex flex-wrap gap-2">
        <div className="relative min-w-[240px] flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={vm.query} onChange={(event) => vm.setQuery(event.target.value)} className="h-10 bg-white pl-9" placeholder="Search logs..." />
        </div>
        <SegmentedControl
          label="Filter audit log by category"
          options={vm.auditCategories.map((item) => ({ value: item, label: sentenceCase(label(item)) }))}
          value={vm.category}
          onChange={vm.setCategory}
          className="self-center"
        />
      </div>
      {vm.advancedOpen ? <AuditAdvancedFilters vm={vm} events={events} users={users} /> : null}
    </>
  );
}

function AuditAdvancedFilters({
  vm,
  events,
  users,
}: {
  vm: AuditVm;
  events: PrismEvent[];
  users: PrismUser[];
}) {
  return (
    <div className="mt-4 grid gap-3 rounded-lg border border-border bg-muted p-4 md:grid-cols-4">
      <Field>
        <FieldLabel htmlFor="audit-filter-event">Event</FieldLabel>
        <Select value={vm.eventId} onValueChange={vm.setEventId}>
          <SelectTrigger id="audit-filter-event" className="w-full min-w-0 bg-white">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All events</SelectItem>
            {events.map((event) => <SelectItem key={event.id} value={event.id}>{event.eventName}</SelectItem>)}
          </SelectContent>
        </Select>
      </Field>
      <Field>
        <FieldLabel htmlFor="audit-filter-user">User</FieldLabel>
        <Select value={vm.actor} onValueChange={vm.setActor}>
          <SelectTrigger id="audit-filter-user" className="w-full min-w-0 bg-white">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All users</SelectItem>
            {users.map((user) => <SelectItem key={user.id} value={user.name}>{user.name}</SelectItem>)}
            <SelectItem value="System">System</SelectItem>
          </SelectContent>
        </Select>
      </Field>
      <Field>
        <FieldLabel htmlFor="audit-filter-action">Action Type</FieldLabel>
        <Select value={vm.actionType} onValueChange={vm.setActionType}>
          <SelectTrigger id="audit-filter-action" className="w-full min-w-0 bg-white">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {vm.auditActionTypes.map((item) => <SelectItem key={item} value={item}>{label(item)}</SelectItem>)}
          </SelectContent>
        </Select>
      </Field>
      <Field>
        <FieldLabel htmlFor="audit-filter-range">Date Range</FieldLabel>
        <Select value={vm.dateRange} onValueChange={vm.setDateRange}>
          <SelectTrigger id="audit-filter-range" className="w-full min-w-0 bg-white">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {vm.auditDateRanges.map(([value, text]) => <SelectItem key={value} value={value}>{text}</SelectItem>)}
          </SelectContent>
        </Select>
      </Field>
      <Field className="md:col-span-2">
        <FieldLabel htmlFor="audit-filter-severity">Severity</FieldLabel>
        <Select value={vm.severity} onValueChange={vm.setSeverity}>
          <SelectTrigger id="audit-filter-severity" className="w-full min-w-0 bg-white">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All severities</SelectItem>
            <SelectItem value="info">Info</SelectItem>
            <SelectItem value="warning">Warning</SelectItem>
            <SelectItem value="critical">Critical</SelectItem>
          </SelectContent>
        </Select>
      </Field>
      <div className="rounded-md bg-white p-3 text-xs leading-5 text-muted-foreground md:col-span-2">
        Audit rows are append-only in the UI/API surface. Each new service-created log receives a tamper-evident hash and previous-hash pointer.
      </div>
    </div>
  );
}

const AUDIT_PAGE_SIZE = 15;

function AuditLogList({ logs, busy }: { logs: PrismAuditLog[]; busy: boolean }) {
  const groups = useMemo(() => groupRepeatedAuditLogs(logs), [logs]);
  const paged = usePagedItems(groups, AUDIT_PAGE_SIZE);
  return (
    <div className="mt-4 overflow-hidden rounded-lg border border-border bg-white">
      {busy && logs.length === 0 ? <LoadingState label="Loading audit events…" className="p-6" /> : null}
      {!busy && logs.length === 0 ? <div className="p-6 text-sm text-muted-foreground">No audit logs match the active filters.</div> : null}
      {groups.length > 0 ? (
        <div aria-hidden="true" className={cx("hidden border-b border-border px-4 py-2 text-xs text-muted-foreground", AUDIT_ROW_GRID)}>
          <span>When</span>
          <span>Who</span>
          <span>What happened</span>
          <span className="text-right">Area</span>
        </div>
      ) : null}
      <ul className="divide-y divide-border">
        {paged.pageItems.map((group) => (
          <AuditLogRow key={group.log.id} group={group} />
        ))}
      </ul>
      <ListPager
        label="Audit log pages"
        rangeLabel={`${paged.rangeLabel} entries`}
        page={paged.page}
        pageCount={paged.pageCount}
        onPrevious={paged.previous}
        onNext={paged.next}
      />
    </div>
  );
}

function sentenceCase(text: string) {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

const AUDIT_ROW_GRID = "md:grid md:grid-cols-[9.5rem_minmax(0,13rem)_minmax(0,1fr)_7rem] md:items-center md:gap-4";

const SEVERITY_TEXT: Record<string, string> = { critical: "text-danger", warning: "text-attention" };

/** Audit ID, plus IP and device when they were recorded: kept in the row's tooltip, not the visible line. */
function auditTrace(log: AuditLogGroup["log"]) {
  const known = (value?: string | null) => (value && value !== "unknown" ? value : null);
  const ip = known(log.ipAddress);
  return [`Audit ID ${log.id}`, ip ? `IP ${ip}` : null, known(log.device)].filter(Boolean).join(" · ");
}

function AuditLogRow({ group }: { group: AuditLogGroup }) {
  const { log, count, oldestAt } = group;
  const Icon = AUDIT_ICONS[auditIconKind(log.category, log.severity)];
  const severityText = SEVERITY_TEXT[log.severity];
  return (
    <li title={auditTrace(log)} className={cx("grid gap-1 px-4 py-2.5 text-sm hover:bg-surface-raised", AUDIT_ROW_GRID)}>
      <span className="text-xs tabular-nums text-muted-foreground">{formatPortalDateTime(log.createdAt)}</span>
      <span className="min-w-0 truncate">
        <span className="font-medium text-foreground">{log.actor}</span>
        <span className="text-xs text-muted-foreground"> · {roleLabel(log.actorRole)}</span>
      </span>
      <span className="min-w-0">
        <span className="text-foreground">{log.action}</span>
        {log.affectedLabel ? <span className="text-muted-foreground"> · {log.affectedLabel}</span> : null}
        {count > 1 ? (
          <span className="ml-2 whitespace-nowrap rounded-md bg-muted px-1.5 py-0.5 text-xs font-medium text-muted-foreground">
            {count}× since {formatPortalTime(oldestAt)}
          </span>
        ) : null}
        {severityText ? <span className={cx("ml-2 text-xs font-semibold", severityText)}>{label(log.severity)}</span> : null}
      </span>
      <span className="flex items-center gap-1.5 text-xs text-muted-foreground md:justify-end">
        <Icon aria-hidden="true" className={cx("size-3.5", severityText ?? "text-muted-foreground")} />
        {label(log.category)}
      </span>
    </li>
  );
}

export function SecurityAlertsPanel({ alerts }: { alerts: PrismSecurityAlert[] }) {
  return (
    <Panel title="Security event alerts" icon={AlertTriangle}>
      <div className="space-y-3">
        {alerts.length === 0 ? <p className="text-sm text-muted-foreground">No security alerts have been triggered.</p> : null}
        {alerts.slice(0, 6).map((alert) => (
          <div key={alert.id} className="rounded-md border border-border bg-background p-3 text-sm">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="font-semibold">{alert.title}</p>
                <p className="mt-1 text-muted-foreground">{alert.description}</p>
              </div>
              <span className={cx("rounded-full px-2 py-1 text-2xs font-semibold capitalize", severityTone(alert.severity))}>{alert.severity}</span>
            </div>
            <p className="mt-2 text-xs text-muted-foreground">{compactTimestamp(alert.createdAt)} - {alert.triggeredBy}</p>
          </div>
        ))}
      </div>
    </Panel>
  );
}
