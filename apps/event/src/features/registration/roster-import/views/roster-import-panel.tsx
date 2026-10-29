import { useId, useState } from "react";
import { ChevronRight, Download, FileUp } from "lucide-react";
import { cx } from "@/features/pmcm-kit";
import type { ImportGuestRosterInput, PrismGuestRosterEntry } from "@prism/types";
import { ROSTER_COLUMN_LABELS, ROSTER_TEMPLATE_COLUMNS, buildRosterTemplateCsv, type RosterColumn } from "../model/roster-spreadsheet";
import { useRosterImportViewModel } from "../view-models/use-roster-import-view-model";

const EM_DASH = "—";
const PREVIEW_COLUMNS = ["guestName", "category", "table", "sourceKey"] as const;
const TEMPLATE_HREF = `data:text/csv;charset=utf-8,${encodeURIComponent(buildRosterTemplateCsv())}`;

/**
 * Spreadsheet-first roster import: download the template, paste rows (or choose a CSV),
 * check the preview, then import. Raw JSON stays available under Advanced.
 */
/** Load the chosen file, then clear the input so choosing the same file again re-reads it. */
function pickRosterFile(input: HTMLInputElement, loadFile: (file: File) => Promise<void> | void) {
  const file = input.files?.[0];
  if (file) void loadFile(file);
  input.value = "";
}

/** Drop or choose a CSV; the dashed area highlights while a file is dragged over it. */
function RosterDropZone({ disabled, onFile }: { disabled: boolean; onFile: (file: File) => void }) {
  const [dragging, setDragging] = useState(false);
  return (
  <label
    onDragOver={(event) => {
      event.preventDefault();
      setDragging(true);
    }}
    onDragLeave={() => setDragging(false)}
    onDrop={(event) => {
      event.preventDefault();
      setDragging(false);
      const file = event.dataTransfer.files?.[0];
      if (file && !disabled) onFile(file);
    }}
    className={cx(
      "mt-3 flex cursor-pointer flex-col items-center gap-1 rounded-lg border-2 border-dashed px-4 py-5 text-center transition-colors has-[input:focus-visible]:ring-2 has-[input:focus-visible]:ring-ring/40",
      dragging ? "border-primary bg-primary/5" : "border-border bg-white hover:border-primary/40",
      disabled ? "cursor-not-allowed opacity-60" : "",
    )}
  >
    <FileUp className="size-5 text-primary" aria-hidden />
    <span className="text-sm font-medium text-foreground">Drop a CSV here, or <span className="text-primary">choose a file</span></span>
    <span className="text-xs text-muted-foreground">CSV or TSV exported from Excel or Google Sheets</span>
    <input
      type="file"
      accept=".csv,.tsv,.txt,text/csv,text/tab-separated-values"
      disabled={disabled}
      onChange={(event) => pickRosterFile(event.target, onFile)}
      className="sr-only"
    />
  </label>
  );
}

function RosterImportActions({ disabled, payloadRows, errorCount, onImport }: { disabled: boolean; payloadRows: number; errorCount: number; onImport: () => void }) {
  return (
  <div className="mt-3 flex flex-wrap items-center gap-3">
    <button
      type="button"
      disabled={disabled || payloadRows === 0}
      onClick={onImport}
      className="h-10 rounded-md bg-primary px-4 text-sm font-semibold text-primary-foreground transition-opacity disabled:cursor-not-allowed disabled:opacity-40"
    >
      {payloadRows ? `Import ${payloadRows} ${payloadRows === 1 ? "guest" : "guests"}` : "Import guests"}
    </button>
    {payloadRows ? null : <span className="text-xs text-muted-foreground">Add a file or paste rows to see a preview.</span>}
    {errorCount > 0 ? <span className="text-xs text-muted-foreground">Fix every flagged row before importing.</span> : null}
  </div>
  );
}

