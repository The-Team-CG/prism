"use client";

import Link from "next/link";
import { useMemo } from "react";
import { formatPortalDateTime, formatPortalTime } from "@prism/ui/format-date";

import {
  AlertTriangle,
  ClipboardList,
  Database,
  Download,
  FileCheck2,
  Filter,
  KeyRound,
  ListFilter,
  ReceiptText,
  RotateCcw,
  Search,
  ShieldCheck,
  Truck,
  UserCheck,
  UserRound,
} from "lucide-react";

import type { PrismAuditLog, PrismEvent, PrismUser, PrismLoginHistory, PrismSecurityAlert } from "@prism/types";
import { Alert, AlertDescription } from "@/app/components/ui/alert";
import { Button } from "@/app/components/ui/button";
import { Input } from "@/app/components/ui/input";
import { compactTimestamp, cx, label, roleLabel, severityTone } from "@/features/pmcm-kit";
import { Metric, Panel } from "@/features/pmcm-kit";
import { auditIconKind, auditIntegrityCopy, groupRepeatedAuditLogs, type AuditLogGroup } from "../model/audit-trail-rules";
import { usePagedItems } from "../view-models/use-paged-items";
import { ListPager } from "./list-pager";
import type { useAuditTrailViewModel } from "../view-models/use-audit-trail-view-model";

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
    <section className="rounded-lg border border-border bg-card p-5 shadow-[0_18px_70px_rgba(23,18,22,0.07)]">
      <AuditTrailHeader busy={vm.busy} onExport={vm.exportLog} onToggleFilters={() => vm.setAdvancedOpen((value) => !value)} />
      <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-7">
        <Metric label="Total events (view)" value={vm.logs.length} icon={ListFilter} />
        <Metric label="User actions" value={vm.userActionCount} icon={UserCheck} />
        <Metric label="System events" value={vm.systemActionCount} icon={RotateCcw} />
        <Metric label="Alerts triggered" value={vm.openAlertCount} icon={AlertTriangle} />
        <Metric label="Failed logins" value={vm.failedLoginCount} icon={KeyRound} />
        <Metric label="Approval backlog" value={vm.approvalBacklog} icon={ShieldCheck} />
        <Metric label="Privacy backlog" value={vm.privacyBacklog} icon={Database} />
      </div>
      <AuditIntegrityCards
        auditIntegrity={vm.auditIntegrity}
        privacyRecordCount={vm.privacyRecordCount}
        privacySurfaceCount={vm.privacySurfaceCount}
        missingConsentCount={vm.missingConsentCount}
        retentionNote={vm.retentionNote}
      />
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

function AuditTrailHeader({
  busy,
  onExport,
  onToggleFilters,
}: {
  busy: boolean;
  onExport: () => void;
  onToggleFilters: () => void;
}) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-4">
      <div>
        <h2 className="text-xl font-bold text-foreground">Audit trail</h2>
        <p className="mt-1 text-sm text-muted-foreground">Every user, system, access, supplier, finance and document action. Visible to PMCM only.</p>
      </div>
      <div className="flex flex-wrap gap-2">
        <Button type="button" variant="outline" disabled={busy} onClick={onExport} className="h-10 rounded-md font-black">
          <Download className="size-4" /> Export log
        </Button>
        <Button type="button" variant="outline" onClick={onToggleFilters} className="h-10 rounded-md font-black">
          <Filter className="size-4" /> More filters
        </Button>
      </div>
    </div>
  );
}

