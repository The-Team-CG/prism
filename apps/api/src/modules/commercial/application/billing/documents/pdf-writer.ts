/**
 * A small PDF writer for P.R.I.S.M documents: A4 pages, Helvetica and Helvetica-Bold, colour, filled boxes, lines and
 * rotated stamp text. Coordinates are measured from the top-left corner in points. Text is WinAnsi-encoded, so a
 * character outside it is replaced; callers write "PHP" rather than the peso sign.
 */

export const A4 = { width: 595.28, height: 841.89 } as const;

export type Rgb = readonly [number, number, number];
export type TextAlign = 'left' | 'right' | 'center';
export type TextOptions = { size?: number; bold?: boolean; color?: Rgb; align?: TextAlign };

/** Standard Helvetica advance widths (per 1000 em) for the printable ASCII range 32–126. */
const REGULAR = [278, 278, 355, 556, 556, 889, 667, 191, 333, 333, 389, 584, 278, 333, 278, 278, 556, 556, 556, 556, 556, 556, 556, 556, 556, 556, 278, 278, 584, 584, 584, 556, 1015, 667, 667, 722, 722, 667, 611, 778, 722, 278, 500, 667, 556, 833, 722, 778, 667, 778, 722, 667, 611, 722, 667, 944, 667, 667, 611, 278, 278, 278, 469, 556, 333, 556, 556, 500, 556, 556, 278, 556, 556, 222, 222, 500, 222, 833, 556, 556, 556, 556, 333, 500, 278, 556, 500, 722, 500, 500, 500, 334, 260, 334, 584];
const BOLD = [278, 333, 474, 556, 556, 889, 722, 238, 333, 333, 389, 584, 278, 333, 278, 278, 556, 556, 556, 556, 556, 556, 556, 556, 556, 556, 333, 333, 584, 584, 584, 611, 975, 722, 722, 722, 722, 667, 611, 778, 722, 278, 556, 722, 611, 833, 722, 778, 667, 778, 722, 667, 611, 722, 667, 944, 667, 667, 611, 333, 278, 333, 584, 556, 333, 556, 611, 556, 611, 556, 333, 611, 611, 278, 278, 556, 278, 889, 611, 611, 611, 611, 389, 556, 333, 611, 556, 778, 556, 556, 500, 389, 280, 389, 584];

/** The few typographic characters documents use, by their WinAnsi code and width. */
const EXTRA: Record<string, { code: number; width: number }> = {
  '·': { code: 0xb7, width: 278 },
  '—': { code: 0x97, width: 1000 },
  '–': { code: 0x96, width: 556 },
  '’': { code: 0x92, width: 222 },
  '“': { code: 0x93, width: 333 },
  '”': { code: 0x94, width: 333 },
  '•': { code: 0x95, width: 350 },
};

function charWidth(char: string, bold: boolean): number {
  const code = char.charCodeAt(0);
  if (code >= 32 && code <= 126) return (bold ? BOLD : REGULAR)[code - 32];
  return EXTRA[char]?.width ?? 556;
}

/** The width of a line of text, in points. */
export function measure(text: string, size: number, bold = false): number {
  let total = 0;
  for (const char of text) total += charWidth(char, bold);
  return (total * size) / 1000;
}

/** A PDF string literal: escaped, with non-ASCII characters as WinAnsi octal codes (unknown ones become "?"). */
function pdfString(text: string): string {
  let out = '';
  for (const char of text) {
    const code = char.charCodeAt(0);
    if (char === '(' || char === ')' || char === '\\') out += `\\${char}`;
    else if (code >= 32 && code <= 126) out += char;
    else if (EXTRA[char]) out += `\\${EXTRA[char].code.toString(8)}`;
    else out += '?';
  }
  return `(${out})`;
}

const num = (value: number) => (Math.round(value * 100) / 100).toString();
const colour = (rgb: Rgb) => rgb.map((part) => num(part / 255)).join(' ');

/** Shorten text with an ellipsis-like "..." so it fits a width. */
export function fit(text: string, width: number, size: number, bold = false): string {
  if (measure(text, size, bold) <= width) return text;
  let cut = text;
  while (cut.length > 1 && measure(`${cut}...`, size, bold) > width) cut = cut.slice(0, -1);
  return `${cut.trimEnd()}...`;
}

