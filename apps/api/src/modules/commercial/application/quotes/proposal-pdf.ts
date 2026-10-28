const PAGE_LINES = 44;
const WRAP_COLUMNS = 84;

/** Helvetica in a plain PDF only covers Latin-1; anything else would corrupt the stream, so it becomes "?". */
function pdfSafe(value: string) {
  return value.replace(/[\r\t]/g, ' ').replace(/[^\x20-\x7e]/g, '?').replace(/[()\\]/g, (char) => `\\${char}`);
}

function wrap(text: string): string[] {
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

function formatPhp(amount: number) {
  return `PHP ${new Intl.NumberFormat('en-PH', { maximumFractionDigits: 0 }).format(amount)}`;
}

/** One-page client copy of an issued proposal: title, summary and total only. Estimate lines never reach this file. */
export function renderProposalPdf(input: { eventName: string; versionNumber: number; title: string; summary: string; revisionNote: string; totalAmount: number; issuedAt: Date }) {
  const lines = [
    'P.R.I.S.M PROPOSAL',
    ...wrap(`${input.eventName} - version ${input.versionNumber}`),
    `Issued ${input.issuedAt.toISOString().slice(0, 10)}`,
    '',
    ...wrap(input.title),
    '',
    ...(input.summary.trim() ? [...wrap(input.summary), ''] : []),
    ...(input.revisionNote.trim() ? [...wrap(`Changed in this version: ${input.revisionNote}`), ''] : []),
    `Total: ${formatPhp(input.totalAmount)}`,
  ];
  const visible = lines.length > PAGE_LINES
    ? [...lines.slice(0, PAGE_LINES - 2), '', 'Continued in your client portal.']
    : lines;
  const body = `BT /F1 12 Tf 14 TL 72 740 Td ${visible.map((line) => `(${pdfSafe(line)}) Tj T*`).join(' ')} ET`;
  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 5 0 R >> >> /Contents 4 0 R >>',
    `<< /Length ${Buffer.byteLength(body, 'utf8')} >>\nstream\n${body}\nendstream`,
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
  ];
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
