import { useId } from "react";
import { ChevronRight, Download } from "lucide-react";
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
    <section aria-labelledby={`${ids}-title`} className="rounded-md border border-border p-3 sm:p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 id={`${ids}-title`} className="text-base font-semibold text-foreground">Import guest roster</h3>
          <p className="mt-0.5 text-sm text-muted-foreground">
            Paste rows from a spreadsheet with a header row. Required columns: guest name and guest ID. Category and table are optional. If a header is not recognised, match it below.
          </p>
        </div>
        <a href={TEMPLATE_HREF} download="guest-roster-template.csv" className="inline-flex min-h-11 items-center gap-1.5 rounded-md border border-border px-3 text-sm font-semibold text-foreground no-underline">
          <Download className="size-4" aria-hidden /> Download template
        </a>
      </div>

      <div className="mt-3 grid gap-3 sm:grid-cols-[minmax(0,14rem)_minmax(0,1fr)]">
        <label className="grid gap-1 text-sm">
          <span className="text-xs font-medium text-muted-foreground">Source</span>
          <input value={vm.source} onChange={(event) => vm.setSource(event.target.value)} aria-invalid={Boolean(vm.sourceError)} aria-describedby={`${ids}-source-help`} className="h-11 rounded-md border border-border bg-background px-3 text-sm" />
          <span id={`${ids}-source-help`} className={vm.sourceError ? "text-xs text-danger" : "text-xs text-muted-foreground"}>
            {vm.sourceError ?? "Re-importing the same source replaces it: guests missing from the new file are withdrawn."}
          </span>
        </label>
        <label className="grid gap-1 text-sm">
          <span className="text-xs font-medium text-muted-foreground">CSV file (optional)</span>
          <input
            type="file"
            accept=".csv,.tsv,.txt,text/csv,text/tab-separated-values"
            disabled={disabled}
            onChange={(event) => pickRosterFile(event.target, vm.loadFile)}
            className="min-h-11 text-sm file:mr-3 file:min-h-11 file:rounded-md file:border file:border-border file:bg-background file:px-3 file:text-sm file:font-semibold"
          />
        </label>
      </div>

      <label className="mt-3 grid gap-1 text-sm">
        <span className="text-xs font-medium text-muted-foreground">Spreadsheet rows</span>
        <textarea
          value={vm.sheet}
          onChange={(event) => vm.setSheet(event.target.value)}
          rows={5}
          spellCheck={false}
          className="rounded-md border border-border bg-background px-3 py-2 font-mono text-xs"
          placeholder={`${ROSTER_TEMPLATE_COLUMNS.slice(0, 4).map((column) => ROSTER_COLUMN_LABELS[column]).join(",")}\nAda Lovelace,VIP,T1,A-001`}
        />
      </label>

      <RosterColumnMatching preview={preview} onMatch={vm.matchColumn} disabled={disabled} />

      {preview.headerErrors.length > 0 ? (
        <p role="alert" className="mt-3 text-sm text-danger">{preview.headerErrors.join(" ")}</p>
      ) : null}

      <RosterPreview preview={preview} />

      <div className="mt-3 flex flex-wrap items-center gap-3">
        <button
          type="button"
          disabled={disabled || !vm.payload}
          onClick={() => void vm.importSheet()}
          className="min-h-11 rounded-md bg-primary px-4 text-sm font-semibold text-primary-foreground disabled:opacity-60"
        >
          {vm.payload ? `Import ${vm.payload.rows.length} guests` : "Import roster"}
        </button>
        {preview.errorCount > 0 ? <span className="text-xs text-muted-foreground">Fix every flagged row before importing.</span> : null}
      </div>

      <RosterImportMessage message={vm.message} />

      <details className="group mt-3 border-t border-border pt-2">
        <summary className="flex min-h-11 cursor-pointer list-none items-center gap-2 text-sm font-semibold text-foreground">
          <ChevronRight className="size-4 transition-transform group-open:rotate-90" aria-hidden />
          Advanced: import raw JSON
        </summary>
        <label className="grid gap-1 text-sm">
          <span className="text-xs font-medium text-muted-foreground">JSON payload</span>
          <textarea
            value={vm.json}
            onChange={(event) => vm.setJson(event.target.value)}
            rows={4}
            spellCheck={false}
            className="rounded-md border border-border bg-background px-3 py-2 font-mono text-xs"
            placeholder={'{"source":"xperto","rows":[{"sourceKey":"A-1","guestName":"Ada Lovelace","category":"VIP","table":"T1"}]}'}
          />
        </label>
        <button type="button" disabled={disabled || !vm.json.trim()} onClick={() => void vm.importJson()} className="mt-2 min-h-11 rounded-md border border-border px-4 text-sm font-semibold disabled:opacity-60">
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
              className="h-11 rounded-md border border-border bg-background px-3 text-sm"
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
