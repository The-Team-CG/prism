import { useEventOpsCommands } from "@/features/event-ops";
import { useEffect, useMemo, useState } from "react";
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

import {
  type PrismApprovalRequest,
  type PrismAuditIntegrity,
  type PrismAuditLog,
  type PrismEvent,
  type PrismLoginHistory,
  type PrismPrivacyInventory,
  type PrismPrivacyRequest,
  type PrismPrivacyRetentionPolicy,
  type PrismSecurityAlert,
  type PrismUser
} from "@/lib/prism-api";
import { Alert, AlertDescription } from "@/app/components/ui/alert";
import { Button } from "@/app/components/ui/button";
import { Input } from "@/app/components/ui/input";
import {
  auditActionTypes,
  auditCategories,
  auditDateRanges,
  auditTone,
  compactTimestamp,
  csvCell,
  cx,
  label,
  severityTone,
} from "@/features/pmcm-kit";
import { Metric, Panel } from "@/features/pmcm-kit";
import type { PmcmEventSession } from "@/features/pmcm-kit";

function auditIcon(category: string, severity: string) {
  if (severity === "critical" || severity === "warning") return AlertTriangle;
  if (category === "access") return UserRound;
  if (category === "documents") return FileCheck2;
  if (category === "finance") return ReceiptText;
  if (category === "suppliers") return Truck;
  return ClipboardList;
}

