import type { PrismStatementOfAccount } from "@prism/types";
import { statementFileName, statementPdfLines } from "./statement-of-account-rules";

const PAGE_WIDTH = 612;
const PAGE_HEIGHT = 792;
const MARGIN = 72;
const LEADING = 14;
const LINES_PER_PAGE = Math.floor((PAGE_HEIGHT - MARGIN * 2) / LEADING);
/** Helvetica 10 averages about five points a character; this keeps a line inside the margins. */
const MAX_LINE_CHARS = Math.floor((PAGE_WIDTH - MARGIN * 2) / 5);

function pdfEscape(value: string) {
  return value.replace(/−/g, "-").normalize("NFKD").replace(/[^\x20-\x7e]/g, "?").replace(/[()\\]/g, "\\$&");
}

/** Breaks a long line at spaces so it stays on the page; a word longer than a line is cut. */
function wrap(line: string): string[] {
  if (line.length <= MAX_LINE_CHARS) return [line];
  const out: string[] = [];
  let current = "";
  for (const word of line.split(" ")) {
    const candidate = current ? `${current} ${word}` : word;
    if (candidate.length <= MAX_LINE_CHARS) { current = candidate; continue; }
    if (current) out.push(current);
    current = word.length > MAX_LINE_CHARS ? word.slice(0, MAX_LINE_CHARS) : word;
  }
  return current ? [...out, current] : out;
}

function pageStream(lines: string[], first: boolean): string {
  const body = lines.map((line, index) => `${index === 0 ? "" : "T* "}(${pdfEscape(line)}) Tj`).join("\n");
  const heading = first ? "/F1 14 Tf" : "/F1 10 Tf";
  return `BT ${heading} ${LEADING} TL ${MARGIN} ${PAGE_HEIGHT - MARGIN} Td\n${body}\nET`;
}

/**
 * A plain multi-page text PDF: Helvetica, one block of text per page, no styling. The title line is larger on the first
 * page only. Enough for a statement a client keeps or prints, with no PDF library.
 */
export function createTextPdf(lines: string[]): Blob {
  const wrapped = lines.flatMap(wrap);
  const pages: string[][] = [];
  for (let start = 0; start < wrapped.length; start += LINES_PER_PAGE) pages.push(wrapped.slice(start, start + LINES_PER_PAGE));
  if (pages.length === 0) pages.push([""]);

  // 1 catalog, 2 pages, 3 font, then a page object and its content stream for each page.
  const pageObject = (index: number) => 4 + index * 2;
  const objects: string[] = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    `<< /Type /Pages /Kids [${pages.map((_, index) => `${pageObject(index)} 0 R`).join(" ")}] /Count ${pages.length} >>`,
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
  ];
  pages.forEach((pageLines, index) => {
    const stream = pageStream(pageLines, index === 0);
    objects.push(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${PAGE_WIDTH} ${PAGE_HEIGHT}] /Resources << /Font << /F1 3 0 R >> >> /Contents ${pageObject(index) + 1} 0 R >>`);
    objects.push(`<< /Length ${new TextEncoder().encode(stream).byteLength} >>\nstream\n${stream}\nendstream`);
  });

  let pdf = "%PDF-1.4\n";
  const offsets: number[] = [];
  objects.forEach((object, index) => {
    offsets.push(new TextEncoder().encode(pdf).byteLength);
    pdf += `${index + 1} 0 obj\n${object}\nendobj\n`;
  });
  const xrefOffset = new TextEncoder().encode(pdf).byteLength;
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (const offset of offsets) pdf += `${String(offset).padStart(10, "0")} 00000 n \n`;
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;
  return new Blob([pdf], { type: "application/pdf" });
}

const pdfMoney = (amount: number) => `PHP ${amount.toLocaleString("en-PH")}`;

export function createStatementOfAccountPdf(statement: PrismStatementOfAccount): { blob: Blob; fileName: string } {
  return { blob: createTextPdf(statementPdfLines(statement, pdfMoney)), fileName: statementFileName(statement) };
}
