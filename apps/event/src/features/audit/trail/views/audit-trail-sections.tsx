"use client";

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

import type { PrismAuditLog, PrismEvent, PrismPrivacyRequest, PrismUser, PrismLoginHistory, PrismSecurityAlert } from "@prism/types";
import { Alert, AlertDescription } from "@/app/components/ui/alert";
import { Button } from "@/app/components/ui/button";
import { Input } from "@/app/components/ui/input";
import { auditTone, compactTimestamp, cx, label, severityTone } from "@/features/pmcm-kit";
import { Metric, Panel } from "@/features/pmcm-kit";
import { auditIconKind, auditIntegrityCopy } from "../model/audit-trail-rules";
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
        <p className="text-xs font-black uppercase tracking-[0.18em] text-(--prism-amber)">New-SEC4</p>
        <h2 className="mt-2 text-2xl font-black text-foreground">Comprehensive Audit Trail & Activity Log</h2>
        <p className="mt-1 text-sm text-muted-foreground">Full history of user, system, access, supplier, finance, and document actions visible only to PMCM command users.</p>
      </div>
      <div className="flex flex-wrap gap-2">
        <Button type="button" variant="outline" disabled={busy} onClick={onExport} className="h-10 rounded-md font-black">
          <Download className="size-4" /> Export Log
        </Button>
        <Button type="button" variant="outline" onClick={onToggleFilters} className="h-10 rounded-md font-black">
          <Filter className="size-4" /> Advanced Filter
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
        integrity.valid ? "border-emerald-200 bg-emerald-50 text-emerald-800" : "border-rose-200 bg-rose-50 text-rose-800",
      )}>
        <div className="flex items-center justify-between gap-3">
          <p className="text-xs font-black uppercase tracking-[0.16em]">Audit integrity</p>
          <ShieldCheck className="size-4" />
        </div>
        <p className="mt-2 text-2xl font-black">{integrity.headline}</p>
        <p className="mt-1 text-xs">{integrity.detail}</p>
      </div>
      <div className="rounded-lg border border-border bg-white p-4">
        <div className="flex items-center justify-between gap-3">
          <p className="text-xs font-black uppercase tracking-[0.16em] text-muted-foreground">Privacy records</p>
          <Database className="size-4 text-(--prism-amber)" />
        </div>
        <p className="mt-2 text-2xl font-black text-foreground">{privacyRecordCount}</p>
        <p className="mt-1 text-xs text-muted-foreground">{privacySurfaceCount} personal-data surfaces indexed</p>
      </div>
      <div className={cx(
        "rounded-lg border p-4",
        missingConsentCount > 0 ? "border-amber-200 bg-amber-50 text-amber-900" : "border-border bg-white text-foreground",
      )}>
        <div className="flex items-center justify-between gap-3">
          <p className="text-xs font-black uppercase tracking-[0.16em]">Consent gaps</p>
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
      <label className="text-xs font-black uppercase tracking-wide text-muted-foreground">
        Event
        <select value={vm.eventId} onChange={(event) => vm.setEventId(event.target.value)} className="mt-2 h-10 w-full rounded-md border border-border bg-white px-3 text-sm normal-case text-foreground">
          <option value="all">All events</option>
          {events.map((event) => <option key={event.id} value={event.id}>{event.eventName}</option>)}
        </select>
      </label>
      <label className="text-xs font-black uppercase tracking-wide text-muted-foreground">
        User
        <select value={vm.actor} onChange={(event) => vm.setActor(event.target.value)} className="mt-2 h-10 w-full rounded-md border border-border bg-white px-3 text-sm normal-case text-foreground">
          <option value="all">All users</option>
          {users.map((user) => <option key={user.id} value={user.name}>{user.name}</option>)}
          <option value="System">System</option>
        </select>
      </label>
      <label className="text-xs font-black uppercase tracking-wide text-muted-foreground">
        Action Type
        <select value={vm.actionType} onChange={(event) => vm.setActionType(event.target.value)} className="mt-2 h-10 w-full rounded-md border border-border bg-white px-3 text-sm normal-case text-foreground">
          {vm.auditActionTypes.map((item) => <option key={item} value={item}>{label(item)}</option>)}
        </select>
      </label>
      <label className="text-xs font-black uppercase tracking-wide text-muted-foreground">
        Date Range
        <select value={vm.dateRange} onChange={(event) => vm.setDateRange(event.target.value)} className="mt-2 h-10 w-full rounded-md border border-border bg-white px-3 text-sm normal-case text-foreground">
          {vm.auditDateRanges.map(([value, text]) => <option key={value} value={value}>{text}</option>)}
        </select>
      </label>
      <label className="text-xs font-black uppercase tracking-wide text-muted-foreground md:col-span-2">
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

