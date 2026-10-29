import { formatPortalDate, formatPortalTime } from "@prism/ui/format-date";
import { FormEvent, useEffect, useState } from "react";
import { CheckCircle2, QrCode, Search, ShieldCheck, Upload, Users, UserRoundCheck } from "lucide-react";

import type {
  PrismRegistrationPlatform,
  PrismSupplier,
  CreateRegistrationPlatformInput,
  UpdateRegistrationPlatformInput,
  ImportHeadcountInput,
  ImportGuestRosterInput,
  PrismGuestRosterEntry,
  GuestRosterSearchInput,
  UpdateWalkInPolicyInput,
  GuestPrivacyClassification,
  UpdateGuestPrivacyClassificationInput,
  UpdateGuestVerificationInput,
} from "@prism/types";
import { GUEST_VERIFICATION_REQUIRED_ROSTER_SOURCES, createRegistrationPlatformSchema, importHeadcountSchema } from "@prism/types";
import { EmptyState } from "@/app/components/ui/empty-state";
import { Panel } from "@/features/pmcm-kit/primitives";
import { cx, label } from "@/features/pmcm-kit";
import { Button } from "@/app/components/ui/button";
import { RosterImportPanel } from "@/features/registration/roster-import";

const PLATFORM_LABELS: Record<string, string> = {
  xperto: "XPERTO Registration",
  clickpass: "Click Pass",
  custom: "Custom platform",
  none: "No platform configured",
};

const STATUS_LABELS: Record<string, string> = {
  not_started: "Not started",
  configuring: "Configuring",
  live: "Live",
  closed: "Closed",
};

const STATUS_COLORS: Record<string, string> = {
  not_started: "border-l-border bg-background/60",
  configuring: "border-l-attention bg-attention/8",
  live: "border-l-primary bg-primary/8",
  closed: "border-l-secondary bg-secondary/10",
};

function getNextStatus(status: string): string {
  if (status === "not_started") return "configuring";
  if (status === "configuring") return "live";
  return "closed";
}

function getNextStatusLabel(status: string): string {
  if (status === "not_started") return "Start configuring";
  if (status === "configuring") return "Mark live";
  return "Mark closed";
}

function PlatformEmptyState({ onEdit }: { onEdit: () => void }) {
  return (
    <Panel title="Registration Platform" icon={QrCode}>
      <EmptyState
        icon={QrCode}
        title="No registration platform configured"
        description="Configure the digital registration platform for large events (200-250+ pax). PRISM does not process ticket sales."
        action={
          <button
            type="button"
            onClick={onEdit}
            className="mt-3 rounded-lg bg-primary px-4 py-2 text-sm font-bold text-primary-foreground"
          >
            Configure platform
          </button>
        }
      />
    </Panel>
  );
}

function PlatformDisplay({
  platform,
  suppliers,
  busy,
  onEdit,
  onUpdate,
}: {
  platform: PrismRegistrationPlatform;
  suppliers: PrismSupplier[];
  busy: boolean;
  onEdit: () => void;
  onUpdate: (input: UpdateRegistrationPlatformInput) => void;
}) {
  const canAdvance = platform.status !== "closed";
  const nextStatus = getNextStatus(platform.status);
  const nextLabel = getNextStatusLabel(platform.status);
  const supplierName = resolveSupplierName(platform.supplierId, suppliers);
  return (
    <Panel title="Registration Platform" icon={QrCode}>
      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-black text-foreground">Platform Configuration</h3>
          <button
            type="button"
            onClick={onEdit}
            className="text-xs font-bold text-muted-foreground hover:text-foreground"
          >
            Edit
          </button>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="border-l border-border bg-background/60 px-3 py-2.5">
            <p className="text-xs font-bold text-muted-foreground">Platform</p>
            <p className="mt-1 text-sm font-black text-foreground">
              {PLATFORM_LABELS[platform.platformType] ?? platform.platformType}
            </p>
          </div>
          <div className="border-l border-border bg-background/60 px-3 py-2.5">
            <p className="text-xs font-bold text-muted-foreground">Status</p>
            <div className={`mt-1 border-l-2 pl-2 ${STATUS_COLORS[platform.status] ?? ""}`}>
              <p className="text-sm font-black text-foreground">
                {STATUS_LABELS[platform.status] ?? platform.status}
              </p>
            </div>
          </div>
          <div className="border-l border-border bg-background/60 px-3 py-2.5">
            <p className="text-xs font-bold text-muted-foreground">Expected pax</p>
            <p className="mt-1 text-sm font-black text-foreground">
              {platform.expectedPaxMin}–{platform.expectedPaxMax}
            </p>
          </div>
          <div className="border-l border-border bg-background/60 px-3 py-2.5">
            <p className="text-xs font-bold text-muted-foreground">Supplier</p>
            <p className="mt-1 text-sm font-black text-foreground">{supplierName}</p>
          </div>
        </div>
        {platform.setupNotes ? (
          <div className="border-l border-border bg-background/60 px-3 py-2.5">
            <p className="text-xs font-bold text-muted-foreground">Setup notes</p>
            <p className="mt-1 text-sm text-foreground">{platform.setupNotes}</p>
          </div>
        ) : null}
        {canAdvance ? (
          <div className="flex gap-2">
            <button
              type="button"
              disabled={busy}
              onClick={() => onUpdate({ status: nextStatus as UpdateRegistrationPlatformInput["status"] })}
              className="rounded-lg border border-border bg-secondary px-3 py-1.5 text-xs font-bold text-foreground hover:bg-secondary/80"
            >
              {nextLabel}
            </button>
          </div>
        ) : null}
      </div>
    </Panel>
  );
}