/** Split text into lines no wider than `width`, breaking at spaces. */
export function wrap(text: string, width: number, size: number, bold = false): string[] {
  const lines: string[] = [];
  let line = '';
  for (const word of text.split(/\s+/).filter(Boolean)) {
    const next = line ? `${line} ${word}` : word;
    if (line && measure(next, size, bold) > width) {
      lines.push(line);
      line = word;
    } else line = next;
  }
  if (line) lines.push(line);
  return lines.length ? lines : [''];
}

export class PdfDocument {
  private readonly pages: string[][] = [[]];

  private get ops(): string[] {
    return this.pages[this.pages.length - 1];
  }

  get pageCount(): number {
    return this.pages.length;
  }

  newPage() {
    this.pages.push([]);
  }

  text(x: number, y: number, text: string, options: TextOptions = {}) {
    const size = options.size ?? 10;
    const bold = options.bold ?? false;
    const width = measure(text, size, bold);
    const left = options.align === 'right' ? x - width : options.align === 'center' ? x - width / 2 : x;
    this.ops.push(`BT /${bold ? 'F2' : 'F1'} ${num(size)} Tf ${colour(options.color ?? [23, 18, 22])} rg ${num(left)} ${num(A4.height - y)} Td ${pdfString(text)} Tj ET`);
  }

  rect(x: number, y: number, width: number, height: number, fill: Rgb, stroke?: Rgb) {
    const paint = stroke ? `${colour(stroke)} RG 0.75 w B` : 'f';
    this.ops.push(`${colour(fill)} rg ${num(x)} ${num(A4.height - y - height)} ${num(width)} ${num(height)} re ${paint}`);
  }

  line(x1: number, y1: number, x2: number, y2: number, color: Rgb, width = 0.75) {
    this.ops.push(`${colour(color)} RG ${num(width)} w ${num(x1)} ${num(A4.height - y1)} m ${num(x2)} ${num(A4.height - y2)} l S`);
  }

  /** Outlined text turned by `degrees` around its centre, like a rubber stamp. */
  stamp(centerX: number, centerY: number, text: string, color: Rgb, size = 44, degrees = 18) {
    const radians = (degrees * Math.PI) / 180;
    const cos = Math.cos(radians);
    const sin = Math.sin(radians);
    const half = measure(text, size, true) / 2;
    const x = centerX - half * cos;
    const y = A4.height - centerY - half * sin;
    this.ops.push(`q ${colour(color)} RG 1.6 w BT 1 Tr /F2 ${num(size)} Tf ${num(cos)} ${num(sin)} ${num(-sin)} ${num(cos)} ${num(x)} ${num(y)} Tm ${pdfString(text)} Tj ET Q`);
  }

  toBuffer(): Buffer {
    const fonts = ['<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>', '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>'];
    const pageCount = this.pages.length;
    // Objects: 1 catalog, 2 pages, 3–4 fonts, then a page and its content stream for each page.
    const pageIds = this.pages.map((_, index) => 5 + index * 2);
    const objects: Buffer[] = [
      Buffer.from('<< /Type /Catalog /Pages 2 0 R >>', 'latin1'),
      Buffer.from(`<< /Type /Pages /Kids [${pageIds.map((id) => `${id} 0 R`).join(' ')}] /Count ${pageCount} >>`, 'latin1'),
      ...fonts.map((font) => Buffer.from(font, 'latin1')),
    ];
    for (const [index, ops] of this.pages.entries()) {
      const content = Buffer.from(ops.join('\n'), 'latin1');
      objects.push(Buffer.from(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${A4.width} ${A4.height}] /Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> /Contents ${pageIds[index] + 1} 0 R >>`, 'latin1'));
      objects.push(Buffer.concat([Buffer.from(`<< /Length ${content.length} >>\nstream\n`, 'latin1'), content, Buffer.from('\nendstream', 'latin1')]));
    }
    const parts: Buffer[] = [Buffer.from('%PDF-1.4\n', 'latin1')];
    const offsets: number[] = [];
    let length = parts[0].length;
    objects.forEach((object, index) => {
      offsets.push(length);
      const chunk = Buffer.concat([Buffer.from(`${index + 1} 0 obj\n`, 'latin1'), object, Buffer.from('\nendobj\n', 'latin1')]);
      parts.push(chunk);
      length += chunk.length;
    });
    const xref = [`xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`, ...offsets.map((offset) => `${String(offset).padStart(10, '0')} 00000 n \n`)].join('');
    parts.push(Buffer.from(`${xref}trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${length}\n%%EOF`, 'latin1'));
    return Buffer.concat(parts);
  }
}
