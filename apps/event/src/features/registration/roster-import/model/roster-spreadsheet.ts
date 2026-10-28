/**
 * Turns a pasted spreadsheet (CSV or tab-separated) into the existing guest roster
 * import payload. Row validation uses the shared `importGuestRosterSchema` row contract.
 */
import { GUEST_WALK_IN_ROSTER_SOURCE, importGuestRosterSchema, type ImportGuestRosterInput } from "@prism/types";

type RosterRow = ImportGuestRosterInput["rows"][number];

const rowSchema = importGuestRosterSchema.shape.rows.element;

/** Template column order; the first four are the ones operators normally fill. */
export const ROSTER_TEMPLATE_COLUMNS = ["guestName", "category", "table", "sourceKey", "email", "phone", "eligibility"] as const;
export type RosterColumn = (typeof ROSTER_TEMPLATE_COLUMNS)[number];

export const ROSTER_COLUMN_LABELS: Record<RosterColumn, string> = {
  guestName: "Guest name",
  category: "Category",
  table: "Table",
  sourceKey: "Guest ID",
  email: "Email",
  phone: "Phone",
  eligibility: "Eligibility",
};

const REQUIRED_COLUMNS: RosterColumn[] = ["guestName", "sourceKey"];

/** Header spellings accepted for each payload field (compared without case, spaces, or punctuation). */
const HEADER_ALIASES: Record<RosterColumn, string[]> = {
  guestName: ["guestname", "name", "fullname", "guest"],
  category: ["category", "type", "guestcategory"],
  table: ["table", "tableno", "tablenumber", "seat"],
  sourceKey: ["sourcekey", "guestid", "id", "key", "registrationid", "ticketid"],
  email: ["email", "emailaddress"],
  phone: ["phone", "mobile", "phonenumber", "contactnumber"],
  eligibility: ["eligibility", "eligible"],
};

export function buildRosterTemplateCsv(): string {
  return [
    ROSTER_TEMPLATE_COLUMNS.map((column) => ROSTER_COLUMN_LABELS[column]).join(","),
    "Ada Lovelace,VIP,T1,A-001,ada@example.com,,eligible",
    "Grace Hopper,Speaker,T2,A-002,,,eligible",
  ].join("\r\n") + "\r\n";
}

export type RosterPreviewRow = {
  /** 1-based line number in the pasted text, for operator-facing messages. */
  line: number;
  values: Partial<Record<RosterColumn, string>>;
  errors: string[];
};

export type RosterSpreadsheetPreview = {
  /** Header problems that prevent reading any row. */
  headerErrors: string[];
  /** Pasted header cells, in order. */
  headers: string[];
  /** The field each pasted column feeds, by position; null means ignored. */
  mapping: Array<RosterColumn | null>;
  /** Columns that were recognised, in pasted order. */
  columns: RosterColumn[];
  /** Pasted headers that were ignored. */
  ignoredHeaders: string[];
  rows: RosterPreviewRow[];
  validCount: number;
  errorCount: number;
};

function normalizeHeader(value: string): string {
  return value.toLowerCase().replaceAll(/[^a-z0-9]/g, "");
}

function detectDelimiter(headerLine: string): "\t" | "," | ";" {
  if (headerLine.includes("\t")) return "\t";
  const commas = headerLine.split(",").length;
  const semicolons = headerLine.split(";").length;
  return semicolons > commas ? ";" : ",";
}

type DelimitedRecord = { line: number; cells: string[] };

type ParserState = {
  records: DelimitedRecord[];
  cells: string[];
  field: string;
  inQuotes: boolean;
  line: number;
  recordLine: number;
};

/** Inside quotes: "" is a literal quote, a lone " closes the field, anything else (including newlines) is text. Returns chars consumed. */
function quotedStep(state: ParserState, char: string, next: string | undefined): number {
  if (char === '"' && next === '"') {
    state.field += '"';
    return 2;
  }
  if (char === '"') {
    state.inQuotes = false;
    return 1;
  }
  if (char === "\n") state.line += 1;
  state.field += char;
  return 1;
}

function endRecord(state: ParserState) {
  state.cells.push(state.field);
  state.records.push({ line: state.recordLine, cells: state.cells });
  state.cells = [];
  state.field = "";
}

function plainStep(state: ParserState, char: string, delimiter: string) {
  if (char === '"' && state.field === "") {
    state.inQuotes = true;
  } else if (char === delimiter) {
    state.cells.push(state.field);
    state.field = "";
  } else if (char === "\n") {
    endRecord(state);
    state.line += 1;
    state.recordLine = state.line;
  } else if (char !== "\r") {
    state.field += char;
  }
}

/** RFC 4180-style parser: quoted fields may contain delimiters, quotes ("") and line breaks. */
export function parseDelimited(text: string, delimiter: string): DelimitedRecord[] {
  const state: ParserState = { records: [], cells: [], field: "", inQuotes: false, line: 1, recordLine: 1 };
  let index = 0;
  while (index < text.length) {
    if (state.inQuotes) {
      index += quotedStep(state, text[index], text[index + 1]);
    } else {
      plainStep(state, text[index], delimiter);
      index += 1;
    }
  }
  if (state.field !== "" || state.cells.length > 0) endRecord(state);
  return state.records.filter((record) => record.cells.some((cell) => cell.trim() !== ""));
}

function autoColumn(header: string): RosterColumn | null {
  const normalized = normalizeHeader(header);
  return ROSTER_TEMPLATE_COLUMNS.find((column) => HEADER_ALIASES[column].includes(normalized)) ?? null;
}