function AuditLogList({ logs, busy }: { logs: PrismAuditLog[]; busy: boolean }) {
  return (
    <div className="mt-4 overflow-hidden rounded-lg border border-border bg-white">
      {busy && logs.length === 0 ? <div className="p-6 text-sm text-muted-foreground">Loading audit events...</div> : null}
      {!busy && logs.length === 0 ? <div className="p-6 text-sm text-muted-foreground">No audit logs match the active filters.</div> : null}
      {logs.map((log) => (
        <AuditLogRow key={log.id} log={log} />
      ))}
    </div>
  );
}

function AuditLogRow({ log }: { log: PrismAuditLog }) {
  const Icon = AUDIT_ICONS[auditIconKind(log.category, log.severity)];
  return (
    <article className="grid gap-3 border-b border-border p-4 last:border-b-0 md:grid-cols-[minmax(0,1fr)_220px] md:items-center">
      <div className="flex min-w-0 gap-3">
        <span className={cx("grid size-9 shrink-0 place-items-center rounded-md ring-1", severityTone(log.severity))}>
          <Icon className="size-4" />
        </span>
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <p className="font-black text-foreground">{log.actor}</p>
            <span className="text-xs text-muted-foreground">({label(log.actorRole)})</span>
            <span className={cx("rounded-full px-2 py-0.5 text-[11px] font-black capitalize ring-1", auditTone(log.category))}>{label(log.category)}</span>
            {log.severity !== "info" ? <span className={cx("rounded-full px-2 py-0.5 text-[11px] font-black capitalize ring-1", severityTone(log.severity))}>{log.severity}</span> : null}
          </div>
          <p className="mt-1 text-sm text-foreground">{log.action}</p>
          {log.affectedLabel ? <p className="mt-1 text-xs text-muted-foreground">Affected: {log.affectedLabel}</p> : null}
        </div>
      </div>
      <div className="text-left text-xs text-muted-foreground md:text-right">
        <p className="font-semibold text-foreground">{compactTimestamp(log.createdAt)}</p>
        <p>{log.ipAddress}</p>
        <p className="font-mono text-[10px] uppercase tracking-wide">{log.id}</p>
      </div>
    </article>
  );
}