export function RosterImportPanel({
  busy,
  onImport,
  onImported,
}: {
  busy: boolean;
  onImport: (input: ImportGuestRosterInput) => Promise<PrismGuestRosterEntry[]>;
  onImported: (rows: PrismGuestRosterEntry[]) => void;
}) {
  const vm = useRosterImportViewModel(onImport, onImported);
  const ids = useId();
  const { preview } = vm;
  const disabled = busy || vm.submitting;

  return (
    <section aria-labelledby={`${ids}-title`} className="rounded-lg border border-border bg-surface-raised/60 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 id={`${ids}-title`} className="text-sm font-semibold text-foreground">Import guests</h3>
          <p className="mt-0.5 text-sm text-muted-foreground">Needs a guest name and guest ID for each row. Category and table are optional.</p>
        </div>
        <a href={TEMPLATE_HREF} download="guest-roster-template.csv" className="inline-flex items-center gap-1.5 rounded-md px-2 py-1.5 text-sm font-medium text-primary no-underline hover:bg-primary/10">
          <Download className="size-4" aria-hidden /> Template
        </a>
      </div>

      <RosterDropZone disabled={disabled} onFile={(file) => void vm.loadFile(file)} />

      <label className="mt-3 grid gap-1.5 text-sm">
        <span className="text-xs font-medium text-muted-foreground">Or paste rows, header first</span>
        <textarea
          value={vm.sheet}
          onChange={(event) => vm.setSheet(event.target.value)}
          rows={4}
          spellCheck={false}
          className="rounded-md border border-border bg-white px-3 py-2 font-mono text-xs outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/30"
          placeholder={`${ROSTER_TEMPLATE_COLUMNS.slice(0, 4).map((column) => ROSTER_COLUMN_LABELS[column]).join(",")}\nAda Lovelace,VIP,T1,A-001`}
        />
      </label>

      <label className="mt-3 grid max-w-sm gap-1.5 text-sm">
        <span className="text-xs font-medium text-muted-foreground">List name</span>
        <input
          value={vm.source}
          onChange={(event) => vm.setSource(event.target.value)}
          aria-invalid={Boolean(vm.sourceError)}
          aria-describedby={`${ids}-source-help`}
          className="h-9 rounded-md border border-border bg-white px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/30"
        />
        <span id={`${ids}-source-help`} className={vm.sourceError ? "text-xs text-danger" : "text-xs text-muted-foreground"}>
          {vm.sourceError ?? "Importing again under the same name replaces that list. Guests missing from the new file are withdrawn."}
        </span>
      </label>

      <RosterColumnMatching preview={preview} onMatch={vm.matchColumn} disabled={disabled} />

      {preview.headerErrors.length > 0 ? (
        <p role="alert" className="mt-3 text-sm text-danger">{preview.headerErrors.join(" ")}</p>
      ) : null}

      <RosterPreview preview={preview} />

      <RosterImportActions disabled={disabled} payloadRows={vm.payload?.rows.length ?? 0} errorCount={preview.errorCount} onImport={() => void vm.importSheet()} />

      <RosterImportMessage message={vm.message} />

      <details className="group mt-3 border-t border-border pt-2">
        <summary className="flex min-h-11 cursor-pointer list-none items-center gap-2 text-sm font-semibold text-foreground">
          <ChevronRight className="size-4 transition-transform group-open:rotate-90" aria-hidden />
          Advanced: paste JSON
        </summary>
        <label className="grid gap-1 text-sm">
          <span className="text-xs font-medium text-muted-foreground">JSON payload</span>
          <textarea
            value={vm.json}
            onChange={(event) => vm.setJson(event.target.value)}
            rows={4}
            spellCheck={false}
            className="rounded-md border border-border bg-white px-3 py-2 font-mono text-xs"
            placeholder={'{"source":"xperto","rows":[{"sourceKey":"A-1","guestName":"Ada Lovelace","category":"VIP","table":"T1"}]}'}
          />
        </label>
        <button type="button" disabled={disabled || !vm.json.trim()} onClick={() => void vm.importJson()} className="mt-2 h-9 rounded-md border border-border bg-white px-4 text-sm font-semibold disabled:opacity-40">
          Import JSON
        </button>
      </details>
    </section>
  );
}

