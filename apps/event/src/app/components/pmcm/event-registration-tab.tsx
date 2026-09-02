import { FormEvent, useState } from "react";
import { QrCode, Upload, CheckCircle2, Settings, Users } from "lucide-react";

import type {
  PrismRegistrationPlatform,
  PrismSupplier,
  CreateRegistrationPlatformInput,
  UpdateRegistrationPlatformInput,
  ImportHeadcountInput,
} from "@/lib/prism-api";
import { EmptyState } from "@/app/components/ui/empty-state";
import { Panel } from "@/features/pmcm-kit/primitives";

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
  configuring: "border-l-(--prism-amber) bg-(--prism-amber)/8",
  live: "border-l-(--prism-signal) bg-(--prism-signal)/8",
  closed: "border-l-(--prism-sage) bg-(--prism-sage)/10",
};

export function EventRegistrationTab({
  platform,
  suppliers,
  busy,
  onUpsert,
  onUpdate,
  onImportHeadcount,
}: {
  platform: PrismRegistrationPlatform | null;
  suppliers: PrismSupplier[];
  busy: boolean;
  onUpsert: (input: CreateRegistrationPlatformInput) => void;
  onUpdate: (input: UpdateRegistrationPlatformInput) => void;
  onImportHeadcount: (input: ImportHeadcountInput) => void;
}) {
  const [editing, setEditing] = useState(!platform);
  const [platformType, setPlatformType] = useState<string>(platform?.platformType ?? "none");
  const [supplierId, setSupplierId] = useState(platform?.supplierId ?? "");
  const [paxMin, setPaxMin] = useState(String(platform?.expectedPaxMin ?? 200));
  const [paxMax, setPaxMax] = useState(String(platform?.expectedPaxMax ?? 250));
  const [setupNotes, setSetupNotes] = useState(platform?.setupNotes ?? "");

  const [importSource, setImportSource] = useState("XPERTO");
  const [importCount, setImportCount] = useState("");
  const [importFileName, setImportFileName] = useState("");
  const [showImport, setShowImport] = useState(false);

  const digitalRegSuppliers = suppliers.filter(
    (s) => s.categorySlug === "digital-registration",
  );

  function handleSave(e: FormEvent) {
    e.preventDefault();
    if (platform) {
      onUpdate({
        platformType: platformType as UpdateRegistrationPlatformInput["platformType"],
        supplierId: supplierId || undefined,
        expectedPaxMin: Number(paxMin) || 0,
        expectedPaxMax: Number(paxMax) || 0,
        setupNotes,
      });
    } else {
      onUpsert({
        platformType: platformType as CreateRegistrationPlatformInput["platformType"],
        supplierId: supplierId || undefined,
        expectedPaxMin: Number(paxMin) || 0,
        expectedPaxMax: Number(paxMax) || 0,
        setupNotes,
      });
    }
    setEditing(false);
  }

  function handleImport(e: FormEvent) {
    e.preventDefault();
    const count = Number(importCount);
    if (!count || count < 0) return;
    onImportHeadcount({
      headcountSource: importSource,
      importedHeadcount: count,
      importedFileName: importFileName || undefined,
    });
    setImportCount("");
    setImportFileName("");
    setShowImport(false);
  }

  if (!platform && !editing) {
    return (
      <Panel title="Registration Platform" icon={QrCode}>
        <EmptyState
          icon={QrCode}
          title="No registration platform configured"
          description="Configure the digital registration platform for large events (200-250+ pax). PRISM does not process ticket sales."
          action={
            <button
              type="button"
              onClick={() => setEditing(true)}
              className="mt-3 rounded-lg bg-primary px-4 py-2 text-sm font-bold text-primary-foreground"
            >
              Configure platform
            </button>
          }
        />
      </Panel>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <Panel title="Registration Platform" icon={QrCode}>
        {platform && !editing ? (
          <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-black text-foreground">
                Platform Configuration
              </h3>
              <button
                type="button"
                onClick={() => setEditing(true)}
                className="text-xs font-bold text-muted-foreground hover:text-foreground"
              >
                Edit
              </button>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="border-l border-border bg-background/60 px-3 py-2.5">
                <p className="text-xs font-bold text-muted-foreground">
                  Platform
                </p>
                <p className="mt-1 text-sm font-black text-foreground">
                  {PLATFORM_LABELS[platform.platformType] ?? platform.platformType}
                </p>
              </div>
              <div className="border-l border-border bg-background/60 px-3 py-2.5">
                <p className="text-xs font-bold text-muted-foreground">
                  Status
                </p>
                <div className={`mt-1 border-l-2 pl-2 ${STATUS_COLORS[platform.status] ?? ""}`}>
                  <p className="text-sm font-black text-foreground">
                    {STATUS_LABELS[platform.status] ?? platform.status}
                  </p>
                </div>
              </div>
              <div className="border-l border-border bg-background/60 px-3 py-2.5">
                <p className="text-xs font-bold text-muted-foreground">
                  Expected pax
                </p>
                <p className="mt-1 text-sm font-black text-foreground">
                  {platform.expectedPaxMin}–{platform.expectedPaxMax}
                </p>
              </div>
              <div className="border-l border-border bg-background/60 px-3 py-2.5">
                <p className="text-xs font-bold text-muted-foreground">
                  Supplier
                </p>
                <p className="mt-1 text-sm font-black text-foreground">
                  {platform.supplierId
                    ? digitalRegSuppliers.find((s) => s.id === platform.supplierId)?.name ?? "Linked"
                    : "Not linked"}
                </p>
              </div>
            </div>

            {platform.setupNotes && (
              <div className="border-l border-border bg-background/60 px-3 py-2.5">
                <p className="text-xs font-bold text-muted-foreground">
                  Setup notes
                </p>
                <p className="mt-1 text-sm text-foreground">
                  {platform.setupNotes}
                </p>
              </div>
            )}

            <div className="flex gap-2">
              {platform.status !== "closed" && (
                <button
                  type="button"
                  disabled={busy}
                  onClick={() =>
                    onUpdate({
                      status:
                        platform.status === "not_started"
                          ? "configuring"
                          : platform.status === "configuring"
                            ? "live"
                            : "closed",
                    })
                  }
                  className="rounded-lg border border-border bg-secondary px-3 py-1.5 text-xs font-bold text-foreground hover:bg-secondary/80"
                >
                  {platform.status === "not_started"
                    ? "Start configuring"
                    : platform.status === "configuring"
                      ? "Mark live"
                      : "Mark closed"}
                </button>
              )}
            </div>
          </div>
        ) : (
          <form onSubmit={handleSave} className="flex flex-col gap-3">
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="grid gap-1.5">
                <span className="text-xs font-black uppercase tracking-[0.14em] text-muted-foreground">
                  Platform type
                </span>
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
                <span className="text-xs font-black uppercase tracking-[0.14em] text-muted-foreground">
                  Linked supplier
                </span>
                <select
                  value={supplierId}
                  onChange={(ev) => setSupplierId(ev.target.value)}
                  className="h-10 rounded-md border border-border bg-background px-3 text-sm"
                >
                  <option value="">None</option>
                  {digitalRegSuppliers.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </label>

              <label className="grid gap-1.5">
                <span className="text-xs font-black uppercase tracking-[0.14em] text-muted-foreground">
                  Min pax
                </span>
                <input
                  type="number"
                  value={paxMin}
                  onChange={(ev) => setPaxMin(ev.target.value)}
                  min={0}
                  className="h-10 rounded-md border border-border bg-background px-3 text-sm"
                />
              </label>

              <label className="grid gap-1.5">
                <span className="text-xs font-black uppercase tracking-[0.14em] text-muted-foreground">
                  Max pax
                </span>
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
              <span className="text-xs font-black uppercase tracking-[0.14em] text-muted-foreground">
                Setup notes
              </span>
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
              {platform && (
                <button
                  type="button"
                  onClick={() => setEditing(false)}
                  className="rounded-lg border border-border px-4 py-2 text-sm font-bold text-muted-foreground"
                >
                  Cancel
                </button>
              )}
            </div>
          </form>
        )}
      </Panel>

      {platform && (
        <Panel title="Headcount Import" icon={Users}>
          <div className="flex flex-col gap-3">
            {platform.importedHeadcount > 0 ? (
              <div className="grid gap-3 sm:grid-cols-3">
                <div className="border-l border-(--prism-sage) bg-(--prism-sage)/10 px-3 py-2.5">
                  <p className="text-xs font-bold text-muted-foreground">
                    Imported headcount
                  </p>
                  <p className="mt-1 text-lg font-black text-foreground">
                    {platform.importedHeadcount}
                  </p>
                </div>
                <div className="border-l border-border bg-background/60 px-3 py-2.5">
                  <p className="text-xs font-bold text-muted-foreground">
                    Source
                  </p>
                  <p className="mt-1 text-sm font-black text-foreground">
                    {platform.headcountSource}
                  </p>
                </div>
                <div className="border-l border-border bg-background/60 px-3 py-2.5">
                  <p className="text-xs font-bold text-muted-foreground">
                    Imported at
                  </p>
                  <p className="mt-1 text-sm font-black text-foreground">
                    {platform.importedAt
                      ? new Date(platform.importedAt).toLocaleDateString()
                      : "—"}
                  </p>
                </div>
              </div>
            ) : (
              <div className="border-l border-border bg-background/60 px-3 py-2.5 text-sm text-muted-foreground">
                No headcount imported yet. Import final guest data after the event closes.
              </div>
            )}

            {showImport ? (
              <form onSubmit={handleImport} className="flex flex-col gap-3">
                <div className="grid gap-3 sm:grid-cols-3">
                  <label className="grid gap-1.5">
                    <span className="text-xs font-black uppercase tracking-[0.14em] text-muted-foreground">
                      Source
                    </span>
                    <input
                      type="text"
                      value={importSource}
                      onChange={(ev) => setImportSource(ev.target.value)}
                      className="h-10 rounded-md border border-border bg-background px-3 text-sm"
                      placeholder="e.g. XPERTO"
                    />
                  </label>
                  <label className="grid gap-1.5">
                    <span className="text-xs font-black uppercase tracking-[0.14em] text-muted-foreground">
                      Headcount
                    </span>
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
                    <span className="text-xs font-black uppercase tracking-[0.14em] text-muted-foreground">
                      File name (optional)
                    </span>
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
                    onClick={() => setShowImport(false)}
                    className="rounded-lg border border-border px-4 py-2 text-sm font-bold text-muted-foreground"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            ) : (
              <button
                type="button"
                onClick={() => setShowImport(true)}
                className="flex w-fit items-center gap-2 rounded-lg border border-dashed border-border bg-background px-4 py-2 text-sm font-bold text-muted-foreground transition hover:border-primary/40 hover:text-foreground"
              >
                <Upload className="size-4" />
                Import headcount data
              </button>
            )}
          </div>
        </Panel>
      )}
    </div>
  );
}