function AuditIntegrityCards({
  auditIntegrity,
  privacyRecordCount,
  privacySurfaceCount,
  missingConsentCount,
  retentionNote,
}: {
  auditIntegrity: AuditVm["auditIntegrity"];
  privacyRecordCount: number;
  privacySurfaceCount: number;
  missingConsentCount: number;
  retentionNote: string;
}) {
  const integrity = auditIntegrityCopy(auditIntegrity);
  return (
    <div className="mt-3 grid gap-3 md:grid-cols-3">
      <div className={cx(
        "rounded-lg border p-4",
        integrity.valid ? "border-success/25 bg-success-soft text-success" : "border-danger/25 bg-danger-soft text-danger",
      )}>
        <div className="flex items-center justify-between gap-3">
          <p className="text-xs font-medium">Audit integrity</p>
          <ShieldCheck className="size-4" />
        </div>
        <p className="mt-2 text-2xl font-black">{integrity.headline}</p>
        <p className="mt-1 text-xs">{integrity.detail}</p>
      </div>
      <div className="rounded-lg border border-border bg-white p-4">
        <div className="flex items-center justify-between gap-3">
          <p className="text-xs font-medium text-muted-foreground">Privacy records</p>
          <Database className="size-4 text-attention" />
        </div>
        <p className="mt-2 text-2xl font-black text-foreground">{privacyRecordCount}</p>
        <p className="mt-1 text-xs text-muted-foreground">{privacySurfaceCount} personal-data surfaces indexed</p>
      </div>
      <div className={cx(
        "rounded-lg border p-4",
        missingConsentCount > 0 ? "border-attention/25 bg-attention-soft text-attention" : "border-border bg-white text-foreground",
      )}>
        <div className="flex items-center justify-between gap-3">
          <p className="text-xs font-medium">Consent gaps</p>
          <AlertTriangle className="size-4" />
        </div>
        <p className="mt-2 text-2xl font-black">{missingConsentCount}</p>
        <p className="mt-1 text-xs">{retentionNote}</p>
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
        {vm.auditCategories.map((item) => (
          <button
            key={item}
            type="button"
            onClick={() => vm.setCategory(item)}
            className={cx(
              "h-10 rounded-full border px-4 text-xs font-black capitalize transition-colors",
              vm.category === item ? "border-primary bg-secondary text-foreground" : "border-border bg-white text-muted-foreground hover:text-foreground",
            )}
          >
            {label(item)}
          </button>
        ))}
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
      <label className="text-xs font-medium text-muted-foreground">
        Event
        <select value={vm.eventId} onChange={(event) => vm.setEventId(event.target.value)} className="mt-2 h-10 w-full rounded-md border border-border bg-white px-3 text-sm normal-case text-foreground">
          <option value="all">All events</option>
          {events.map((event) => <option key={event.id} value={event.id}>{event.eventName}</option>)}
        </select>
      </label>
      <label className="text-xs font-medium text-muted-foreground">
        User
        <select value={vm.actor} onChange={(event) => vm.setActor(event.target.value)} className="mt-2 h-10 w-full rounded-md border border-border bg-white px-3 text-sm normal-case text-foreground">
          <option value="all">All users</option>
          {users.map((user) => <option key={user.id} value={user.name}>{user.name}</option>)}
          <option value="System">System</option>
        </select>
      </label>
      <label className="text-xs font-medium text-muted-foreground">
        Action Type
        <select value={vm.actionType} onChange={(event) => vm.setActionType(event.target.value)} className="mt-2 h-10 w-full rounded-md border border-border bg-white px-3 text-sm normal-case text-foreground">
          {vm.auditActionTypes.map((item) => <option key={item} value={item}>{label(item)}</option>)}
        </select>
      </label>
      <label className="text-xs font-medium text-muted-foreground">
        Date Range
        <select value={vm.dateRange} onChange={(event) => vm.setDateRange(event.target.value)} className="mt-2 h-10 w-full rounded-md border border-border bg-white px-3 text-sm normal-case text-foreground">
          {vm.auditDateRanges.map(([value, text]) => <option key={value} value={value}>{text}</option>)}
        </select>
      </label>
      <label className="text-xs font-medium text-muted-foreground md:col-span-2">
        Severity
        <select value={vm.severity} onChange={(event) => vm.setSeverity(event.target.value)} className="mt-2 h-10 w-full rounded-md border border-border bg-white px-3 text-sm normal-case text-foreground">
          <option value="all">All severities</option>
          <option value="info">Info</option>
          <option value="warning">Warning</option>
          <option value="critical">Critical</option>
        </select>
      </label>
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
      {busy && logs.length === 0 ? <div className="p-6 text-sm text-muted-foreground">Loading audit events…</div> : null}
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

export function PrivacyConsoleLinkPanel() {
  return (
    <Panel title="Privacy operations" icon={Database}>
      <div className="space-y-3 text-sm">
        <p className="text-muted-foreground">
          Privacy requests, deadlines, owners, legal holds, and retention policies are managed in the privacy console.
        </p>
        <Link href="/dashboard/privacy" className="inline-flex h-10 items-center rounded-md border border-border bg-white px-4 font-black text-foreground hover:bg-background">
          Open privacy console
        </Link>
      </div>
    </Panel>
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
                <p className="font-black">{alert.title}</p>
                <p className="mt-1 text-muted-foreground">{alert.description}</p>
              </div>
              <span className={cx("rounded-full px-2 py-1 text-2xs font-black capitalize ring-1", severityTone(alert.severity))}>{alert.severity}</span>
            </div>
            <p className="mt-2 text-xs text-muted-foreground">{compactTimestamp(alert.createdAt)} - {alert.triggeredBy}</p>
          </div>
        ))}
      </div>
    </Panel>
  );
}

export function LoginHistoryPanel({ loginHistory }: { loginHistory: PrismLoginHistory[] }) {
  return (
    <Panel title="My last five sessions" icon={KeyRound}>
      <div className="space-y-3">
        {loginHistory.length === 0 ? <p className="text-sm text-muted-foreground">No login history recorded for this profile yet.</p> : null}
        {loginHistory.map((entry) => (
          <div key={entry.id} className="rounded-md bg-background p-3 text-sm">
            <div className="flex items-center justify-between gap-3">
              <p className="font-black capitalize">{label(entry.status)}</p>
              <span className={cx("rounded-full px-2 py-1 text-2xs font-black capitalize ring-1", entry.status === "success" ? severityTone("info") : severityTone("warning"))}>
                {label(entry.userRole)}
              </span>
            </div>
            <p className="mt-1 text-xs text-muted-foreground">{compactTimestamp(entry.createdAt)}</p>
            <p className="mt-1 text-xs text-muted-foreground">{entry.ipAddress} - {entry.device}</p>
            {entry.failureReason ? <p className="mt-1 text-xs text-danger">{entry.failureReason}</p> : null}
          </div>
        ))}
      </div>
    </Panel>
  );
}