export function AuditTrailPanel({
  events,
  users,
  session,
}: {
  events: PrismEvent[];
  users: PrismUser[];
  session: PmcmEventSession;
}) {
  const ops = useEventOpsCommands();
  const [logs, setLogs] = useState<PrismAuditLog[]>([]);
  const [alerts, setAlerts] = useState<PrismSecurityAlert[]>([]);
  const [auditIntegrity, setAuditIntegrity] = useState<PrismAuditIntegrity | null>(null);
  const [privacyInventory, setPrivacyInventory] = useState<PrismPrivacyInventory | null>(null);
  const [privacyPolicies, setPrivacyPolicies] = useState<PrismPrivacyRetentionPolicy[]>([]);
  const [privacyRequests, setPrivacyRequests] = useState<PrismPrivacyRequest[]>([]);
  const [approvalRequests, setApprovalRequests] = useState<PrismApprovalRequest[]>([]);
  const [loginHistory, setLoginHistory] = useState<PrismLoginHistory[]>([]);
  const [privacyForm, setPrivacyForm] = useState({
    subjectType: "guest",
    requestType: "deletion" as "access" | "correction" | "deletion" | "export",
    subjectEmail: "",
    subjectName: "",
    requestNotes: "",
  });
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("all");
  const [eventId, setEventId] = useState("all");
  const [actor, setActor] = useState("all");
  const [actionType, setActionType] = useState("all");
  const [severity, setSeverity] = useState("all");
  const [dateRange, setDateRange] = useState("30d");
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const filters = useMemo(() => ({
    query,
    category,
    eventId,
    actor,
    actionType,
    severity,
    dateRange,
    limit: "120",
  }), [query, category, eventId, actor, actionType, severity, dateRange]);

  async function refreshAudit() {
    setBusy(true);
    setError(null);
    try {
      const [nextLogs, nextAlerts, nextHistory, nextIntegrity, nextInventory, nextApprovals, nextPolicies, nextPrivacyRequests] = await Promise.all([
        ops.auditLogs(filters),
        ops.securityAlerts(),
        ops.loginHistory(session.id),
        ops.auditIntegrity(),
        ops.privacyInventory(eventId),
        ops.approvalRequests(),
        ops.privacyRetentionPolicies(),
        ops.privacyRequests(eventId),
      ]);
      setLogs(nextLogs);
      setAlerts(nextAlerts);
      setLoginHistory(nextHistory);
      setAuditIntegrity(nextIntegrity);
      setPrivacyInventory(nextInventory);
      setApprovalRequests(nextApprovals);
      setPrivacyPolicies(nextPolicies);
      setPrivacyRequests(nextPrivacyRequests);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load audit trail");
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    refreshAudit();
  }, [filters]);

  async function exportLog() {
    setBusy(true);
    setError(null);
    try {
      const exported = await ops.exportAuditLogs(filters);
      const header = ["Log ID", "Timestamp", "Actor", "Role", "Category", "Action Type", "Action", "Affected", "IP", "Device", "Hash"];
      const rows = exported.rows.map((log) => [
        log.id,
        log.createdAt,
        log.actor,
        log.actorRole,
        log.category,
        log.actionType,
        log.action,
        log.affectedLabel ?? log.affectedId ?? "",
        log.ipAddress,
        log.device,
        log.immutableHash,
      ]);
      const csv = [header, ...rows].map((row) => row.map(csvCell).join(",")).join("\n");
      const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `prism-audit-log-${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
      await refreshAudit();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to export audit log");
    } finally {
      setBusy(false);
    }
  }

  async function logPrivacyRequest() {
    setBusy(true);
    setError(null);
    try {
      await ops.createPrivacyRequest({
        subjectType: privacyForm.subjectType,
        requestType: privacyForm.requestType,
        subjectEmail: privacyForm.subjectEmail,
        subjectName: privacyForm.subjectName,
        eventId: eventId !== "all" ? eventId : undefined,
        requestNotes: privacyForm.requestNotes,
      });
      setPrivacyForm((current) => ({ ...current, subjectEmail: "", subjectName: "", requestNotes: "" }));
      await refreshAudit();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to log privacy request");
    } finally {
      setBusy(false);
    }
  }

  async function reviewPrivacyRequest(requestId: string, status: "approved" | "rejected") {
    setBusy(true);
    setError(null);
    try {
      await ops.reviewPrivacyRequest(requestId, {
        status,
        reviewReason: status === "approved" ? "Validated by PMCM privacy review." : "Rejected by PMCM privacy review.",
      });
      await refreshAudit();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to review privacy request");
    } finally {
      setBusy(false);
    }
  }

  async function executePrivacyRequest(requestId: string) {
    setBusy(true);
    setError(null);
    try {
      await ops.executePrivacyRequest(requestId, "Executed from PMCM privacy operations panel.");
      await refreshAudit();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to execute privacy request");
    } finally {
      setBusy(false);
    }
  }

  const userActionCount = logs.filter((log) => log.actorRole !== "system").length;
  const systemActionCount = logs.filter((log) => log.actorRole === "system").length;
  const openAlerts = alerts.filter((alert) => alert.status === "open");
  const failedLoginCount = loginHistory.filter((entry) => entry.status !== "success").length;
  const approvalBacklog = approvalRequests.filter((request) => request.status === "pending").length;
  const privacyBacklog = privacyRequests.filter((request) => request.status === "submitted").length;
  const retentionNote = privacyInventory?.retentionNotes?.[0] ?? "Sample retention notes unavailable";
  const privacySurfaces = [
    ...(privacyInventory?.globalSurfaces ?? []),
    ...(privacyInventory?.events ?? []).flatMap((event) => event.surfaces),
  ];
  const privacyRecordCount = privacySurfaces.reduce((total, surface) => total + surface.recordCount, 0);
  const missingConsentCount = privacySurfaces.reduce((total, surface) => total + surface.missingConsentCount, 0);

  return (
    <div className="space-y-5">
      <section className="rounded-lg border border-border bg-card p-5 shadow-[0_18px_70px_rgba(23,18,22,0.07)]">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.18em] text-(--prism-amber)">New-SEC4</p>
            <h2 className="mt-2 text-2xl font-black text-foreground">Comprehensive Audit Trail & Activity Log</h2>
            <p className="mt-1 text-sm text-muted-foreground">Full history of user, system, access, supplier, finance, and document actions visible only to PMCM command users.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="outline" disabled={busy} onClick={exportLog} className="h-10 rounded-md font-black">
              <Download className="size-4" /> Export Log
            </Button>
            <Button type="button" variant="outline" onClick={() => setAdvancedOpen((value) => !value)} className="h-10 rounded-md font-black">
              <Filter className="size-4" /> Advanced Filter
            </Button>
          </div>
        </div>

        <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-7">
          <Metric label="Total events (view)" value={logs.length} icon={ListFilter} />
          <Metric label="User actions" value={userActionCount} icon={UserCheck} />
          <Metric label="System events" value={systemActionCount} icon={RotateCcw} />
          <Metric label="Alerts triggered" value={openAlerts.length} icon={AlertTriangle} />
          <Metric label="Failed logins" value={failedLoginCount} icon={KeyRound} />
          <Metric label="Approval backlog" value={approvalBacklog} icon={ShieldCheck} />
          <Metric label="Privacy backlog" value={privacyBacklog} icon={Database} />
        </div>

        <div className="mt-3 grid gap-3 md:grid-cols-3">
          <div className={cx(
            "rounded-lg border p-4",
            auditIntegrity?.valid === false ? "border-rose-200 bg-rose-50 text-rose-800" : "border-emerald-200 bg-emerald-50 text-emerald-800",
          )}>
            <div className="flex items-center justify-between gap-3">
              <p className="text-xs font-black uppercase tracking-[0.16em]">Audit integrity</p>
              <ShieldCheck className="size-4" />
            </div>
            <p className="mt-2 text-2xl font-black">{auditIntegrity?.valid === false ? "Broken" : "Valid"}</p>
            <p className="mt-1 text-xs">
              {auditIntegrity ? `${auditIntegrity.checkedCount} rows checked` : "Not checked yet"}
              {auditIntegrity?.firstBrokenLogId ? ` - first break ${auditIntegrity.firstBrokenLogId}` : ""}
            </p>
          </div>
          <div className="rounded-lg border border-border bg-white p-4">
            <div className="flex items-center justify-between gap-3">
              <p className="text-xs font-black uppercase tracking-[0.16em] text-muted-foreground">Privacy records</p>
              <Database className="size-4 text-(--prism-amber)" />
            </div>
            <p className="mt-2 text-2xl font-black text-foreground">{privacyRecordCount}</p>
            <p className="mt-1 text-xs text-muted-foreground">{privacySurfaces.length} personal-data surfaces indexed</p>
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

        <div className="mt-5 flex flex-wrap gap-2">
          <div className="relative min-w-[240px] flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input value={query} onChange={(event) => setQuery(event.target.value)} className="h-10 bg-white pl-9" placeholder="Search logs..." />
          </div>
          {auditCategories.map((item) => (
            <button
              key={item}
              type="button"
              onClick={() => setCategory(item)}
              className={cx(
                "h-10 rounded-full border px-4 text-xs font-black capitalize transition-colors",
                category === item ? "border-primary bg-secondary text-foreground" : "border-border bg-white text-muted-foreground hover:text-foreground",
              )}
            >
              {label(item)}
            </button>
          ))}
        </div>

        {advancedOpen && (
          <div className="mt-4 grid gap-3 rounded-lg border border-border bg-muted p-4 md:grid-cols-4">
            <label className="text-xs font-black uppercase tracking-wide text-muted-foreground">
              Event
              <select value={eventId} onChange={(event) => setEventId(event.target.value)} className="mt-2 h-10 w-full rounded-md border border-border bg-white px-3 text-sm normal-case text-foreground">
                <option value="all">All events</option>
                {events.map((event) => <option key={event.id} value={event.id}>{event.eventName}</option>)}
              </select>
            </label>
            <label className="text-xs font-black uppercase tracking-wide text-muted-foreground">
              User
              <select value={actor} onChange={(event) => setActor(event.target.value)} className="mt-2 h-10 w-full rounded-md border border-border bg-white px-3 text-sm normal-case text-foreground">
                <option value="all">All users</option>
                {users.map((user) => <option key={user.id} value={user.name}>{user.name}</option>)}
                <option value="System">System</option>
              </select>
            </label>
            <label className="text-xs font-black uppercase tracking-wide text-muted-foreground">
              Action Type
              <select value={actionType} onChange={(event) => setActionType(event.target.value)} className="mt-2 h-10 w-full rounded-md border border-border bg-white px-3 text-sm normal-case text-foreground">
                {auditActionTypes.map((item) => <option key={item} value={item}>{label(item)}</option>)}
              </select>
            </label>
            <label className="text-xs font-black uppercase tracking-wide text-muted-foreground">
              Date Range
              <select value={dateRange} onChange={(event) => setDateRange(event.target.value)} className="mt-2 h-10 w-full rounded-md border border-border bg-white px-3 text-sm normal-case text-foreground">
                {auditDateRanges.map(([value, text]) => <option key={value} value={value}>{text}</option>)}
              </select>
            </label>
            <label className="text-xs font-black uppercase tracking-wide text-muted-foreground md:col-span-2">
              Severity
              <select value={severity} onChange={(event) => setSeverity(event.target.value)} className="mt-2 h-10 w-full rounded-md border border-border bg-white px-3 text-sm normal-case text-foreground">
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
        )}

        {error && (
          <Alert variant="destructive" className="mt-4 rounded-md">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <div className="mt-4 overflow-hidden rounded-lg border border-border bg-white">
          {busy && logs.length === 0 && <div className="p-6 text-sm text-muted-foreground">Loading audit events...</div>}
          {!busy && logs.length === 0 && <div className="p-6 text-sm text-muted-foreground">No audit logs match the active filters.</div>}
          {logs.map((log) => {
            const Icon = auditIcon(log.category, log.severity);
            return (
              <article key={log.id} className="grid gap-3 border-b border-border p-4 last:border-b-0 md:grid-cols-[minmax(0,1fr)_220px] md:items-center">
                <div className="flex min-w-0 gap-3">
                  <span className={cx("grid size-9 shrink-0 place-items-center rounded-md ring-1", severityTone(log.severity))}>
                    <Icon className="size-4" />
                  </span>
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-black text-foreground">{log.actor}</p>
                      <span className="text-xs text-muted-foreground">({label(log.actorRole)})</span>
                      <span className={cx("rounded-full px-2 py-0.5 text-[11px] font-black capitalize ring-1", auditTone(log.category))}>{label(log.category)}</span>
                      {log.severity !== "info" && <span className={cx("rounded-full px-2 py-0.5 text-[11px] font-black capitalize ring-1", severityTone(log.severity))}>{log.severity}</span>}
                    </div>
                    <p className="mt-1 text-sm text-foreground">{log.action}</p>
                    {log.affectedLabel && <p className="mt-1 text-xs text-muted-foreground">Affected: {log.affectedLabel}</p>}
                  </div>
                </div>
                <div className="text-left text-xs text-muted-foreground md:text-right">
                  <p className="font-semibold text-foreground">{compactTimestamp(log.createdAt)}</p>
                  <p>{log.ipAddress}</p>
                  <p className="font-mono text-[10px] uppercase tracking-wide">{log.id}</p>
                </div>
              </article>
            );
          })}
        </div>
      </section>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_380px]">
        <Panel title="Privacy operations" icon={Database}>
          <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_300px]">
            <div className="space-y-3">
              <div className="grid gap-2 rounded-md border border-border bg-background p-3 sm:grid-cols-2">
                <select
                  value={privacyForm.subjectType}
                  onChange={(event) => setPrivacyForm((current) => ({ ...current, subjectType: event.target.value }))}
                  className="h-10 rounded-md border border-border bg-white px-3 text-sm"
                >
                  <option value="client">Client</option>
                  <option value="supplier">Supplier</option>
                  <option value="guest">Guest</option>
                </select>
                <select
                  value={privacyForm.requestType}
                  onChange={(event) => setPrivacyForm((current) => ({ ...current, requestType: event.target.value as typeof privacyForm.requestType }))}
                  className="h-10 rounded-md border border-border bg-white px-3 text-sm"
                >
                  <option value="access">Access</option>
                  <option value="correction">Correction</option>
                  <option value="deletion">Deletion</option>
                  <option value="export">Export</option>
                </select>
                <Input value={privacyForm.subjectEmail} onChange={(event) => setPrivacyForm((current) => ({ ...current, subjectEmail: event.target.value }))} className="h-10 bg-white" placeholder="Subject email" />
                <Input value={privacyForm.subjectName} onChange={(event) => setPrivacyForm((current) => ({ ...current, subjectName: event.target.value }))} className="h-10 bg-white" placeholder="Subject name" />
                <textarea
                  value={privacyForm.requestNotes}
                  onChange={(event) => setPrivacyForm((current) => ({ ...current, requestNotes: event.target.value }))}
                  className="min-h-20 rounded-md border border-border bg-white px-3 py-2 text-sm sm:col-span-2"
                  placeholder="Request notes"
                />
                <Button type="button" disabled={busy || (!privacyForm.subjectEmail && !privacyForm.subjectName)} onClick={logPrivacyRequest} className="h-10 rounded-md font-black sm:col-span-2">
                  Log privacy request
                </Button>
              </div>

              {privacyRequests.length === 0 && <p className="text-sm text-muted-foreground">No privacy requests are queued.</p>}
              {privacyRequests.slice(0, 5).map((request) => (
                <div key={request.id} className="rounded-md border border-border bg-background p-3 text-sm">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="font-black capitalize">{label(request.requestType)} request</p>
                      <p className="mt-1 text-muted-foreground">{request.subjectEmail || request.subjectName || "Unnamed subject"}</p>
                    </div>
                    <span className={cx("rounded-full px-2 py-1 text-[11px] font-black capitalize ring-1", request.status === "executed" ? severityTone("info") : severityTone(request.status === "rejected" ? "warning" : "info"))}>
                      {label(request.status)}
                    </span>
                  </div>
                  {request.requestNotes && <p className="mt-2 text-xs text-muted-foreground">{request.requestNotes}</p>}
                  <div className="mt-3 flex flex-wrap gap-2">
                    {request.status === "submitted" && (
                      <>
                        <Button type="button" variant="outline" size="sm" disabled={busy} onClick={() => reviewPrivacyRequest(request.id, "approved")}>Approve</Button>
                        <Button type="button" variant="outline" size="sm" disabled={busy} onClick={() => reviewPrivacyRequest(request.id, "rejected")}>Reject</Button>
                      </>
                    )}
                    {request.status === "approved" && (
                      <Button type="button" variant="outline" size="sm" disabled={busy} onClick={() => executePrivacyRequest(request.id)}>Execute</Button>
                    )}
                  </div>
                </div>
              ))}
            </div>

            <div className="space-y-2">
              {privacyPolicies.slice(0, 7).map((policy) => (
                <div key={policy.surface} className="rounded-md bg-background p-3 text-xs">
                  <p className="font-black capitalize text-foreground">{label(policy.surface)}</p>
                  <p className="mt-1 text-muted-foreground">{policy.retentionPeriod}</p>
                </div>
              ))}
            </div>
          </div>
        </Panel>

        <Panel title="Security event alerts" icon={AlertTriangle}>
          <div className="space-y-3">
            {alerts.length === 0 && <p className="text-sm text-muted-foreground">No security alerts have been triggered.</p>}
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

        <Panel title="My last five sessions" icon={KeyRound}>
          <div className="space-y-3">
            {loginHistory.length === 0 && <p className="text-sm text-muted-foreground">No login history recorded for this profile yet.</p>}
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
                {entry.failureReason && <p className="mt-1 text-xs text-rose-700">{entry.failureReason}</p>}
              </div>
            ))}
          </div>
        </Panel>
      </div>
    </div>
  );
}
