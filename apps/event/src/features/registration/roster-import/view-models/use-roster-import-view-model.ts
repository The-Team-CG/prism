import { useMemo, useState } from "react";
import { importGuestRosterSchema, parseContract, type ImportGuestRosterInput, type PrismGuestRosterEntry } from "@prism/types";
import { buildRosterImportPayload, previewRosterSpreadsheet, rosterSourceError, type RosterColumn, type RosterColumnOverrides } from "../model/roster-spreadsheet";

export function useRosterImportViewModel(onImport: (input: ImportGuestRosterInput) => Promise<PrismGuestRosterEntry[]>, onImported: (rows: PrismGuestRosterEntry[]) => void) {
  const [source, setSource] = useState("spreadsheet");
  const [sheet, setSheetText] = useState("");
  const [overrides, setOverrides] = useState<RosterColumnOverrides>({});
  const [json, setJson] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<{ tone: "success" | "error"; text: string } | null>(null);

  const preview = useMemo(() => previewRosterSpreadsheet(sheet, overrides), [sheet, overrides]);

  /** Column choices belong to one header row; a different paste starts from header matching again. */
  function setSheet(next: string) {
    if (headerLine(next) !== headerLine(sheet)) setOverrides({});
    setSheetText(next);
  }

  function matchColumn(index: number, column: RosterColumn | null) {
    setOverrides((current) => ({ ...current, [index]: column }));
  }
  const sourceError = rosterSourceError(source);
  const payload = useMemo(() => (sourceError ? null : buildRosterImportPayload(source, preview)), [source, sourceError, preview]);

  async function run(input: ImportGuestRosterInput, reset: () => void) {
    setSubmitting(true);
    setMessage(null);
    try {
      const result = await onImport(input);
      onImported(result);
      reset();
      setMessage({ tone: "success", text: `Imported ${result.length} roster rows from ${input.source}.` });
    } catch (error) {
      setMessage({ tone: "error", text: error instanceof Error ? error.message : "Unable to import roster." });
    } finally {
      setSubmitting(false);
    }
  }

  async function importSheet() {
    if (!payload) return;
    await run(payload, () => setSheet(""));
  }

  async function importJson() {
    let input: ImportGuestRosterInput;
    try {
      input = parseContract(importGuestRosterSchema, JSON.parse(json), "Guest roster import");
    } catch (error) {
      setMessage({ tone: "error", text: error instanceof Error ? error.message : "The JSON payload is not valid." });
      return;
    }
    await run(input, () => setJson(""));
  }

  async function loadFile(file: File) {
    setMessage(null);
    try {
      setSheet(await file.text());
    } catch {
      setMessage({ tone: "error", text: "Could not read that file. Save it as CSV and try again." });
    }
  }

  return { source, setSource, sourceError, sheet, setSheet, json, setJson, preview, matchColumn, payload, submitting, message, importSheet, importJson, loadFile };
}

function headerLine(text: string): string {
  return text.split(/\r?\n/, 1)[0] ?? "";
}