export function PrivacyOperationsPanel({ vm }: { vm: AuditVm }) {
  return (
    <Panel title="Privacy operations" icon={Database}>
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_300px]">
        <div className="space-y-3">
          <div className="grid gap-2 rounded-md border border-border bg-background p-3 sm:grid-cols-2">
            <select
              value={vm.privacyForm.subjectType}
              onChange={(event) => vm.setPrivacyForm((current) => ({ ...current, subjectType: event.target.value }))}
              className="h-10 rounded-md border border-border bg-white px-3 text-sm"
            >
              <option value="client">Client</option>
              <option value="supplier">Supplier</option>
              <option value="guest">Guest</option>
            </select>
            <select
              value={vm.privacyForm.requestType}
              onChange={(event) => vm.setPrivacyForm((current) => ({ ...current, requestType: event.target.value as typeof vm.privacyForm.requestType }))}
              className="h-10 rounded-md border border-border bg-white px-3 text-sm"
            >
              <option value="access">Access</option>
              <option value="correction">Correction</option>
              <option value="deletion">Deletion</option>
              <option value="export">Export</option>
            </select>
            <Input value={vm.privacyForm.subjectEmail} onChange={(event) => vm.setPrivacyForm((current) => ({ ...current, subjectEmail: event.target.value }))} className="h-10 bg-white" placeholder="Subject email" />
            <Input value={vm.privacyForm.subjectName} onChange={(event) => vm.setPrivacyForm((current) => ({ ...current, subjectName: event.target.value }))} className="h-10 bg-white" placeholder="Subject name" />
            <textarea
              value={vm.privacyForm.requestNotes}
              onChange={(event) => vm.setPrivacyForm((current) => ({ ...current, requestNotes: event.target.value }))}
              className="min-h-20 rounded-md border border-border bg-white px-3 py-2 text-sm sm:col-span-2"
              placeholder="Request notes"
            />
            <Button type="button" disabled={vm.busy || (!vm.privacyForm.subjectEmail && !vm.privacyForm.subjectName)} onClick={vm.logPrivacyRequest} className="h-10 rounded-md font-black sm:col-span-2">
              Log privacy request
            </Button>
          </div>
          {vm.privacyRequests.length === 0 ? <p className="text-sm text-muted-foreground">No privacy requests are queued.</p> : null}
          {vm.privacyRequests.slice(0, 5).map((request) => (
            <PrivacyRequestCard key={request.id} request={request} busy={vm.busy} onReview={vm.reviewPrivacyRequest} onExecute={vm.executePrivacyRequest} />
          ))}
        </div>
        <div className="space-y-2">
          {vm.privacyPolicies.slice(0, 7).map((policy) => (
            <div key={policy.surface} className="rounded-md bg-background p-3 text-xs">
              <p className="font-black capitalize text-foreground">{label(policy.surface)}</p>
              <p className="mt-1 text-muted-foreground">{policy.retentionPeriod}</p>
            </div>
          ))}
        </div>
      </div>
    </Panel>
  );
}

function PrivacyRequestCard({
  request,
  busy,
  onReview,
  onExecute,
}: {
  request: PrismPrivacyRequest;
  busy: boolean;
  onReview: (id: string, status: "approved" | "rejected") => void;
  onExecute: (id: string) => void;
}) {
  const tone = request.status === "executed" ? severityTone("info") : severityTone(request.status === "rejected" ? "warning" : "info");
  return (
    <div className="rounded-md border border-border bg-background p-3 text-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="font-black capitalize">{label(request.requestType)} request</p>
          <p className="mt-1 text-muted-foreground">{request.subjectEmail || request.subjectName || "Unnamed subject"}</p>
        </div>
        <span className={cx("rounded-full px-2 py-1 text-[11px] font-black capitalize ring-1", tone)}>
          {label(request.status)}
        </span>
      </div>
      {request.requestNotes ? <p className="mt-2 text-xs text-muted-foreground">{request.requestNotes}</p> : null}
      <div className="mt-3 flex flex-wrap gap-2">
        {request.status === "submitted" ? (
          <>
            <Button type="button" variant="outline" size="sm" disabled={busy} onClick={() => onReview(request.id, "approved")}>Approve</Button>
            <Button type="button" variant="outline" size="sm" disabled={busy} onClick={() => onReview(request.id, "rejected")}>Reject</Button>
          </>
        ) : null}
        {request.status === "approved" ? (
          <Button type="button" variant="outline" size="sm" disabled={busy} onClick={() => onExecute(request.id)}>Execute</Button>
        ) : null}
      </div>
    </div>
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
              <span className={cx("rounded-full px-2 py-1 text-[11px] font-black capitalize ring-1", severityTone(alert.severity))}>{alert.severity}</span>
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
              <span className={cx("rounded-full px-2 py-1 text-[11px] font-black capitalize ring-1", entry.status === "success" ? severityTone("info") : severityTone("warning"))}>
                {label(entry.userRole)}
              </span>
            </div>
            <p className="mt-1 text-xs text-muted-foreground">{compactTimestamp(entry.createdAt)}</p>
            <p className="mt-1 text-xs text-muted-foreground">{entry.ipAddress} - {entry.device}</p>
            {entry.failureReason ? <p className="mt-1 text-xs text-rose-700">{entry.failureReason}</p> : null}
          </div>
        ))}
      </div>
    </Panel>
  );
}
