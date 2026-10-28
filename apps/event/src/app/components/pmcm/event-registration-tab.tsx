import { formatPortalDate } from "@prism/ui/format-date";
import { FormEvent, useEffect, useState } from "react";
import { QrCode, ShieldCheck, Upload, Users, UserRoundCheck } from "lucide-react";

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

function GuestRosterSection({ eventId, busy, onSearch, onImport, onCheckIn, onVerify }: { eventId: string; busy: boolean; onSearch: (filters?: GuestRosterSearchInput) => Promise<PrismGuestRosterEntry[]>; onImport: (input: ImportGuestRosterInput) => Promise<PrismGuestRosterEntry[]>; onCheckIn: (id: string) => Promise<unknown>; onVerify: (id: string, status: UpdateGuestVerificationInput["status"]) => Promise<unknown> }) {
  const [query, setQuery] = useState("");
  const [eligibility, setEligibility] = useState<"eligible" | "ineligible" | "">("");
  const [checkedIn, setCheckedIn] = useState<"all" | "yes" | "no">("all");
  const [rows, setRows] = useState<PrismGuestRosterEntry[]>([]);
  async function search() { setRows(await onSearch({ namePrefix: query, eligibility: eligibility || undefined, checkedIn: checkedIn === "all" ? undefined : checkedIn === "yes" })); }
  async function updateVerification(id: string, status: UpdateGuestVerificationInput["status"]) { await onVerify(id, status); await search(); }
  async function checkIn(id: string) { await onCheckIn(id); await search(); }
  return <Panel title="Guest roster and registration desk" icon={UserRoundCheck}><div className="flex flex-col gap-3"><p className="text-sm text-muted-foreground">PMCM imports authoritative guest rows. Coordinators add walk-ins to this roster pending verification; verified walk-ins can then be checked in by registration staff.</p><RosterImportPanel busy={busy} onImport={onImport} onImported={setRows} /><div className="flex flex-wrap gap-2"><input value={query} onChange={(e) => setQuery(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") void search(); }} aria-label="Search guests by name" className="h-10 min-w-48 flex-1 rounded-md border border-border bg-background px-3 text-sm" placeholder="Name prefix"/><select value={eligibility} onChange={(e) => setEligibility(e.target.value as typeof eligibility)} className="h-10 rounded-md border border-border bg-background px-3 text-sm"><option value="">All eligibility</option><option value="eligible">Eligible</option><option value="ineligible">Ineligible</option></select><select value={checkedIn} onChange={(e) => setCheckedIn(e.target.value as typeof checkedIn)} className="h-10 rounded-md border border-border bg-background px-3 text-sm"><option value="all">All attendance</option><option value="yes">Checked in</option><option value="no">Not checked in</option></select><button type="button" onClick={() => void search()} className="rounded-lg border border-border px-4 py-2 text-sm font-bold">Search</button></div><div className="divide-y divide-border border-y border-border">{rows.map((row) => <div key={`${eventId}-${row.id}`} className="flex items-center justify-between gap-2 py-2 text-sm"><span><strong>{row.guestName}</strong><span className="ml-2 text-muted-foreground">{row.category || row.table || row.email || row.phone || row.sourceKey}</span></span><div className="flex items-center gap-2"><select aria-label={`Verification for ${row.guestName}`} value={row.verificationStatus} disabled={busy || Boolean(row.checkedInAt)} onChange={(event) => void updateVerification(row.id, event.target.value as UpdateGuestVerificationInput["status"])} className="h-8 rounded-md border border-border bg-background px-2 text-xs"><option value="pending">Pending</option><option value="verified">Verified</option><option value="rejected">Rejected</option></select><button type="button" disabled={busy || !canCheckInRosterRow(row)} onClick={() => void checkIn(row.id)} className="rounded-md border border-border px-3 py-1.5 text-xs font-bold">Check in</button></div></div>)}{rows.length === 0 ? <p className="py-3 text-sm text-muted-foreground">No roster rows match.</p> : null}</div></div></Panel>;
}

function WalkInPolicySection({ policy, threshold, busy, onUpdate }: { policy: "closed" | "open" | "threshold"; threshold: number; busy: boolean; onUpdate: (input: UpdateWalkInPolicyInput) => void }) {
  const [selectedPolicy, setSelectedPolicy] = useState(policy);
  const [selectedThreshold, setSelectedThreshold] = useState(String(threshold));
  return <Panel title="Walk-in policy" icon={Users}><div className="flex flex-col gap-3"><p className="text-sm text-muted-foreground">PMCM owns this event setting. Threshold walk-ins are admitted only while checked-in attendance is below the limit; the API enforces the limit during check-in.</p><div className="flex flex-wrap items-end gap-3"><label className="flex min-w-44 flex-col gap-1 text-xs font-semibold text-muted-foreground">Policy<select value={selectedPolicy} onChange={(event) => setSelectedPolicy(event.target.value as typeof selectedPolicy)} className="h-10 rounded-md border border-border bg-background px-3 text-sm text-foreground"><option value="closed">Closed</option><option value="open">Open</option><option value="threshold">Threshold</option></select></label>{selectedPolicy === "threshold" ? <label className="flex w-32 flex-col gap-1 text-xs font-semibold text-muted-foreground">Limit<input type="number" min={1} value={selectedThreshold} onChange={(event) => setSelectedThreshold(event.target.value)} className="h-10 rounded-md border border-border bg-background px-3 text-sm text-foreground" /></label> : null}<button type="button" disabled={busy} onClick={() => onUpdate({ policy: selectedPolicy, ...(selectedPolicy === "threshold" || selectedThreshold !== String(threshold) ? { threshold: Number(selectedThreshold) } : {}) })} className="h-10 rounded-lg bg-primary px-4 text-sm font-bold text-primary-foreground">Save policy</button></div></div></Panel>;
}

function GuestPrivacyClassificationSection({
  classification,
  busy,
  onUpdate,
}: {
  classification: GuestPrivacyClassification;
  busy: boolean;
  onUpdate: (input: UpdateGuestPrivacyClassificationInput) => Promise<boolean>;
}) {
  const [selected, setSelected] = useState(classification);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    setSelected(classification);
    setMessage(null);
  }, [classification]);

  async function save() {
    setSaving(true);
    setMessage(null);
    try {
      const saved = await onUpdate({ classification: selected });
      setMessage(saved ? "Privacy classification saved." : "Unable to save privacy classification.");
    } catch {
      setMessage("Unable to save privacy classification.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Panel title="Event privacy classification" icon={ShieldCheck}>
      <div className="flex flex-col gap-3">
        <p className="text-sm text-muted-foreground">
          Set the event privacy status used with the confirmed briefing guest count to determine
          whether unregistered guest submissions need staff verification.
        </p>
        <div className="flex flex-wrap items-end gap-3">
          <label className="flex min-w-44 flex-col gap-1 text-xs font-semibold text-muted-foreground">
            Event privacy
            <select
              value={selected}
              onChange={(event) => setSelected(event.target.value as GuestPrivacyClassification)}
              className="h-10 rounded-md border border-border bg-background px-3 text-sm text-foreground"
            >
              <option value="unclassified">Unclassified</option>
              <option value="private">Private</option>
              <option value="public">Public</option>
            </select>
          </label>
          <button
            type="button"
            disabled={busy || saving}
            onClick={() => void save()}
            className="h-10 rounded-lg bg-primary px-4 text-sm font-bold text-primary-foreground"
          >
            {saving ? "Saving…" : "Save privacy classification"}
          </button>
          {message ? (
            <span role={message.startsWith("Unable") ? "alert" : "status"} className="self-center text-sm text-muted-foreground">
              {message}
            </span>
          ) : null}
        </div>
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
      <GuestPrivacyClassificationSection
        classification={guestPrivacyClassification}
        busy={busy}
        onUpdate={onUpdateGuestPrivacyClassification}
      />
      <WalkInPolicySection policy={walkInPolicy} threshold={walkInThreshold} busy={busy} onUpdate={onUpdateWalkInPolicy} />
      {platform ? <HeadcountSection platform={platform} busy={busy} onImportHeadcount={onImportHeadcount} /> : null}
      <GuestRosterSection eventId={eventId} busy={busy} onSearch={onSearchRoster} onImport={onImportRoster} onCheckIn={onCheckInRoster} onVerify={onVerifyRoster} />
    </div>
  );
}

function canCheckInRosterRow(row: PrismGuestRosterEntry): boolean {
  if (row.withdrawnAt || row.checkedInAt || row.verificationStatus === "rejected") return false;
  return !GUEST_VERIFICATION_REQUIRED_ROSTER_SOURCES.includes(row.source)
    || row.verificationStatus === "verified";
}
