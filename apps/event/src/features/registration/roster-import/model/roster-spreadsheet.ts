/**
 * Turns a pasted spreadsheet (CSV or tab-separated) into the existing guest roster
 * import payload. Row validation uses the shared `importGuestRosterSchema` row contract.
 */
import { importGuestRosterSchema, type ImportGuestRosterInput } from "@prism/types";

type RosterRow = ImportGuestRosterInput["rows"][number];

const rowSchema = importGuestRosterSchema.shape.rows.element;

/** Template column order; the first four are the ones operators normally fill. */
export const ROSTER_TEMPLATE_COLUMNS = ["guestName", "category", "table", "sourceKey", "email", "phone", "eligibility"] as const;
type RosterColumn = (typeof ROSTER_TEMPLATE_COLUMNS)[number];

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

export const RESERVED_ROSTER_SOURCE = "coordinator-walk-in";

export function buildRosterTemplateCsv(): string {
  return [
    ROSTER_TEMPLATE_COLUMNS.join(","),
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

function mapHeaders(headers: string[]) {
  const columns: Array<RosterColumn | null> = headers.map((header) => {
    const normalized = normalizeHeader(header);
    return (Object.keys(HEADER_ALIASES) as RosterColumn[]).find((column) => HEADER_ALIASES[column].includes(normalized)) ?? null;
  });
  return columns;
}

function issueMessage(path: PropertyKey[], message: string): string {
  const field = path[0];
  const label = typeof field === "string" && field in ROSTER_COLUMN_LABELS ? ROSTER_COLUMN_LABELS[field as RosterColumn] : null;
  if (label && /required|at least 1|expected string/i.test(message)) return `${label} is required`;
  if (field === "eligibility") return "Eligibility must be eligible or ineligible";
  return label ? `${label}: ${message}` : message;
}

/** Reads pasted spreadsheet text into preview rows with per-row errors. */
export function previewRosterSpreadsheet(text: string): RosterSpreadsheetPreview {
  const empty: RosterSpreadsheetPreview = { headerErrors: [], columns: [], ignoredHeaders: [], rows: [], validCount: 0, errorCount: 0 };
  const trimmed = text.replace(/^﻿/, "");
  if (!trimmed.trim()) return empty;

  const firstLine = trimmed.split(/\r?\n/, 1)[0] ?? "";
  const records = parseDelimited(trimmed, detectDelimiter(firstLine));
  const [header, ...body] = records;
  if (!header) return empty;

  const mapped = mapHeaders(header.cells);
  const columns = mapped.filter((column): column is RosterColumn => column !== null);
  const ignoredHeaders = header.cells.filter((_, index) => mapped[index] === null).map((cell) => cell.trim()).filter(Boolean);
  const missing = REQUIRED_COLUMNS.filter((column) => !columns.includes(column));
  if (missing.length > 0) {
    return {
      ...empty,
      columns,
      ignoredHeaders,
      headerErrors: [`The first row must name the columns. Missing: ${missing.join(", ")}.`],
    };
  }

  const seenKeys = new Map<string, number>();
  const rows: RosterPreviewRow[] = body.map((record) => {
    const values: Partial<Record<RosterColumn, string>> = {};
    mapped.forEach((column, index) => {
      if (column) values[column] = (record.cells[index] ?? "").trim();
    });
    const errors: string[] = [];
    const candidate = Object.fromEntries(
      Object.entries(values).filter(([, value]) => value !== ""),
    ) as Partial<Record<RosterColumn, string>>;
    if (candidate.eligibility) candidate.eligibility = candidate.eligibility.toLowerCase();
    const parsed = rowSchema.safeParse(candidate);
    if (!parsed.success) {
      for (const issue of parsed.error.issues) {
        const message = issueMessage(issue.path, issue.message);
        if (!errors.includes(message)) errors.push(message);
      }
    }
    const key = values.sourceKey;
    if (key) {
      const firstLine = seenKeys.get(key);
      if (firstLine !== undefined) errors.push(`Guest ID ${key} repeats line ${firstLine}`);
      else seenKeys.set(key, record.line);
    }
    return { line: record.line, values, errors };
  });

  const errorCount = rows.filter((row) => row.errors.length > 0).length;
  return { headerErrors: [], columns, ignoredHeaders, rows, validCount: rows.length - errorCount, errorCount };
}

/**
 * Builds the shared import payload only when every row is valid. Imports reconcile a
 * whole source, so sending a partial roster would withdraw the guests on skipped rows.
 */
export function buildRosterImportPayload(source: string, preview: RosterSpreadsheetPreview): ImportGuestRosterInput | null {
  if (preview.headerErrors.length > 0 || preview.errorCount > 0 || preview.rows.length === 0) return null;
  const rows: RosterRow[] = preview.rows.map((row) => rowSchema.parse(
    Object.fromEntries(Object.entries({ ...row.values, eligibility: row.values.eligibility?.toLowerCase() }).filter(([, value]) => value)),
  ));
  const parsed = importGuestRosterSchema.safeParse({ source: source.trim(), rows });
  return parsed.success ? parsed.data : null;
}

export function rosterSourceError(source: string): string | null {
  const trimmed = source.trim();
  if (!trimmed) return "Name the source so later imports from it can be reconciled.";
  if (trimmed.toLowerCase() === RESERVED_ROSTER_SOURCE) return "Coordinator walk-in is reserved for walk-ins added on the day.";
  return null;
}