/** Operator choices keyed by pasted column position; `null` ignores that column. Unset positions use header matching. */
export type RosterColumnOverrides = Partial<Record<number, RosterColumn | null>>;

function mapHeaders(headers: string[], overrides: RosterColumnOverrides): Array<RosterColumn | null> {
  return headers.map((header, index) => (index in overrides ? overrides[index] ?? null : autoColumn(header)));
}

function headerErrors(mapping: Array<RosterColumn | null>): string[] {
  const columns = mapping.filter((column): column is RosterColumn => column !== null);
  const errors: string[] = [];
  const repeated = ROSTER_TEMPLATE_COLUMNS.filter((column) => columns.filter((entry) => entry === column).length > 1);
  if (repeated.length > 0) errors.push(`Each field can come from one column only. Used more than once: ${repeated.map((column) => ROSTER_COLUMN_LABELS[column]).join(", ")}.`);
  const missing = REQUIRED_COLUMNS.filter((column) => !columns.includes(column));
  if (missing.length > 0) errors.push(`Match a column to each required field. Missing: ${missing.map((column) => ROSTER_COLUMN_LABELS[column]).join(", ")}.`);
  return errors;
}

function issueMessage(path: PropertyKey[], message: string): string {
  const field = path[0];
  const label = typeof field === "string" && field in ROSTER_COLUMN_LABELS ? ROSTER_COLUMN_LABELS[field as RosterColumn] : null;
  if (label && /required|at least 1|expected string/i.test(message)) return `${label} is required`;
  if (field === "eligibility") return "Eligibility must be eligible or ineligible";
  return label ? `${label}: ${message}` : message;
}

/** The row as the shared contract expects it: blank cells dropped and eligibility lower-cased. */
function rowCandidate(values: Partial<Record<RosterColumn, string>>): Partial<Record<RosterColumn, string>> {
  const candidate = Object.fromEntries(Object.entries(values).filter(([, value]) => value)) as Partial<Record<RosterColumn, string>>;
  if (candidate.eligibility) candidate.eligibility = candidate.eligibility.toLowerCase();
  return candidate;
}

function rowErrors(values: Partial<Record<RosterColumn, string>>): string[] {
  const parsed = rowSchema.safeParse(rowCandidate(values));
  if (parsed.success) return [];
  return [...new Set(parsed.error.issues.map((issue) => issueMessage(issue.path, issue.message)))];
}

function previewRows(body: DelimitedRecord[], mapping: Array<RosterColumn | null>): RosterPreviewRow[] {
  const seenKeys = new Map<string, number>();
  return body.map((record) => {
    const values: Partial<Record<RosterColumn, string>> = {};
    mapping.forEach((column, index) => {
      if (column) values[column] = (record.cells[index] ?? "").trim();
    });
    const errors = rowErrors(values);
    const key = values.sourceKey;
    const firstLine = key ? seenKeys.get(key) : undefined;
    if (key && firstLine !== undefined) errors.push(`Guest ID ${key} repeats line ${firstLine}`);
    else if (key) seenKeys.set(key, record.line);
    return { line: record.line, values, errors };
  });
}

/** Reads pasted spreadsheet text into preview rows with per-row errors, using any column choices the operator made. */
export function previewRosterSpreadsheet(text: string, overrides: RosterColumnOverrides = {}): RosterSpreadsheetPreview {
  const empty: RosterSpreadsheetPreview = { headerErrors: [], headers: [], mapping: [], columns: [], ignoredHeaders: [], rows: [], validCount: 0, errorCount: 0 };
  const trimmed = text.replace(/^﻿/, "");
  if (!trimmed.trim()) return empty;

  const firstLine = trimmed.split(/\r?\n/, 1)[0] ?? "";
  const [header, ...body] = parseDelimited(trimmed, detectDelimiter(firstLine));
  if (!header) return empty;

  const headers = header.cells.map((cell) => cell.trim());
  const mapping = mapHeaders(headers, overrides);
  const columns = mapping.filter((column): column is RosterColumn => column !== null);
  const ignoredHeaders = headers.filter((cell, index) => mapping[index] === null && cell);
  const errors = headerErrors(mapping);
  if (errors.length > 0) return { ...empty, headers, mapping, columns, ignoredHeaders, headerErrors: errors };

  const rows = previewRows(body, mapping);
  const errorCount = rows.filter((row) => row.errors.length > 0).length;
  return { headerErrors: [], headers, mapping, columns, ignoredHeaders, rows, validCount: rows.length - errorCount, errorCount };
}

/**
 * Builds the shared import payload only when every row is valid. Imports reconcile a
 * whole source, so sending a partial roster would withdraw the guests on skipped rows.
 */
export function buildRosterImportPayload(source: string, preview: RosterSpreadsheetPreview): ImportGuestRosterInput | null {
  if (preview.headerErrors.length > 0 || preview.errorCount > 0 || preview.rows.length === 0) return null;
  const rows: RosterRow[] = preview.rows.map((row) => rowSchema.parse(rowCandidate(row.values)));
  const parsed = importGuestRosterSchema.safeParse({ source: source.trim(), rows });
  return parsed.success ? parsed.data : null;
}

export function rosterSourceError(source: string): string | null {
  const trimmed = source.trim();
  if (!trimmed) return "Name the source so later imports from it can be reconciled.";
  if (trimmed.toLowerCase() === GUEST_WALK_IN_ROSTER_SOURCE) return "Coordinator walk-in is reserved for walk-ins added on the day.";
  return null;
}