function resolveSupplierName(supplierId: string | null | undefined, suppliers: PrismSupplier[]): string {
  if (!supplierId) return "Not linked";
  return suppliers.find((s) => s.id === supplierId)?.name ?? "Linked";
}

function PlatformForm({
  platform,
  suppliers,
  busy,
  onUpsert,
  onUpdate,
  onCancel,
}: {
  platform: PrismRegistrationPlatform | null;
  suppliers: PrismSupplier[];
  busy: boolean;
  onUpsert: (input: CreateRegistrationPlatformInput) => void;
  onUpdate: (input: UpdateRegistrationPlatformInput) => void;
  onCancel: () => void;
}) {
  const [platformType, setPlatformType] = useState<string>(platform?.platformType ?? "none");
  const [supplierId, setSupplierId] = useState(platform?.supplierId ?? "");
  const [paxMin, setPaxMin] = useState(String(platform?.expectedPaxMin ?? 200));
  const [paxMax, setPaxMax] = useState(String(platform?.expectedPaxMax ?? 250));
  const [setupNotes, setSetupNotes] = useState(platform?.setupNotes ?? "");

  function handleSave(e: FormEvent) {
    e.preventDefault();
    const parsed = createRegistrationPlatformSchema.safeParse({
      platformType,
      supplierId: supplierId || undefined,
      expectedPaxMin: Number(paxMin) || 0,
      expectedPaxMax: Number(paxMax) || 0,
      setupNotes,
    });
    if (!parsed.success) return;
    if (platform) onUpdate(parsed.data);
    else onUpsert(parsed.data);
  }

  return (
    <Panel title="Registration Platform" icon={QrCode}>
      <form onSubmit={handleSave} className="flex flex-col gap-3">
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="grid gap-1.5">
            <span className="text-xs font-medium text-muted-foreground">Platform type</span>
            <select
              value={platformType}
              onChange={(ev) => setPlatformType(ev.target.value)}
              className="h-10 rounded-md border border-border bg-background px-3 text-sm"
            >
              <option value="none">No platform</option>
              <option value="xperto">XPERTO Registration</option>
              <option value="clickpass">Click Pass</option>
              <option value="custom">Custom platform</option>
            </select>
          </label>
          <label className="grid gap-1.5">
            <span className="text-xs font-medium text-muted-foreground">Linked supplier</span>
            <select
              value={supplierId}
              onChange={(ev) => setSupplierId(ev.target.value)}
              className="h-10 rounded-md border border-border bg-background px-3 text-sm"
            >
              <option value="">None</option>
              {suppliers.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </label>
          <label className="grid gap-1.5">
            <span className="text-xs font-medium text-muted-foreground">Min pax</span>
            <input
              type="number"
              value={paxMin}
              onChange={(ev) => setPaxMin(ev.target.value)}
              min={0}
              className="h-10 rounded-md border border-border bg-background px-3 text-sm"
            />
          </label>
          <label className="grid gap-1.5">
            <span className="text-xs font-medium text-muted-foreground">Max pax</span>
            <input
              type="number"
              value={paxMax}
              onChange={(ev) => setPaxMax(ev.target.value)}
              min={0}
              className="h-10 rounded-md border border-border bg-background px-3 text-sm"
            />
          </label>
        </div>
        <label className="grid gap-1.5">
          <span className="text-xs font-medium text-muted-foreground">Setup notes</span>
          <textarea
            value={setupNotes}
            onChange={(ev) => setSetupNotes(ev.target.value)}
            rows={3}
            className="rounded-md border border-border bg-background px-3 py-2 text-sm"
            placeholder="Platform setup details, contact person, device requirements..."
          />
        </label>
        <div className="flex gap-2">
          <button
            type="submit"
            disabled={busy}
            className="rounded-lg bg-primary px-4 py-2 text-sm font-bold text-primary-foreground"
          >
            {platform ? "Save changes" : "Configure platform"}
          </button>
          {platform ? (
            <button
              type="button"
              onClick={onCancel}
              className="rounded-lg border border-border px-4 py-2 text-sm font-bold text-muted-foreground"
            >
              Cancel
            </button>
          ) : null}
        </div>
      </form>
    </Panel>
  );
}

function RegistrationPlatformSection({
  platform,
  suppliers,
  busy,
  onUpsert,
  onUpdate,
}: {
  platform: PrismRegistrationPlatform | null;
  suppliers: PrismSupplier[];
  busy: boolean;
  onUpsert: (input: CreateRegistrationPlatformInput) => void;
  onUpdate: (input: UpdateRegistrationPlatformInput) => void;
}) {
  const [editing, setEditing] = useState(!platform);
  if (!platform && !editing) {
    return <PlatformEmptyState onEdit={() => setEditing(true)} />;
  }
  if (platform && !editing) {
    return (
      <PlatformDisplay
        platform={platform}
        suppliers={suppliers}
        busy={busy}
        onEdit={() => setEditing(true)}
        onUpdate={(input) => {
          onUpdate(input);
        }}
      />
    );
  }
  return (
    <PlatformForm
      platform={platform}
      suppliers={suppliers}
      busy={busy}
      onUpsert={(input) => {
        onUpsert(input);
        setEditing(false);
      }}
      onUpdate={(input) => {
        onUpdate(input);
        setEditing(false);
      }}
      onCancel={() => setEditing(false)}
    />
  );
}

function HeadcountSummary({ platform }: { platform: PrismRegistrationPlatform }) {
  const hasImport = platform.importedHeadcount > 0;
  if (hasImport) {
    return (
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="border-l border-secondary bg-secondary/10 px-3 py-2.5">
          <p className="text-xs font-bold text-muted-foreground">Imported headcount</p>
          <p className="mt-1 text-lg font-black text-foreground">{platform.importedHeadcount}</p>
        </div>
        <div className="border-l border-border bg-background/60 px-3 py-2.5">
          <p className="text-xs font-bold text-muted-foreground">Source</p>
          <p className="mt-1 text-sm font-black text-foreground">{platform.headcountSource}</p>
        </div>
        <div className="border-l border-border bg-background/60 px-3 py-2.5">
          <p className="text-xs font-bold text-muted-foreground">Imported at</p>
          <p className="mt-1 text-sm font-black text-foreground">
            {platform.importedAt ? formatPortalDate(platform.importedAt) : "—"}
          </p>
        </div>
      </div>
    );
  }
  return (
    <div className="border-l border-border bg-background/60 px-3 py-2.5 text-sm text-muted-foreground">
      No headcount imported yet. Import final guest data after the event closes.
    </div>
  );
}

function HeadcountImportForm({
  busy,
  onImportHeadcount,
  onCancel,
}: {
  busy: boolean;
  onImportHeadcount: (input: ImportHeadcountInput) => void;
  onCancel: () => void;
}) {
  const [importSource, setImportSource] = useState("XPERTO");
  const [importCount, setImportCount] = useState("");
  const [importFileName, setImportFileName] = useState("");

  function handleImport(e: FormEvent) {
    e.preventDefault();
    const count = Number(importCount);
    if (!count || count < 0) return;
    const parsed = importHeadcountSchema.safeParse({
      headcountSource: importSource,
      importedHeadcount: count,
      importedFileName: importFileName || undefined,
    });
    if (!parsed.success) return;
    onImportHeadcount(parsed.data);
    setImportCount("");
    setImportFileName("");
  }

  return (
    <form onSubmit={handleImport} className="flex flex-col gap-3">
      <div className="grid gap-3 sm:grid-cols-3">
        <label className="grid gap-1.5">
          <span className="text-xs font-medium text-muted-foreground">Source</span>
          <input
            type="text"
            value={importSource}
            onChange={(ev) => setImportSource(ev.target.value)}
            className="h-10 rounded-md border border-border bg-background px-3 text-sm"
            placeholder="e.g. XPERTO"
          />
        </label>
        <label className="grid gap-1.5">
          <span className="text-xs font-medium text-muted-foreground">Headcount</span>
          <input
            type="number"
            value={importCount}
            onChange={(ev) => setImportCount(ev.target.value)}
            min={0}
            required
            className="h-10 rounded-md border border-border bg-background px-3 text-sm"
            placeholder="Total guests"
          />
        </label>
        <label className="grid gap-1.5">
          <span className="text-xs font-medium text-muted-foreground">File name (optional)</span>
          <input
            type="text"
            value={importFileName}
            onChange={(ev) => setImportFileName(ev.target.value)}
            className="h-10 rounded-md border border-border bg-background px-3 text-sm"
            placeholder="guest-list.csv"
          />
        </label>
      </div>
      <div className="flex gap-2">
        <button
          type="submit"
          disabled={busy || !importCount}
          className="rounded-lg bg-primary px-4 py-2 text-sm font-bold text-primary-foreground"
        >
          <Upload className="mr-1.5 inline size-3.5" />
          Import headcount
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="rounded-lg border border-border px-4 py-2 text-sm font-bold text-muted-foreground"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}

function HeadcountSection({
  platform,
  busy,
  onImportHeadcount,
}: {
  platform: PrismRegistrationPlatform;
  busy: boolean;
  onImportHeadcount: (input: ImportHeadcountInput) => void;
}) {
  const [showImport, setShowImport] = useState(false);
  return (
    <Panel title="Headcount Import" icon={Users}>
      <div className="flex flex-col gap-3">
        <HeadcountSummary platform={platform} />
        {showImport ? (
          <HeadcountImportForm busy={busy} onImportHeadcount={onImportHeadcount} onCancel={() => setShowImport(false)} />
        ) : platform.status === "closed" ? (
          <button
            type="button"
            onClick={() => setShowImport(true)}
            className="flex w-fit items-center gap-2 rounded-lg border border-dashed border-border bg-background px-4 py-2 text-sm font-bold text-muted-foreground transition hover:border-primary/40 hover:text-foreground"
          >
            <Upload className="size-4" />
            Import headcount data
          </button>
        ) : (
          <p className="text-sm text-muted-foreground">Mark the platform closed after the event before importing final headcount.</p>
        )}
      </div>
    </Panel>
  );
}

type AttendanceFilter = "all" | "no" | "yes";

const ATTENDANCE_FILTERS: ReadonlyArray<{ value: AttendanceFilter; label: string }> = [
  { value: "all", label: "Everyone" },
  { value: "no", label: "Not checked in" },
  { value: "yes", label: "Checked in" },
];

const VERIFICATION_TONE: Record<string, string> = {
  pending: "bg-attention-soft text-attention",
  verified: "bg-success-soft text-success",
  rejected: "bg-danger-soft text-danger",
};

function rosterDetails(row: PrismGuestRosterEntry) {
  return [row.category, row.table ? `Table ${row.table}` : null, row.sourceKey ? `ID ${row.sourceKey}` : null].filter(Boolean).join(" · ") || row.email || row.phone || "No details";
}

function GuestRosterSection({ eventId, busy, onSearch, onImport, onCheckIn, onVerify }: { eventId: string; busy: boolean; onSearch: (filters?: GuestRosterSearchInput) => Promise<PrismGuestRosterEntry[]>; onImport: (input: ImportGuestRosterInput) => Promise<PrismGuestRosterEntry[]>; onCheckIn: (id: string) => Promise<unknown>; onVerify: (id: string, status: UpdateGuestVerificationInput["status"]) => Promise<unknown> }) {
  const [query, setQuery] = useState("");
  const [eligibility, setEligibility] = useState<"eligible" | "ineligible" | "">("");
  const [checkedIn, setCheckedIn] = useState<AttendanceFilter>("all");
  const [rows, setRows] = useState<PrismGuestRosterEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [importOpen, setImportOpen] = useState(false);
  const filtered = Boolean(query.trim() || eligibility || checkedIn !== "all");

  async function search() {
    setLoading(true);
    try {
      setRows(await onSearch({ namePrefix: query.trim(), eligibility: eligibility || undefined, checkedIn: checkedIn === "all" ? undefined : checkedIn === "yes" }));
    } finally {
      setLoading(false);
    }
  }

  // Filters apply as you type; the short delay keeps typing from firing a request per keystroke.
  useEffect(() => {
    const timer = window.setTimeout(() => void search(), 250);
    return () => window.clearTimeout(timer);
  }, [eventId, query, eligibility, checkedIn]);

  async function updateVerification(id: string, status: UpdateGuestVerificationInput["status"]) { await onVerify(id, status); await search(); }
  async function checkIn(id: string) { await onCheckIn(id); await search(); }

  return (
    <Panel title="Guest roster" icon={UserRoundCheck}>
      <div className="flex flex-col gap-4">
        <RosterToolbar
          query={query}
          onQuery={setQuery}
          checkedIn={checkedIn}
          onCheckedIn={setCheckedIn}
          eligibility={eligibility}
          onEligibility={setEligibility}
          importOpen={importOpen}
          onToggleImport={() => setImportOpen((open) => !open)}
        />

        {importOpen ? (
          <RosterImportPanel
            busy={busy}
            onImport={onImport}
            onImported={(imported) => {
              setRows(imported);
              setImportOpen(false);
            }}
          />
        ) : null}

        <div className="overflow-hidden rounded-lg border border-border bg-white">
          <div className="flex items-center justify-between border-b border-border px-4 py-2 text-xs text-muted-foreground">
            <span role="status">{loading ? "Loading guests…" : `${rows.length} ${rows.length === 1 ? "guest" : "guests"}${filtered ? " match" : ""}`}</span>
            <span className="hidden sm:inline">Walk-ins need verification before check-in</span>
          </div>
          {rows.length === 0 && !loading ? (
            <RosterEmpty filtered={filtered} onImport={() => setImportOpen(true)} />
          ) : (
            <ul className="divide-y divide-border">
              {rows.map((row) => (
                <RosterRow key={`${eventId}-${row.id}`} row={row} busy={busy} onVerify={updateVerification} onCheckIn={checkIn} />
              ))}
            </ul>
          )}
        </div>
      </div>
    </Panel>
  );
}

type EligibilityFilter = "eligible" | "ineligible" | "";

function RosterToolbar({
  query,
  onQuery,
  checkedIn,
  onCheckedIn,
  eligibility,
  onEligibility,
  importOpen,
  onToggleImport,
}: {
  query: string;
  onQuery: (value: string) => void;
  checkedIn: AttendanceFilter;
  onCheckedIn: (value: AttendanceFilter) => void;
  eligibility: EligibilityFilter;
  onEligibility: (value: EligibilityFilter) => void;
  importOpen: boolean;
  onToggleImport: () => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <label className="relative min-w-52 flex-1">
        <Search aria-hidden className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <input
          value={query}
          onChange={(e) => onQuery(e.target.value)}
          aria-label="Search guests by name"
          placeholder="Search guests by name"
          className="h-10 w-full rounded-md border border-border bg-white pl-9 pr-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/30"
        />
      </label>
      <div role="group" aria-label="Attendance" className="flex gap-1 rounded-md bg-muted p-1">
        {ATTENDANCE_FILTERS.map((filter) => (
          <button
            key={filter.value}
            type="button"
            aria-pressed={checkedIn === filter.value}
            onClick={() => onCheckedIn(filter.value)}
            className={cx("rounded px-2.5 py-1 text-xs font-medium transition-colors", checkedIn === filter.value ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground")}
          >
            {filter.label}
          </button>
        ))}
      </div>
      <select
        value={eligibility}
        onChange={(e) => onEligibility(e.target.value as EligibilityFilter)}
        aria-label="Eligibility"
        className="h-10 rounded-md border border-border bg-white px-3 text-sm text-foreground"
      >
        <option value="">Any eligibility</option>
        <option value="eligible">Eligible</option>
        <option value="ineligible">Not eligible</option>
      </select>
      <Button type="button" variant={importOpen ? "outline" : "default"} size="sm" className="h-10" onClick={onToggleImport} aria-expanded={importOpen}>
        <Upload className="size-4" aria-hidden /> {importOpen ? "Close import" : "Import guests"}
      </Button>
    </div>
  );
}

function RosterEmpty({ filtered, onImport }: { filtered: boolean; onImport: () => void }) {
  return (
    <div className="flex flex-col items-center gap-2 px-6 py-10 text-center">
      <span className="grid size-10 place-items-center rounded-full bg-muted text-muted-foreground"><UserRoundCheck className="size-5" aria-hidden /></span>
      <p className="text-sm font-semibold text-foreground">{filtered ? "No guest matches these filters" : "No guests on the roster yet"}</p>
      <p className="max-w-sm text-sm text-muted-foreground">
        {filtered ? "Try another name or clear the filters." : "Import the guest list from a spreadsheet. Coordinators can add walk-ins on the day."}
      </p>
      {filtered ? null : (
        <Button type="button" size="sm" className="mt-1" onClick={onImport}>
          <Upload className="size-4" aria-hidden /> Import guests
        </Button>
      )}
    </div>
  );
}

function RosterRow({
  row,
  busy,
  onVerify,
  onCheckIn,
}: {
  row: PrismGuestRosterEntry;
  busy: boolean;
  onVerify: (id: string, status: UpdateGuestVerificationInput["status"]) => Promise<void>;
  onCheckIn: (id: string) => Promise<void>;
}) {
  const needsVerification = GUEST_VERIFICATION_REQUIRED_ROSTER_SOURCES.includes(row.source);
  return (
    <li className={cx("grid gap-2 px-4 py-2.5 text-sm sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center", row.withdrawnAt ? "opacity-60" : "")}>
      <div className="min-w-0">
        <p className="flex flex-wrap items-center gap-2">
          <span className="truncate font-semibold text-foreground">{row.guestName}</span>
          {needsVerification ? (
            <span className={cx("rounded px-1.5 py-0.5 text-xs font-medium", VERIFICATION_TONE[row.verificationStatus] ?? "bg-muted text-muted-foreground")}>
              Walk-in · {label(row.verificationStatus)}
            </span>
          ) : null}
          {row.withdrawnAt ? <span className="rounded bg-muted px-1.5 py-0.5 text-xs text-muted-foreground">Withdrawn</span> : null}
        </p>
        <p className="truncate text-xs text-muted-foreground">{rosterDetails(row)}</p>
      </div>
      <div className="flex flex-wrap items-center gap-2 sm:justify-end">
        {needsVerification && !row.checkedInAt ? (
          <select
            aria-label={`Verification for ${row.guestName}`}
            value={row.verificationStatus}
            disabled={busy}
            onChange={(event) => void onVerify(row.id, event.target.value as UpdateGuestVerificationInput["status"])}
            className="h-8 rounded-md border border-border bg-white px-2 text-xs"
          >
            <option value="pending">Pending check</option>
            <option value="verified">Verified</option>
            <option value="rejected">Rejected</option>
          </select>
        ) : null}
        {row.checkedInAt ? (
          <span className="inline-flex items-center gap-1 text-xs font-medium text-success">
            <CheckCircle2 className="size-3.5" aria-hidden /> Checked in {formatPortalTime(row.checkedInAt)}
          </span>
        ) : (
          <Button type="button" size="sm" variant="outline" disabled={busy || !canCheckInRosterRow(row)} onClick={() => void onCheckIn(row.id)}>
            Check in
          </Button>
        )}
      </div>
    </li>
  );
}

const PRIVACY_OPTIONS: ReadonlyArray<{ value: GuestPrivacyClassification; label: string; detail: string }> = [
  { value: "public", label: "Public", detail: "Anyone with the guest code can register." },
  { value: "private", label: "Private", detail: "Guests not on the roster need staff verification." },
  { value: "unclassified", label: "Not set", detail: "Decide later. Verification follows the briefing guest count." },
];

const WALK_IN_OPTIONS: ReadonlyArray<{ value: "closed" | "open" | "threshold"; label: string; detail: string }> = [
  { value: "closed", label: "Closed", detail: "Only rostered guests can check in." },
  { value: "open", label: "Open", detail: "Walk-ins are admitted after verification." },
  { value: "threshold", label: "Up to a limit", detail: "Walk-ins stop once attendance reaches the limit." },
];

function ChoiceCards<T extends string>({ name, legend, options, value, onChange, disabled }: { name: string; legend: string; options: ReadonlyArray<{ value: T; label: string; detail: string }>; value: T; onChange: (value: T) => void; disabled: boolean }) {
  return (
    <fieldset>
      <legend className="text-sm font-semibold text-foreground">{legend}</legend>
      <div className="mt-2 grid gap-2 sm:grid-cols-3">
        {options.map((option) => {
          const checked = option.value === value;
          return (
            <label
              key={option.value}
              className={cx(
                "relative flex cursor-pointer flex-col gap-0.5 rounded-lg border px-3 py-2.5 transition-colors has-[input:focus-visible]:ring-2 has-[input:focus-visible]:ring-ring/40",
                checked ? "border-primary bg-primary/5" : "border-border bg-white hover:border-primary/40",
                disabled ? "cursor-not-allowed opacity-60" : "",
              )}
            >
              <input type="radio" name={name} value={option.value} checked={checked} disabled={disabled} onChange={() => onChange(option.value)} className="sr-only" />
              <span className="flex items-center justify-between gap-2 text-sm font-semibold text-foreground">
                {option.label}
                <span aria-hidden className={cx("grid size-4 place-items-center rounded-full border", checked ? "border-primary" : "border-border")}>
                  {checked ? <span className="size-2 rounded-full bg-primary" /> : null}
                </span>
              </span>
              <span className="text-xs text-muted-foreground">{option.detail}</span>
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}

/** Who may get in on the day: the event's privacy and its walk-in rule, saved together. */
type WalkInPolicy = "closed" | "open" | "threshold";
type AdmissionMessage = { tone: "success" | "error"; text: string } | null;

/** What the admission form would change, and whether the walk-in limit can be saved. */
function admissionChanges(saved: { classification: GuestPrivacyClassification; policy: WalkInPolicy; threshold: number }, draft: { privacy: GuestPrivacyClassification; walkIn: WalkInPolicy; limit: string }) {
  const limited = draft.walkIn === "threshold";
  return {
    privacyChanged: draft.privacy !== saved.classification,
    walkInChanged: draft.walkIn !== saved.policy || (limited && draft.limit !== String(saved.threshold)),
    limitInvalid: limited && !(Number(draft.limit) >= 1),
  };
}

function WalkInLimitField({ limit, invalid, onChange }: { limit: string; invalid: boolean; onChange: (value: string) => void }) {
  return (
    <label className="mt-3 flex w-fit items-center gap-2 text-sm text-foreground">
      Stop walk-ins at
      <input
        type="number"
        min={1}
        value={limit}
        onChange={(event) => onChange(event.target.value)}
        aria-invalid={invalid}
        className="h-9 w-24 rounded-md border border-border bg-white px-3 text-sm tabular-nums"
      />
      checked-in guests
    </label>
  );
}

function AdmissionSaveBar({ disabled, saving, dirty, message, onSave }: { disabled: boolean; saving: boolean; dirty: boolean; message: AdmissionMessage; onSave: () => void }) {
  return (
    <div className="flex flex-wrap items-center gap-3 border-t border-border pt-4">
      <Button type="button" disabled={disabled} onClick={onSave}>{saving ? "Saving…" : "Save changes"}</Button>
      {message ? (
        <span role={message.tone === "error" ? "alert" : "status"} className={cx("text-sm", message.tone === "error" ? "text-danger" : "text-success")}>{message.text}</span>
      ) : dirty ? (
        <span className="text-sm text-muted-foreground">Unsaved changes</span>
      ) : null}
    </div>
  );
}

function GuestAdmissionSection({
  classification,
  policy,
  threshold,
  busy,
  onUpdateClassification,
  onUpdatePolicy,
}: {
  classification: GuestPrivacyClassification;
  policy: WalkInPolicy;
  threshold: number;
  busy: boolean;
  onUpdateClassification: (input: UpdateGuestPrivacyClassificationInput) => Promise<boolean>;
  onUpdatePolicy: (input: UpdateWalkInPolicyInput) => void;
}) {
  const [privacy, setPrivacy] = useState(classification);
  const [walkIn, setWalkIn] = useState(policy);
  const [limit, setLimit] = useState(String(threshold));
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<AdmissionMessage>(null);

  useEffect(() => setPrivacy(classification), [classification]);
  useEffect(() => setWalkIn(policy), [policy]);
  useEffect(() => setLimit(String(threshold)), [threshold]);

  const { privacyChanged, walkInChanged, limitInvalid } = admissionChanges({ classification, policy, threshold }, { privacy, walkIn, limit });
  const locked = busy || saving;

  async function save() {
    setSaving(true);
    setMessage(null);
    try {
      if (privacyChanged && !(await onUpdateClassification({ classification: privacy }))) {
        setMessage({ tone: "error", text: "Couldn't save the privacy setting. Try again." });
        return;
      }
      if (walkInChanged) onUpdatePolicy({ policy: walkIn, ...(walkIn === "threshold" ? { threshold: Number(limit) } : {}) });
      setMessage({ tone: "success", text: "Admission settings saved." });
    } catch {
      setMessage({ tone: "error", text: "Couldn't save admission settings. Try again." });
    } finally {
      setSaving(false);
    }
  }

  return (
    <Panel title="Guest admission" icon={ShieldCheck}>
      <div className="flex flex-col gap-5">
        <ChoiceCards name="guest-privacy" legend="Event privacy" options={PRIVACY_OPTIONS} value={privacy} onChange={setPrivacy} disabled={locked} />
        <div>
          <ChoiceCards name="walk-in-policy" legend="Walk-ins" options={WALK_IN_OPTIONS} value={walkIn} onChange={setWalkIn} disabled={locked} />
          {walkIn === "threshold" ? <WalkInLimitField limit={limit} invalid={limitInvalid} onChange={setLimit} /> : null}
        </div>
        <AdmissionSaveBar
          disabled={locked || limitInvalid || !(privacyChanged || walkInChanged)}
          saving={saving}
          dirty={privacyChanged || walkInChanged}
          message={message}
          onSave={() => void save()}
        />
      </div>
    </Panel>
  );
}

export function EventRegistrationTab({
  eventId,
  platform,
  suppliers,
  busy,
  loadError,
  onUpsert,
  onUpdate,
  onImportHeadcount,
  onSearchRoster,
  onImportRoster,
  onCheckInRoster,
  onVerifyRoster,
  walkInPolicy,
  walkInThreshold,
  onUpdateWalkInPolicy,
  guestPrivacyClassification,
  onUpdateGuestPrivacyClassification,
}: {
  eventId: string;
  platform: PrismRegistrationPlatform | null;
  suppliers: PrismSupplier[];
  busy: boolean;
  loadError?: string | null;
  onUpsert: (input: CreateRegistrationPlatformInput) => void;
  onUpdate: (input: UpdateRegistrationPlatformInput) => void;
  onImportHeadcount: (input: ImportHeadcountInput) => void;
  onSearchRoster: (filters?: GuestRosterSearchInput) => Promise<PrismGuestRosterEntry[]>;
  onImportRoster: (input: ImportGuestRosterInput) => Promise<PrismGuestRosterEntry[]>;
  onCheckInRoster: (id: string) => Promise<unknown>;
  onVerifyRoster: (id: string, status: UpdateGuestVerificationInput["status"]) => Promise<unknown>;
  walkInPolicy: "closed" | "open" | "threshold";
  walkInThreshold: number;
  onUpdateWalkInPolicy: (input: UpdateWalkInPolicyInput) => void;
  guestPrivacyClassification: GuestPrivacyClassification;
  onUpdateGuestPrivacyClassification: (input: UpdateGuestPrivacyClassificationInput) => Promise<boolean>;
}) {
  const digitalRegSuppliers = suppliers.filter((s) => s.categorySlug === "digital-registration");
  return (
    <div className="flex flex-col gap-4">
      {loadError ? (
        <Panel title="Registration Platform" icon={QrCode}>
          <p className="text-sm text-muted-foreground">{loadError}</p>
        </Panel>
      ) : null}
      <RegistrationPlatformSection
        platform={platform}
        suppliers={digitalRegSuppliers}
        busy={busy}
        onUpsert={onUpsert}
        onUpdate={onUpdate}
      />
      <GuestRosterSection eventId={eventId} busy={busy} onSearch={onSearchRoster} onImport={onImportRoster} onCheckIn={onCheckInRoster} onVerify={onVerifyRoster} />
      <GuestAdmissionSection
        classification={guestPrivacyClassification}
        policy={walkInPolicy}
        threshold={walkInThreshold}
        busy={busy}
        onUpdateClassification={onUpdateGuestPrivacyClassification}
        onUpdatePolicy={onUpdateWalkInPolicy}
      />
      {platform ? <HeadcountSection platform={platform} busy={busy} onImportHeadcount={onImportHeadcount} /> : null}
    </div>
  );
}

function canCheckInRosterRow(row: PrismGuestRosterEntry): boolean {
  if (row.withdrawnAt || row.checkedInAt || row.verificationStatus === "rejected") return false;
  return !GUEST_VERIFICATION_REQUIRED_ROSTER_SOURCES.includes(row.source)
    || row.verificationStatus === "verified";
}