type RosterPreviewModel = ReturnType<typeof useRosterImportViewModel>["preview"];

/** One field picker per pasted column, prefilled from the header so operators only fix what was not recognised. */
function RosterColumnMatching({ preview, onMatch, disabled }: { preview: RosterPreviewModel; onMatch: (index: number, column: RosterColumn | null) => void; disabled: boolean }) {
  if (preview.headers.length === 0) return null;
  return (
    <fieldset className="mt-3">
      <legend className="text-xs font-medium text-muted-foreground">Columns</legend>
      <div className="mt-1 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {preview.headers.map((header, index) => (
          <label key={`${index}-${header}`} className="grid gap-1 text-sm">
            <span className="truncate text-foreground" title={header}>{header || `Column ${index + 1}`}</span>
            <select
              value={preview.mapping[index] ?? ""}
              disabled={disabled}
              onChange={(event) => onMatch(index, (event.target.value || null) as RosterColumn | null)}
              className="h-9 rounded-md border border-border bg-white px-3 text-sm"
            >
              <option value="">Ignore this column</option>
              {ROSTER_TEMPLATE_COLUMNS.map((column) => <option key={column} value={column}>{ROSTER_COLUMN_LABELS[column]}</option>)}
            </select>
          </label>
        ))}
      </div>
    </fieldset>
  );
}

function RosterPreview({ preview }: { preview: RosterPreviewModel }) {
  if (preview.rows.length === 0) return null;
  return (
    <div className="mt-3">
      <p className="text-sm text-foreground" data-testid="roster-preview-summary">
        <span className="font-semibold tabular-nums">{preview.validCount}</span> ready
        <span className="text-muted-foreground"> · </span>
        <span className={preview.errorCount > 0 ? "font-semibold tabular-nums text-danger" : "tabular-nums"}>{preview.errorCount}</span> need fixing
        {preview.ignoredHeaders.length > 0 ? <span className="text-muted-foreground"> · Ignored columns: {preview.ignoredHeaders.join(", ")}</span> : null}
      </p>
      <div className="mt-2 max-h-80 overflow-auto rounded-md border border-border">
        <table className="w-full min-w-[36rem] text-left text-sm">
          <caption className="sr-only">Roster preview</caption>
          <thead className="sticky top-0 bg-card">
            <tr className="border-b border-border text-xs text-muted-foreground">
              <th scope="col" className="px-3 py-2 text-right font-normal">Line</th>
              {PREVIEW_COLUMNS.map((column) => <th key={column} scope="col" className="px-3 py-2 font-normal">{ROSTER_COLUMN_LABELS[column]}</th>)}
              <th scope="col" className="px-3 py-2 font-normal">Check</th>
            </tr>
          </thead>
          <tbody>
            {preview.rows.map((row) => (
              <tr key={row.line} className="border-b border-border last:border-b-0 align-top">
                <td className="px-3 py-2 text-right tabular-nums text-muted-foreground">{row.line}</td>
                {PREVIEW_COLUMNS.map((column) => (
                  <td key={column} className="px-3 py-2">
                    {row.values[column] ? row.values[column] : <span className="text-muted-foreground">{EM_DASH}</span>}
                  </td>
                ))}
                <td className="px-3 py-2">
                  {row.errors.length === 0 ? (
                    <span className="rounded-full bg-success-soft px-2 py-0.5 text-xs font-medium text-success">Ready</span>
                  ) : (
                    <span className="text-xs text-danger">{row.errors.join("; ")}</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function RosterImportMessage({ message }: { message: ReturnType<typeof useRosterImportViewModel>["message"] }) {
  if (!message) return null;
  const error = message.tone === "error";
  return (
    <p role={error ? "alert" : "status"} className={error ? "mt-2 text-sm text-danger" : "mt-2 text-sm text-muted-foreground"}>
      {message.text}
    </p>
  );
}
