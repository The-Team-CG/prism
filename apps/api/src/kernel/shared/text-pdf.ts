const PAGE_LINES = 44;
const WRAP_COLUMNS = 84;

/** Helvetica in a plain PDF only covers Latin-1; anything else would corrupt the stream, so it becomes "?". */
function pdfSafe(value: string) {
  return value.replace(/[\r\t]/g, ' ').replace(/[^\x20-\x7e]/g, '?').replace(/[()\\]/g, (char) => `\\${char}`);
}

/** Wraps free text to the printable width, keeping its paragraph breaks. */
export function wrapPdfText(text: string): string[] {
  return text.split('\n').flatMap((paragraph) => {
    const words = paragraph.trim().split(/\s+/).filter(Boolean);
    if (words.length === 0) return [''];
    const lines: string[] = [];
    let current = '';
    for (const word of words) {
      if (current && current.length + 1 + word.length > WRAP_COLUMNS) {
        lines.push(current);
        current = word;
      } else {
        current = current ? `${current} ${word}` : word;
      }
    }
    lines.push(current);
    return lines;
  });
}

/** A plain Helvetica text PDF on US Letter pages. Callers decide what to truncate; this only paginates. */
export function renderTextPdf(lines: string[], linesPerPage = PAGE_LINES): Buffer {
  const pages: string[][] = [];
  for (let index = 0; index < Math.max(lines.length, 1); index += linesPerPage) pages.push(lines.slice(index, index + linesPerPage));
  // Object layout: 1 catalog, 2 page tree, 3 font, then a page and its content stream per page.
  const fontObject = 3;
  const pageObject = (index: number) => 4 + index * 2;
  const kids = pages.map((_page, index) => `${pageObject(index)} 0 R`).join(' ');
  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    `<< /Type /Pages /Kids [${kids}] /Count ${pages.length} >>`,
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
  ];
  pages.forEach((page, index) => {
    const body = `BT /F1 12 Tf 14 TL 72 740 Td ${page.map((line) => `(${pdfSafe(line)}) Tj T*`).join(' ')} ET`;
    objects.push(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 ${fontObject} 0 R >> >> /Contents ${pageObject(index) + 1} 0 R >>`);
    objects.push(`<< /Length ${Buffer.byteLength(body, 'utf8')} >>\nstream\n${body}\nendstream`);
  });
  let pdf = '%PDF-1.4\n';
  const offsets: number[] = [];
  objects.forEach((object, index) => {
    offsets.push(Buffer.byteLength(pdf, 'utf8'));
    pdf += `${index + 1} 0 obj\n${object}\nendobj\n`;
  });
  const start = Buffer.byteLength(pdf, 'utf8');
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  offsets.forEach((offset) => { pdf += `${String(offset).padStart(10, '0')} 00000 n \n`; });
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${start}\n%%EOF`;
  return Buffer.from(pdf, 'utf8');
}
